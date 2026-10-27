# Twilio Voice React Native Reference Components

Reference implementations showing how to build common Twilio Voice use cases with the Twilio Voice React Native SDK in an Expo app, paired with a Node.js backend.

## Community Contributions and Support

This repository is publicly available and maintained by Twilio under a limited external contribution model.

Due to limited maintenance capacity, external pull requests are not currently accepted.

GitHub Issues may be used to report reproducible bugs or provide feature feedback about these reference components. Issues are reviewed on a best-effort basis, with no SLA or guaranteed response.

GitHub Issues are not an official Twilio support channel. For production issues, general usage questions, or account-specific assistance, please contact [Twilio Support](https://help.twilio.com/). If you have a Twilio account manager, you may also escalate through them.

Do not share [Personally Identifiable Information (PII)](https://www.twilio.com/docs/glossary/what-is-personally-identifiable-information-pii) or sensitive account information, including access tokens, API keys, and credentials, in issues, logs, or screenshots.

For security vulnerabilities, follow the [security policy](SECURITY.md) and report privately through [Twilio's Vulnerability Disclosure Program](https://www.twilio.com/en-us/security/vulnerability-disclosure-program), rather than public GitHub Issues.

See [CONTRIBUTING.md](https://github.com/twilio/twilio-voice-react-native-reference-components/blob/main/CONTRIBUTING.md) for reporting guidance.

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

### 4. Provide a Google Services JSON file

A valid Google Services JSON file, which can be generated from a Firebase project, is required for the Twilio Voice RN SDK. Providing a valid `google-services.json` file in the root of the project folder (adjacent to `package.json`) is required for the prebuild step for Android platforms.

### 5. Start an HTTPS tunnel

In a separate terminal:

```bash
ngrok http 3030
```

Note the HTTPS forwarding URL ngrok prints. **Use your own URL in the steps below; do not use the example placeholders verbatim.**

### 6. Set the callback URL

In `url.env`, set `EXPO_PUBLIC_REFERENCE_COMPONENTS_DEV_SERVER_HOST` to your tunnel host **without the protocol**. Replace the example placeholder with your actual tunnel host:

```
EXPO_PUBLIC_REFERENCE_COMPONENTS_DEV_SERVER_HOST=<SOME-EXAMPLE-DOMAIN>.ngrok.app
```

### 7. Start the server

```bash
npm run server
```

### 8. Prebuild the client

```bash
npm run expo:prebuild
```

### 9. Run the client on a mobile device

- Open the `android/` folder in Android Studio to build and run the Android app.

- Open the `ios/<YOUR-BUNDLE-IDENTIFIER>.xcworkspace` in Xcode to build and run the iOS app.

## Running a component

### AI Conversation

1. In the Twilio Console, open your TwiML App and set (replace the example placeholder with your actual tunnel host):
   - **Voice Request URL**: `https://<YOUR-EXAMPLE-TUNNEL-HOST>.ngrok.app/ai-conversation/twiml`
   - **Method**: `POST`
2. Open the app and navigate to **AI Conversation**.
3. Tap **Connect to an Agent**. You should hear the welcome greeting, then be able to ask the assistant anything.
