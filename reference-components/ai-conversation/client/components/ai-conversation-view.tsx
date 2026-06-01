import { Call, Voice } from '@twilio/voice-react-native-sdk';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Status = 'idle' | 'connecting' | 'in-call' | 'error';

const SERVER_HOST = process.env.EXPO_PUBLIC_REFERENCE_COMPONENTS_DEV_SERVER_HOST;
const IDENTITY = 'reference-components-user';

async function fetchToken(): Promise<string> {
  if (!SERVER_HOST) {
    throw new Error('EXPO_PUBLIC_REFERENCE_COMPONENTS_DEV_SERVER_HOST is not set');
  }

  const res = await fetch(
    `https://${SERVER_HOST}/ai-conversation/token?identity=${encodeURIComponent(IDENTITY)}`
  );
  if (!res.ok) {
    throw new Error(`Token request failed: ${res.status}`);
  }

  const json = (await res.json()) as { token: string };
  return json.token;
}

export function AiConversationView() {
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const voiceRef = useRef<Voice | null>(null);
  const callRef = useRef<Call | null>(null);

  useEffect(() => {
    voiceRef.current = new Voice();
    return () => {
      callRef.current?.disconnect().catch(() => {});
    };
  }, []);

  async function handleConnect() {
    if (!voiceRef.current) return;
    setErrorMessage(null);
    setStatus('connecting');

    try {
      const token = await fetchToken();
      const call = await voiceRef.current.connect(token);
      callRef.current = call;

      call.on(Call.Event.Connected, () => setStatus('in-call'));
      call.on(Call.Event.Disconnected, () => {
        callRef.current = null;
        setStatus('idle');
      });
      call.on(Call.Event.ConnectFailure, (error) => {
        callRef.current = null;
        setErrorMessage(error.message);
        setStatus('error');
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setErrorMessage(message);
      setStatus('error');
    }
  }

  async function handleHangup() {
    try {
      await callRef.current?.disconnect();
    } catch {
      // disconnect errors are non-fatal; the Disconnected event will still fire
    }
  }

  const showConnect = status === 'idle' || status === 'error';

  return (
    <View style={styles.container}>
      <Text style={styles.status}>Status: {status}</Text>

      {errorMessage && <Text style={styles.error}>{errorMessage}</Text>}

      {showConnect ? (
        <Pressable style={styles.button} onPress={handleConnect}>
          <Text style={styles.buttonText}>Connect to an Agent</Text>
        </Pressable>
      ) : (
        <Pressable
          style={[styles.button, styles.hangupButton]}
          onPress={handleHangup}
          disabled={status === 'connecting'}
        >
          <Text style={styles.buttonText}>Hang up</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 24,
  },
  status: {
    fontSize: 16,
  },
  error: {
    color: '#D14343',
    fontSize: 14,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#208AEF',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 8,
  },
  hangupButton: {
    backgroundColor: '#D14343',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
