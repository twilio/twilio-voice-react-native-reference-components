import http from 'node:http';
import express from 'express';

import * as aiConversationComponent from './reference-components/ai-conversation/server/index.ts';

const REQUIRED_SERVER_ENV = [
  'EXPO_PUBLIC_REFERENCE_COMPONENTS_DEV_SERVER_HOST',
  'OPENAI_API_KEY',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_API_KEY_SID',
  'TWILIO_API_KEY_SECRET',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_TWIML_APP_SID',
] as const;

type RequiredEnvKey = (typeof REQUIRED_SERVER_ENV)[number];

export type ServerEnvironment = Readonly<
  & { [K in RequiredEnvKey]: string }
  & { PORT: number; }
>;

/**
 * Loads, validates, and returns the server environment. This is the single
 * entry point for env access — pass the returned object to consumers
 * (e.g. `createHttpServer`) instead of reading `process.env` elsewhere.
 *
 * @throws if any required variable is missing.
 */
const loadServerEnvironment = (): ServerEnvironment => {
  const missing = REQUIRED_SERVER_ENV.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required env var(s): ${missing.join(', ')}`);
  }

  const secrets = Object.fromEntries(
    REQUIRED_SERVER_ENV.map((name) => [name, process.env[name]])
  ) as { [K in RequiredEnvKey]: string };

  const PORT = Number(process.env.PORT ?? 3030);
  if (!Number.isInteger(PORT) || PORT < 0 || PORT > 65535) {
    throw new Error('Invalid PORT value.');
  }

  return {
    ...secrets,
    PORT,
  };
};

const createExpressApp = (env: ServerEnvironment) => {
  const expressApp = express();

  expressApp.use(express.urlencoded({ extended: false }));
  expressApp.use(express.json());

  expressApp.use(
    `/${aiConversationComponent.COMPONENT_BASE_PATH}`,
    aiConversationComponent.createExpressRouter(env)
  );

  return expressApp;
};

const createHttpServer = (env: ServerEnvironment) => {
  const httpServer = http.createServer(createExpressApp(env));

  // One WebSocketServer per component, created up front in `noServer` mode so they
  // can share a single HTTP upgrade handler. Add future components alongside this.
  const aiConversationWss = aiConversationComponent.createWebsocketServer(env);

  httpServer.on('upgrade', (req, socket, head) => {
    let pathname: string;
    try {
      ({ pathname } = new URL(req.url ?? '', `http://${req.headers.host}`));
    } catch {
      // A malformed request target or Host header makes `new URL` throw. Reject
      // just this handshake - because both inputs are client-controlled and this
      // runs before any per-connection error handling, an uncaught throw here
      // would crash the process and drop every in-flight call, turning one bad
      // upgrade into a server-wide outage.
      socket.destroy();
      return;
    }

    switch (pathname) {
      case `/${aiConversationComponent.COMPONENT_BASE_PATH}`:
        if (!aiConversationComponent.isCRelayConnection(env, req)) {
          console.warn('Rejecting WebSocket upgrade: invalid Twilio signature');
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }
        aiConversationWss.handleUpgrade(req, socket, head, (ws) => {
          aiConversationWss.emit('connection', ws, req);
        });
        break;
      default:
        socket.destroy(); // no component owns this path
    }
  });

  return httpServer;
};

const env = loadServerEnvironment();

createHttpServer(env).listen(env.PORT, () => {
  console.log('Server listening');
  console.log(`Public callback base: ${env.EXPO_PUBLIC_REFERENCE_COMPONENTS_DEV_SERVER_HOST}`);
});
