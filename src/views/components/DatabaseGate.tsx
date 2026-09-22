import React, { type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useDatabaseMigrations } from '../../data/db/migrations';

/** Holds the UI back until the schema is in place, and says so if it is not. */
export function DatabaseGate({ children }: { children: ReactNode }) {
  const { success, error } = useDatabaseMigrations();

  if (error) {
    return (
      <View style={styles.centre}>
        <Text style={styles.error}>Database could not be prepared</Text>
        <Text style={styles.detail}>{error.message}</Text>
      </View>
    );
  }

  if (!success) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator />
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  error: { fontSize: 16, color: '#a32d2d' },
  detail: { fontSize: 13, color: '#6b6b66', textAlign: 'center' },
});
