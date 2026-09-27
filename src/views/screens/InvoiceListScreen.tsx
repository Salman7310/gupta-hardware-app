import React, { useCallback } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { PaymentState } from '../../models/invoice';
import { InvoiceListItem, useInvoiceListViewModel } from '../../viewmodels/useInvoiceListViewModel';
import { formatDate, formatTime } from '../format';
import { card, elevation, radius, size, space, theme, type } from '../theme';

interface Props {
  readonly onOpen: (invoiceId: string) => void;
  readonly onNewBill: () => void;
}

export function InvoiceListScreen({ onOpen, onNewBill }: Props) {
  const vm = useInvoiceListViewModel();
  const { refresh } = vm;

  // A bill written on the screen before this one must be here on return.
  // Depends on the stable command, never the ViewModel — see ProductListScreen.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  return (
    <View style={styles.screen}>
      <Body vm={vm} onOpen={onOpen} />

      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        onPress={onNewBill}
        accessibilityRole="button"
        accessibilityLabel="New bill"
      >
        <Text style={styles.fabLabel}>＋</Text>
      </Pressable>
    </View>
  );
}

function Body({
  vm,
  onOpen,
}: {
  vm: ReturnType<typeof useInvoiceListViewModel>;
  onOpen: (invoiceId: string) => void;
}) {
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
        <Text style={styles.customer} numberOfLines={1}>
          {item.customerName ?? 'Walk-in'}
        </Text>
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
  screen: { flex: 1, backgroundColor: theme.background },
  list: { backgroundColor: theme.background },
  // Clears the floating action, so the newest bill is never sitting under it.
  listContent: { padding: space.lg, paddingBottom: 110 },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xxl,
    backgroundColor: theme.background,
  },
  empty: { ...type.body, color: theme.textMuted, textAlign: 'center', lineHeight: 24 },
  error: { ...type.body, color: theme.danger, textAlign: 'center' },

  row: {
    ...card,
    minHeight: size.tap,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    marginBottom: space.sm,
  },
  rowMain: { flex: 1, gap: space.xs },
  rowSide: { alignItems: 'flex-end', gap: space.sm },
  customer: { ...type.bodyStrong, color: theme.text },
  number: { ...type.caption, color: theme.textLabel },
  when: { ...type.caption, color: theme.textMuted },
  total: { ...type.bodyStrong, color: theme.text },

  badge: {
    ...type.micro,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  fab: {
    position: 'absolute',
    right: space.xl,
    bottom: space.xxl,
    width: size.fab,
    height: size.fab,
    borderRadius: size.fab / 2,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.raised,
  },
  fabPressed: { backgroundColor: theme.accentPressed },
  fabLabel: { fontSize: 30, lineHeight: 34, color: theme.accentText },

  paid: { color: theme.accentInk, backgroundColor: theme.accentSurface },
  partial: { color: theme.warningText, backgroundColor: theme.warningBg },
  unpaid: { color: theme.danger, backgroundColor: theme.dangerSurface },
});
