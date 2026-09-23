import React, { useCallback } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { PaymentState } from '../../models/invoice';
import { InvoiceListItem, useInvoiceListViewModel } from '../../viewmodels/useInvoiceListViewModel';
import { formatDate, formatTime } from '../format';
import { theme } from '../theme';

interface Props {
  readonly onOpen: (invoiceId: string) => void;
}

export function InvoiceListScreen({ onOpen }: Props) {
  const vm = useInvoiceListViewModel();
  const { refresh } = vm;

  // A bill written on the screen before this one must be here on return.
  // Depends on the stable command, never the ViewModel — see ProductListScreen.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  if (vm.isLoading) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator />
      </View>
    );
  }

  if (vm.error) {
    return (
      <View style={styles.centre}>
        <Text style={styles.error}>{vm.error}</Text>
      </View>
    );
  }

  if (vm.isEmpty) {
    return (
      <View style={styles.centre}>
        <Text style={styles.empty}>
          No bills yet. The bills you write will be listed here, newest first.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      data={vm.items}
      keyExtractor={(item) => item.invoice.id}
      contentContainerStyle={styles.listContent}
      renderItem={({ item }) => <Row item={item} onPress={() => onOpen(item.invoice.id)} />}
    />
  );
}

function Row({ item, onPress }: { item: InvoiceListItem; onPress: () => void }) {
  const { invoice } = item;

  return (
    <Pressable style={styles.row} onPress={onPress} accessibilityRole="button">
      <View style={styles.rowMain}>
        <Text style={styles.number}>{invoice.invoiceNo}</Text>
        <Text style={styles.when}>
          {formatDate(invoice.issuedAt)} · {formatTime(invoice.issuedAt)} · {invoice.items.length}{' '}
          {invoice.items.length === 1 ? 'item' : 'items'}
        </Text>
      </View>
      <View style={styles.rowSide}>
        <Text style={styles.total}>{invoice.grandTotal.format()}</Text>
        <PaymentBadge state={item.state} />
      </View>
    </Pressable>
  );
}

export function PaymentBadge({ state }: { state: PaymentState }) {
  const label = state === 'paid' ? 'Paid' : state === 'partial' ? 'Part paid' : 'Unpaid';
  return <Text style={[styles.badge, styles[state]]}>{label}</Text>;
}

const styles = StyleSheet.create({
  list: { backgroundColor: theme.background },
  listContent: { paddingBottom: 32 },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: theme.background,
  },
  empty: { fontSize: 15, color: theme.textMuted, textAlign: 'center', lineHeight: 22 },
  error: { fontSize: 15, color: theme.danger, textAlign: 'center' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  rowMain: { flex: 1, gap: 4 },
  rowSide: { alignItems: 'flex-end', gap: 6 },
  number: { fontSize: 16, color: theme.text },
  when: { fontSize: 13, color: theme.textMuted },
  total: { fontSize: 16, color: theme.text },

  badge: { fontSize: 12, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  paid: { color: theme.accent },
  partial: { color: theme.warningText, backgroundColor: theme.warningBg },
  unpaid: { color: theme.danger },
});
