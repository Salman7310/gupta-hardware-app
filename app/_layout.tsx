import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BootstrapGate } from '../src/views/components/BootstrapGate';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <BootstrapGate>
        <Stack screenOptions={{ headerTitleStyle: { fontSize: 17 } }}>
          <Stack.Screen name="index" options={{ title: 'Products' }} />
        </Stack>
      </BootstrapGate>
    </SafeAreaProvider>
  );
}
