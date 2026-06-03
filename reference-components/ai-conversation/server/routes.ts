import { Router, type Request, type Response } from 'express';
import Twilio from 'twilio';
import { type ServerEnvironment } from '../../../server.ts';
import { COMPONENT_BASE_PATH } from './index.ts';

const { AccessToken } = Twilio.jwt;
const { VoiceResponse } = Twilio.twiml;

const WELCOME_GREETING = [
  'Hi!',
  'I am a React Native S D K voice assistant powered by Twilio and Open A I.',
  'Ask me anything!',
].join(' ');

export const createExpressRouter = (env: ServerEnvironment): Router => {
  const expressRouter: Router = Router();

  expressRouter.get('/token', (req: Request, res: Response) => {
    const identity = typeof req.query.identity === 'string'
      ? req.query.identity
      : undefined;

    if (typeof identity !== 'string' || identity.length === 0) {
      return res.status(400).json({
        error: 'identity query param must be non-empty string',
      });
    }

    const token = new AccessToken(
      env.TWILIO_ACCOUNT_SID,
      env.TWILIO_API_KEY_SID,
      env.TWILIO_API_KEY_SECRET,
      { identity }
    );

    const voiceGrant = new AccessToken.VoiceGrant({
      outgoingApplicationSid: env.TWILIO_TWIML_APP_SID,
      incomingAllow: true,
    });

    token.addGrant(voiceGrant);

    res
      .set('Cache-Control', 'no-store')
      .json({
        identity,
        token: token.toJwt(),
      });
  });

  expressRouter.post(
    '/twiml',
    Twilio.webhook({ protocol: 'https' }, env.TWILIO_AUTH_TOKEN),
    (_req: Request, res: Response) => {
      const twiml = new VoiceResponse();
      const connect = twiml.connect();

      connect.conversationRelay({
        url: `wss://${env.EXPO_PUBLIC_REFERENCE_COMPONENTS_DEV_SERVER_HOST}/${COMPONENT_BASE_PATH}`,
        welcomeGreeting: WELCOME_GREETING,
      });

      res.header('Content-Type', 'text/xml').status(200).send(twiml.toString());
    }
  );

  return expressRouter;
};
