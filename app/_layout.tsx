import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BootstrapGate } from '../src/views/components/BootstrapGate';
import { theme } from '../src/views/theme';

function ImportAction() {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push('/import')} accessibilityRole="button" hitSlop={12}>
      <Text style={styles.headerAction}>Import</Text>
    </Pressable>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <BootstrapGate>
        <Stack screenOptions={{ headerTitleStyle: { fontSize: 17 } }}>
          <Stack.Screen
            name="index"
            options={{
              title: 'Products',
              // Reachable at any time, not only from the empty state: the shop
              // adds new ranges long after the first import.
              headerRight: () => <ImportAction />,
            }}
          />
          <Stack.Screen name="product/[id]" options={{ title: 'Product' }} />
          <Stack.Screen name="import" options={{ title: 'Import catalogue' }} />
        </Stack>
      </BootstrapGate>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  headerAction: { fontSize: 16, color: theme.accent },
});
