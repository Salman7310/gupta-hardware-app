import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useBillStart } from '../../src/viewmodels/useBillStart';
import { BillScreen } from '../../src/views/screens/BillScreen';
import { theme } from '../../src/views/theme';

export default function BillRoute() {
  const router = useRouter();
  // Present when the customer accepted a quotation and has come back to buy.
  const { from } = useLocalSearchParams<{ from?: string }>();
  const { isLoading, start } = useBillStart(from);

  // The form is handed its contents once, when it mounts, so it cannot be
  // rendered before the quotation has been read back.
  if (isLoading) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator />
      </View>
    );
  }

  // Straight to the bill that was written, replacing the form so Back does not
  // reopen a draft that has already been saved.
  return (
    <BillScreen start={start} onSaved={(invoice) => router.replace(`/bill/${invoice.id}`)} />
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background },
});
