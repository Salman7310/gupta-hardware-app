import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BootstrapGate } from '../src/views/components/BootstrapGate';
import { screenOptions } from '../src/views/theme';

/**
 * The stack above the tabs.
 *
 * The four places the shop returns to live in the tab bar; everything here is
 * something it opens from one of them and comes back out of. Keeping them off
 * the tabs means a bill or a product form covers the bar rather than sitting
 * beside it, which is what makes going back feel like closing a thing.
 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <BootstrapGate>
        <Stack screenOptions={screenOptions}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="product/[id]" options={{ title: 'Product' }} />
          <Stack.Screen name="import" options={{ title: 'Import catalogue' }} />
          <Stack.Screen name="bill/new" options={{ title: 'New bill' }} />
          <Stack.Screen name="bill/[id]" options={{ title: 'Bill' }} />
          <Stack.Screen name="quote/new" options={{ title: 'New quotation' }} />
          <Stack.Screen name="quote/[id]" options={{ title: 'Quotation' }} />
        </Stack>
      </BootstrapGate>
    </SafeAreaProvider>
  );
}
