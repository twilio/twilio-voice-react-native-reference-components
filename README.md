# Twilio Voice React Native Reference Components

Reference implementations showing how to build common Twilio Voice use cases with the Twilio Voice React Native SDK in an Expo app, paired with a Node.js backend.

## Available components

| Component | Description |
|---|---|
| **AI Conversation** | Outbound call to an AI voice agent powered by Twilio ConversationRelay and OpenAI. |

## Project layout

```
twilio-voice-react-native-reference-components/
|
+-- secrets.example.env          # configuration file for server-side and mobile-app secrets
|
+-- url.example.env              # configuration file for the reference component dev server url
|
+-- app.config.mjs               # expo configuration file
|
+-- server.ts                    # reference component dev server
|
+-- reference-components/
|
|   +-- app/                     # not a reference component, required for Expo Router structure
|   |   +-- _layout.tsx          # required for Expo Router structure
|   |   +-- index.tsx            # required for Expo Router structure
|   |   +-- ai-conversation.tsx  # links the AI Conversation Component to Expo Router
|
|   +-- ai-conversation/         # AI Conversation Reference Component
|   |   +-- client/              # Expo code, such as React hooks and components
|   |   +-- server/              # Express and websocket code
```

During development, the Expo app and bundler are run side by side with the server.

## Prerequisites

- Node.js 24+
- A Twilio account
- An OpenAI API key (required by the AI Conversation component)
- An HTTPS tunnel to your local server (for example, ngrok)
- For the client: Xcode (iOS) or Android Studio (Android). Expo Go is not supported; a development build is required because the Twilio Voice React Native SDK includes native code.

## Setup

### 1. Clone

```bash
git clone <repo-url>
cd twilio-voice-react-native-reference-components
```

### 2. Set up Twilio

In the Twilio Console:

1. Note your **Account SID** and **Auth Token**.
2. Create an **API Key** (Account -> API keys & tokens) and note the **SID** and **Secret**.
3. Create a **TwiML App** (Voice -> TwiML -> TwiML Apps). Leave the Voice Request URL blank for now; you will set it per-component below.

### 3. Configure secrets

```bash
npm install
cp secrets.example.env secrets.env
cp url.example.env url.env
```

Fill in the environment variables in `secrets.env`.

### 4. Start an HTTPS tunnel

In a separate terminal:

```bash
ngrok http 3030
```

Note the HTTPS forwarding URL ngrok prints. **Use your own URL in the steps below; do not use the example placeholders verbatim.**

### 5. Set the callback URL

In `url.env`, set `EXPO_PUBLIC_REFERENCE_COMPONENTS_DEV_SERVER_HOST` to your tunnel host **without the protocol**. Replace the example placeholder with your actual tunnel host:

```
EXPO_PUBLIC_REFERENCE_COMPONENTS_DEV_SERVER_HOST=<SOME-EXAMPLE-DOMAIN>.ngrok.app
```

### 6. Start the server

```bash
npm run server
```

### 7. Prebuild the client

```bash
npm run expo:prebuild
```

### 8. Run the client on a mobile device

- Open the `android/` folder in Android Studio to build and run the Android app.

- Open the `ios/<YOUR-BUNDLE-IDENTIFIER>.xcworkspace` in Xcode to build and run the iOS app.

## Running a component

### AI Conversation

1. In the Twilio Console, open your TwiML App and set (replace the example placeholder with your actual tunnel host):
   - **Voice Request URL**: `https://<YOUR-EXAMPLE-TUNNEL-HOST>.ngrok.app/ai-conversation/twiml`
   - **Method**: `POST`
2. Open the app and navigate to **AI Conversation**.
3. Tap **Connect to an Agent**. You should hear the welcome greeting, then be able to ask the assistant anything.
