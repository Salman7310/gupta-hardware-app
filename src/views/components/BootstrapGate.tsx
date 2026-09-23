import React, { useCallback, useMemo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { bootstrapApp } from '../../di/bootstrap';
import { createContainer } from '../../di/container';
import { ContainerProvider } from '../../di/provider';
import { useBootstrapViewModel } from '../../viewmodels/useBootstrapViewModel';
import { LaunchScreen } from '../screens/LaunchScreen';
import { SetupScreen } from '../screens/SetupScreen';
import { space, theme, type } from '../theme';

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
    return <LaunchScreen message="Unlocking your shop's data" />;
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
    padding: space.xxl,
    gap: space.sm,
    backgroundColor: theme.background,
  },
  error: { ...type.heading, color: theme.danger },
  detail: { ...type.caption, color: theme.textMuted, textAlign: 'center' },
});
