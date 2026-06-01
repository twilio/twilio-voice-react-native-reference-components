import type { IncomingMessage } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import OpenAI from 'openai';
import Twilio from 'twilio';
import { type ServerEnvironment } from '../../../server.ts';
import { COMPONENT_BASE_PATH } from './index.ts';

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

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
  | InterruptMessage
  | { type: string };

const SYSTEM_PROMPT: string = [
  'You are a helpful assistant.',
  'This conversation is being translated to voice, so answer carefully.',
  'When you respond, please spell out all numbers, for example twenty not 20.',
  'Do not include emojis in your responses.',
  'Do not include bullet points, asterisks, or special symbols.',
].join(' ');

const sessions = new Map<string, ChatMessage[]>();

const isCRelayConnection = (env: ServerEnvironment, req: IncomingMessage): boolean => {
  const signature = req.headers['x-twilio-signature'];
  if (typeof signature !== 'string') {
    return false;
  }

  return Twilio.validateRequest(
    env.TWILIO_AUTH_TOKEN,
    signature,
    `wss://${env.EXPO_PUBLIC_REFERENCE_COMPONENTS_DEV_SERVER_HOST}/${COMPONENT_BASE_PATH}`,
    {}
  );
};

export const createWebsocketServer = (env: ServerEnvironment): WebSocketServer => {
  const wss = new WebSocketServer({ noServer: true });
  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    if (!isCRelayConnection(env, req)) {
      console.warn('Rejecting WebSocket upgrade: invalid Twilio signature');
      ws.close(1008, 'Invalid Twilio signature');
      return;
    }

    console.log('ConversationRelay WebSocket connected');
    let callSid: string | undefined;

    ws.on('message', async (data) => {
      let message: IncomingRelayMessage;
      try {
        message = JSON.parse(data.toString());
      } catch {
        console.warn('Failed to parse CRelay message');
        return;
      }

      switch (message.type) {
        case 'setup': {
          const setup = message as SetupMessage;
          callSid = setup.callSid;
          console.log(`CRelay setup for call ${callSid}`);
          sessions.set(callSid, [{ role: 'system', content: SYSTEM_PROMPT }]);
          break;
        }
        case 'prompt': {
          const prompt = message as PromptMessage;
          if (!callSid) {
            console.warn('Received prompt before setup');
            return;
          }
          const conversation = sessions.get(callSid);
          if (!conversation) {
            console.warn(`No session for call ${callSid}`);
            return;
          }
          conversation.push({ role: 'user', content: prompt.voicePrompt });

          let collected = '';
          try {
            const stream = await openai.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: conversation,
              stream: true,
            });

            for await (const chunk of stream) {
              const token = chunk.choices[0]?.delta?.content;
              if (token) {
                ws.send(JSON.stringify({ type: 'text', token, last: false }));
                collected += token;
              }
            }
          } catch (err) {
            console.error('OpenAI stream error', err);
          } finally {
            ws.send(JSON.stringify({ type: 'text', token: '', last: true }));
          }

          if (collected) {
            conversation.push({ role: 'assistant', content: collected });
          }
          break;
        }
        case 'interrupt':
          console.log('CRelay interrupt');
          break;
        default:
          console.log(`Unknown CRelay message type: ${message.type}`);
      }
    });

    ws.on('close', () => {
      console.log(`CRelay WebSocket closed${callSid ? ` (call ${callSid})` : ''}`);
      if (callSid) sessions.delete(callSid);
    });
  });

  return wss;
};
