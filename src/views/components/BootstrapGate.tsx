import React, { useCallback, useMemo, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { bootstrapApp } from '../../di/bootstrap';
import { createContainer } from '../../di/container';
import { ContainerProvider } from '../../di/provider';
import { useBootstrapViewModel } from '../../viewmodels/useBootstrapViewModel';
import { SetupScreen } from '../screens/SetupScreen';

/**
 * Holds the app behind start-up and first-run setup.
 *
 * The container is scoped to a shop and a device, so it cannot be built until
 * both exist. Nothing downstream has to defend against a missing identity.
 */
export function BootstrapGate({ children }: { children: ReactNode }) {
  const bootstrap = useCallback(() => bootstrapApp(), []);
  const vm = useBootstrapViewModel(bootstrap);

  const container = useMemo(
    () => (vm.runtime && vm.identity ? createContainer(vm.runtime, vm.identity) : null),
    [vm.runtime, vm.identity],
  );

  if (vm.isLoading) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!vm.runtime) {
    return (
      <View style={styles.centre}>
        <Text style={styles.error}>The app could not start</Text>
        <Text style={styles.detail}>{vm.error}</Text>
      </View>
    );
  }

  if (!container) {
    return (
      <SetupScreen
        onSubmit={(input) => void vm.submit(input)}
        isSubmitting={vm.isSubmitting}
        error={vm.error}
      />
    );
  }

  return <ContainerProvider container={container}>{children}</ContainerProvider>;
}

const styles = StyleSheet.create({
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
    backgroundColor: '#fbfbf9',
  },
  error: { fontSize: 16, color: '#a32d2d' },
  detail: { fontSize: 13, color: '#6b6b66', textAlign: 'center' },
});
