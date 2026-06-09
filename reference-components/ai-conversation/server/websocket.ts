import type { IncomingMessage } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import OpenAI from 'openai';
import { OpenAIRealtimeWS } from 'openai/realtime/ws';
import Twilio from 'twilio';
import { type ServerEnvironment } from '../../../server.ts';
import { COMPONENT_BASE_PATH } from './index.ts';

// OpenAI Realtime model. Unlike the HTTP Responses/Chat APIs, the Realtime API
// keeps a single socket open for the lifetime of the call, so each turn avoids
// a fresh TLS + request handshake. This minimizes latency.
//
// Consider using a different realtime model suitable for your use-case.
const REALTIME_MODEL = 'gpt-realtime-2' as const;

// `ws` has no built-in dead-peer detection. We ping BOTH peers - the Twilio
// ConversationRelay socket and the OpenAI realtime socket - on this interval
// and tear the call down after this many consecutive missed pongs. The two
// heartbeats are independent and complementary: a half-open connection on
// either side (peer vanishes with no TCP FIN, so 'close' never fires) is
// invisible to the other side's heartbeat - the healthy peer keeps pong-ing -
// so each side needs its own. This prevents leaking the paid OpenAI socket
// when Twilio dies, and prevents dead air on a paid call when OpenAI dies.
const HEARTBEAT_INTERVAL_MS = 15_000;
const MAX_MISSED_PONGS = 2;

type SetupMessage = {
  type: 'setup';
  callSid: string;
};

type PromptMessage = {
  type: 'prompt';
  voicePrompt: string;
};

type InterruptMessage = {
  type: 'interrupt';
};

type IncomingRelayMessage =
  | SetupMessage
  | PromptMessage
  | InterruptMessage;

const INSTRUCTIONS: string = [
  'You are a helpful assistant.',
  'This conversation is being translated to voice, so answer carefully.',
  'When you respond, please spell out all numbers, for example twenty not 20.',
  'Do not include emojis in your responses.',
  'Do not include bullet points, asterisks, or special symbols.',
].join(' ');

export const isCRelayConnection = (
  env: ServerEnvironment,
  req: IncomingMessage
): boolean => {
  const signature = req.headers['x-twilio-signature'];
  if (typeof signature !== 'string') {
    return false;
  }

  return Twilio.validateRequest(
    env.TWILIO_AUTH_TOKEN,
    signature,
    // Twilio ConversationRelay signs the `wss` upgrade url. Do not change this to `https`
    `wss://${env.EXPO_PUBLIC_REFERENCE_COMPONENTS_DEV_SERVER_HOST}/${COMPONENT_BASE_PATH}`,
    {}
  );
};

export const createWebsocketServer = (env: ServerEnvironment): WebSocketServer => {
  const wss = new WebSocketServer({ noServer: true });
  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  // The server emitter also extends Node's EventEmitter; an unhandled 'error'
  // here would crash the process. Per-connection errors are handled on each
  // socket below - this is the server-level safety net.
  wss.on('error', (err) => {
    console.error('ConversationRelay WebSocketServer error', err);
  });

  wss.on('connection', (ws: WebSocket) => {
    console.log('ConversationRelay WebSocket connected');
    let callSid: string | undefined;

    // One persistent Realtime socket per call. Conversation history lives
    // server-side on this socket, so there is no local transcript to track.
    let realtime: OpenAIRealtimeWS | undefined;

    // Turn state machine. The Realtime API allows only one active response per
    // session, so a second `response.create` while one is in flight is rejected
    // with `conversation_already_has_active_response`. Rather than rely on that
    // rejection (our error handler would tear the call down), we serialize
    // turns:
    //   idle       - no active response; the session is free.
    //   responding - a response is generating; nothing queued behind it.
    //   pending    - a response is generating AND a follow-up prompt is queued
    //                to fire once the current one settles.
    // `response.create` is therefore only ever sent from `idle` (a fresh
    // prompt) or when draining a `pending` turn on `response.done`, so two
    // responses can never overlap.
    type TurnState = 'idle' | 'responding' | 'pending';
    let turnState: TurnState = 'idle';

    // Heartbeat state, one pair per peer. The interval handles are declared
    // before `teardown` so the closure can clear them; they are assigned once
    // each connection is wired up below. The Twilio heartbeat starts with this
    // connection; the OpenAI one starts in `handleSetupMessage`, once its
    // socket exists.
    let twilioConversationRelayHeartbeat: ReturnType<typeof setInterval> | undefined;
    let twilioMissedPongs = 0;
    let openAiRealtimeHeartbeat: ReturnType<typeof setInterval> | undefined;
    let openAiMissedPongs = 0;

    // Tearing down always closes BOTH the Twilio and OpenAI connections, so a
    // failure on either side brings down the other rather than leaving a
    // half-open call. Every path routes here - Twilio close/error, OpenAI
    // close/error, or a missed-heartbeat timeout - and it is idempotent, so
    // whichever fires first fully cleans up and the rest become no-ops. This is
    // what prevents the paid OpenAI socket from leaking when one side dies
    // without notifying the other.
    let tornDown = false;
    const teardown = (reason: string) => {
      if (tornDown) {
        return;
      }
      tornDown = true;
      console.log(`Tearing down call${callSid ? ` ${callSid}` : ''}: ${reason}`);

      clearInterval(twilioConversationRelayHeartbeat);
      clearInterval(openAiRealtimeHeartbeat);

      if (realtime) {
        // Swallow any late error from closing an already-dead socket.
        try {
          realtime.close();
        } catch (err) {
          console.warn('Error closing OpenAI realtime socket', err);
        }
        realtime = undefined;
      }

      if (
        ws.readyState === WebSocket.OPEN ||
        ws.readyState === WebSocket.CONNECTING
      ) {
        ws.close();
      }
    };

    const sendToRelay = (token: string, last: boolean) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'text', token, last }));
      } else {
        console.warn(`websocket state no longer open: ${ws.readyState}`);
      }
    };

    const handleSetupMessage = (setupMessage: SetupMessage) => {
      if (realtime) {
        console.warn('Received a setup message for a callSid that already has been set up.');
        teardown('duplicate setup message received');
        return;
      }

      ({ callSid } = setupMessage);
      console.log(`CRelay setup for call ${callSid}`);

      realtime = new OpenAIRealtimeWS({ model: REALTIME_MODEL }, openai);

      // The constructor only *starts* the connection; the socket is still
      // CONNECTING here, and `OpenAIRealtimeWS.send` writes to the socket with
      // no readiness check, so sending now throws "WebSocket is not open". The
      // Realtime API emits `session.created` as its first server event once the
      // session is established - gate the first send on it.
      //
      // Configure the session for a text-only bridge. ConversationRelay already
      // does speech-to-text and text-to-speech and manages turn-taking, so we
      // restrict the model to text. We never write to the input audio buffer,
      // so server-side voice-activity turn detection never fires; turns are
      // driven explicitly by the `prompt`/`response.create` exchange below.
      realtime.on('session.created', () => {
        realtime?.send({
          type: 'session.update',
          session: {
            type: 'realtime',
            output_modalities: ['text'],
            instructions: INSTRUCTIONS,
          },
        });
      });

      // Forward each token to ConversationRelay as it streams from OpenAI.
      realtime.on('response.output_text.delta', (event) => {
        sendToRelay(event.delta, false);
      });

      // Mark the end of a turn once the response completes. `response.done`
      // fires for every terminal state: "completed", "cancelled", and "failed".
      // Therefore it is the single reliable signal that the session is free
      // again, and it covers the barge-in case (a `response.cancel` yields a
      // cancelled `response.done`). If a prompt arrived while we were
      // responding, drain it now: the old response has settled, so a fresh
      // `response.create` is safe.
      realtime.on('response.done', () => {
        sendToRelay('', true);

        if (turnState === 'pending') {
          turnState = 'responding';
          realtime?.send({ type: 'response.create' });
        } else {
          turnState = 'idle';
        }
      });

      realtime.on('error', (err) => {
        console.error('OpenAI Realtime error', err);
        // Close out the current turn so ConversationRelay is not left waiting,
        // then tear down - the session is no longer in a known-good state.
        sendToRelay('', true);
        teardown('openai realtime error');
      });

      // `OpenAIRealtimeWS` re-emits server *events* but not the underlying
      // socket's `close`, so we observe the raw socket directly. Without this,
      // an OpenAI-side disconnect (idle/session timeout, network) would go
      // unnoticed and the call would silently stop responding. Socket *errors*
      // need no such listener: the SDK attaches its own socket 'error' handler
      // that re-emits through the emitter-level `error` above, so they already
      // route through teardown (and never reach Node as an uncaught error).
      realtime.socket.on('close', () => teardown('openai socket closed'));

      // Heartbeat for the OpenAI side, mirroring the Twilio one below. The
      // realtime socket can go half-open (idle/NAT timeout, network partition)
      // with no close frame; the Twilio heartbeat cannot detect this because
      // Twilio stays healthy and keeps pong-ing while the caller hears dead
      // air. Pinging OpenAI directly and tearing down on missed pongs closes
      // that gap. We start it here, not at connection time, because the socket
      // only exists after setup.
      realtime.socket.on('pong', () => {
        openAiMissedPongs = 0;
      });
      openAiRealtimeHeartbeat = setInterval(() => {
        if (openAiMissedPongs >= MAX_MISSED_PONGS) {
          teardown('openai heartbeat timeout');
          return;
        }
        // Skip a tick while the socket is still CONNECTING (or already gone):
        // pinging a non-open socket throws, and an early miss would count
        // against a connection that is merely still handshaking.
        if (realtime?.socket.readyState !== WebSocket.OPEN) {
          return;
        }
        openAiMissedPongs += 1;
        try {
          realtime.socket.ping();
        } catch (err) {
          console.warn('Failed to ping OpenAI realtime socket', err);
          teardown('openai ping failed');
        }
      }, HEARTBEAT_INTERVAL_MS);
    };

    const handlePromptMessage = (promptMessage: PromptMessage) => {
      if (!realtime) {
        console.warn('Received prompt before setup');
        return;
      }

      // Make sure that the websocket is open. If not, defer the handling
      // of the prompt message until it is.
      if (realtime.socket.readyState !== WebSocket.OPEN) {
        console.log(
          'Socket was not ready when a prompt message came in. ' +
            'Defer handling until the session is created properly.',
        );
        realtime.once('session.created', () => {
          console.log(
            'Session properly created. Handling deferred prompt message.',
          );
          handlePromptMessage(promptMessage);
        });
        return;
      }

      // Append the caller's utterance to the conversation. This is always safe:
      // extra user items can accumulate in history while a response is in
      // flight, and a single later `response.create` answers all of them
      // coherently.
      realtime.send({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: promptMessage.voicePrompt }],
        },
      });

      // Only ask for a response if the session is free. If one is already
      // generating, mark the turn `pending` so the `response.done` handler
      // fires the `response.create` once it settles - this is what avoids the
      // overlapping-response rejection. Prompts that arrive while already
      // `pending` coalesce: their item is appended above and the single queued
      // `response.create` covers them.
      if (turnState === 'idle') {
        turnState = 'responding';
        realtime.send({ type: 'response.create' });
      } else {
        turnState = 'pending';
      }
    };

    const handleInterruptMessage = () => {
      // The caller spoke over the assistant. Cancel the in-flight response so
      // the model stops generating and is ready for the next prompt.
      if (!realtime) {
        console.warn('Received interrupt without ongoing realtime ws');
        return;
      }
      // Only cancel when something is actually generating. Cancelling with no
      // active response is itself an error (which would tear the call down), and
      // an interrupt while `idle` is a no-op. We do not clear the turn state
      // here: the cancel produces a cancelled `response.done`, and that handler
      // resets to `idle` (or drains a `pending` prompt) on our behalf.
      if (turnState !== 'idle') {
        realtime.send({ type: 'response.cancel' });
      }
    };

    const handleRawMessage = (data: WebSocket.RawData) => {
      // The raw websocket data can be a:
      // - string
      // - Buffer
      // - Array of Buffers
      // - An ArrayBuffer
      // This nested ternary handles all four cases and gets the data as a
      // string in textData.
      const textData = typeof data === 'string'
        ? data
        : Buffer.isBuffer(data)
          ? data.toString('utf8')
          : Array.isArray(data)
            ? Buffer.concat(data).toString('utf8')
            : Buffer.from(data).toString('utf8');

      let message: IncomingRelayMessage;
      try {
        message = JSON.parse(textData);
      } catch {
        console.warn('Failed to parse CRelay message');
        return;
      }

      switch (message.type) {
        case 'setup': {
          return handleSetupMessage(message);
        }
        case 'prompt': {
          return handlePromptMessage(message);
        }
        case 'interrupt': {
          return handleInterruptMessage();
        }
        default: {
          const _message: never = message;
          console.warn(`unknown message type "${(_message as any).type}"`);
        }
      }
    };

    ws.on('message', handleRawMessage);

    ws.on('close', () => teardown('twilio socket closed'));

    // `ws` extends Node's EventEmitter, which throws on an unhandled 'error'.
    // A routine peer reset would otherwise become an uncaught exception and
    // crash the whole process - taking down every other in-flight call. Routing
    // it through teardown both handles the event and cleans up this call.
    ws.on('error', (err) => {
      console.error('ConversationRelay socket error', err);
      teardown('twilio socket error');
    });

    // Heartbeat for the Twilio side: ConversationRelay answers our
    // protocol-level pings with pongs. If MAX_MISSED_PONGS elapse with no pong,
    // the peer is gone (half-open connection - no FIN, so 'close' never fires)
    // and we tear down to release the OpenAI socket rather than leak it.
    ws.on('pong', () => {
      twilioMissedPongs = 0;
    });
    twilioConversationRelayHeartbeat = setInterval(() => {
      if (twilioMissedPongs >= MAX_MISSED_PONGS) {
        teardown('twilio heartbeat timeout');
        return;
      }
      twilioMissedPongs += 1;
      try {
        ws.ping();
      } catch (err) {
        console.warn('Failed to ping ConversationRelay socket', err);
        teardown('twilio ping failed');
      }
    }, HEARTBEAT_INTERVAL_MS);
  });

  return wss;
};
