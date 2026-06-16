// @ts-check

/**
 * Copyright (C) 2026 Twilio, Inc.
 *
 * See LICENSE in the project root for license information.
 */

export default {
  expo: {
    name: 'twilio-voice-react-native-reference-components',
    slug: 'twilio-voice-react-native-reference-components',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'twiliovoicereactnativereferencecomponents',
    userInterfaceStyle: 'automatic',
    ios: {
      icon: './assets/expo.icon',
      appleTeamId: process.env.IOS_APPLE_TEAM_ID,
      bundleIdentifier: process.env.IOS_BUNDLE_IDENTIFIER,
      infoPlist: {
        NSMicrophoneUsageDescription: 'Voice calling capabilities.',
        UIBackgroundModes: ['audio', 'voip'],
      },
      entitlements: {
        'aps-environment': 'development',
      },
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
      package: process.env.ANDROID_PACKAGE,
      googleServicesFile: './google-services.json',
    },
    plugins: [
      [
        'expo-router',
        {
          root: './reference-components/app/',
        },
      ],
      [
        'expo-splash-screen',
        {
          backgroundColor: '#208AEF',
          android: {
            image: './assets/images/splash-icon.png',
            imageWidth: 76,
          },
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
  },
};
