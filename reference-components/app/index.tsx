/**
 * Copyright (C) 2026 Twilio, Inc.
 *
 * See LICENSE in the project root for license information.
 */

import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Link href="/ai-conversation" style={styles.link}>
        Talk to AI
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  link: {
    fontSize: 18,
    fontWeight: '600',
    color: '#208AEF',
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
});
