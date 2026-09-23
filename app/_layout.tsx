import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BootstrapGate } from '../src/views/components/BootstrapGate';
import { theme } from '../src/views/theme';

function ProductsActions() {
  const router = useRouter();
  return (
    <View style={styles.headerActions}>
      <Pressable onPress={() => router.push('/bill')} accessibilityRole="button" hitSlop={12}>
        <Text style={styles.headerAction}>New bill</Text>
      </Pressable>
      <Pressable onPress={() => router.push('/import')} accessibilityRole="button" hitSlop={12}>
        <Text style={styles.headerAction}>Import</Text>
      </Pressable>
    </View>
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
              headerRight: () => <ProductsActions />,
            }}
          />
          <Stack.Screen name="product/[id]" options={{ title: 'Product' }} />
          <Stack.Screen name="import" options={{ title: 'Import catalogue' }} />
          <Stack.Screen name="bill" options={{ title: 'New bill' }} />
        </Stack>
      </BootstrapGate>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', gap: 18 },
  headerAction: { fontSize: 16, color: theme.accent },
});
