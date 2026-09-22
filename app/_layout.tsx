import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ContainerProvider } from '../src/di/provider';
import { DatabaseGate } from '../src/views/components/DatabaseGate';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <DatabaseGate>
        <ContainerProvider>
          <Stack screenOptions={{ headerTitleStyle: { fontSize: 17 } }}>
            <Stack.Screen name="index" options={{ title: 'Products' }} />
          </Stack>
        </ContainerProvider>
      </DatabaseGate>
    </SafeAreaProvider>
  );
}
