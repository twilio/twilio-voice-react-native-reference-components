# Twilio Voice React Native Reference Components

Reference implementations showing how to build common Twilio Voice use cases with the Twilio Voice React Native SDK in an Expo app, paired with a Node.js backend.

## Available components

| Component | Description |
|---|---|
| **AI Conversation** | Outbound call to an AI voice agent powered by Twilio ConversationRelay and OpenAI. |

## Project layout

```
twilio-voice-rn-reference-components/
+-- ai-conversation/
|   +-- client/
|   +-- server/
```

During development, the Expo app and bundler are run side by side with the server.

## Prerequisites

- Node.js 22+
- A Twilio account
- An OpenAI API key (required by the AI Conversation component)
- An HTTPS tunnel to your local server (for example, ngrok)
- For the client: Xcode (iOS) or Android Studio (Android). Expo Go is not supported; a development build is required because the Twilio Voice React Native SDK includes native code.

## Setup

### 1. Clone

```bash
git clone <repo-url>
cd twilio-voice-rn-reference-components
```

### 2. Set up Twilio

In the Twilio Console:

1. Note your **Account SID** and **Auth Token**.
2. Create an **API Key** (Account -> API keys & tokens) and note the **SID** and **Secret**.
3. Create a **TwiML App** (Voice -> TwiML -> TwiML Apps). Leave the Voice Request URL blank for now; you will set it per-component below.

### 3. Configure secrets

```bash
cd server
npm install
cp example.env .env
```

Fill in your Twilio and OpenAI credentials in `.env`. Leave `CALLBACK_BASE_URL` blank for now; you will set it after starting the tunnel.

```
ACCOUNT_SID=...
AUTH_TOKEN=...
API_KEY_SID=...
API_KEY_SECRET=...
APP_SID=...
DEFAULT_IDENTITY=bob
OPENAI_API_KEY=...
IOS_BUNDLE_IDENTIFIER=...
ANDROID_PACKAGE_NAME=...

CALLBACK_BASE_URL=
```

### 4. Start an HTTPS tunnel

In a separate terminal:

```bash
ngrok http 3030
```

Note the HTTPS forwarding URL ngrok prints. **Use your own URL in the steps below; do not use the example placeholders verbatim.**

### 5. Set the callback URL

In `.env`, set `CALLBACK_BASE_URL` to your tunnel host **without the protocol**. Replace the example placeholder with your actual tunnel host:

```
CALLBACK_BASE_URL=<YOUR-EXAMPLE-TUNNEL-HOST>.ngrok.app
```

### 6. Start the server

```bash
npm run start-server
```

### 7. Run the client

```bash
npx expo run:ios
# or
npx expo run:android
```

## Running a component

### AI Conversation

1. In the Twilio Console, open your TwiML App and set (replace the example placeholder with your actual tunnel host):
   - **Voice Request URL**: `https://<YOUR-EXAMPLE-TUNNEL-HOST>.ngrok.app/ai-conversation/twiml`
   - **Method**: `POST`
2. Open the app and navigate to **AI Conversation**.
3. Tap **Connect to an Agent**. You should hear the welcome greeting, then be able to ask the assistant anything.
