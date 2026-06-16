/**
 * Copyright (C) 2026 Twilio, Inc.
 *
 * See LICENSE in the project root for license information.
 */

import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Reference Components' }} />
      <Stack.Screen name="ai-conversation" options={{ title: 'AI Conversation' }} />
    </Stack>
  );
}
