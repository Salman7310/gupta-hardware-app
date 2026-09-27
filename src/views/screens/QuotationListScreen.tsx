import React, { useCallback } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { QuotationStatus } from '../../models/quotation';
import {
  QuotationListItem,
  useQuotationListViewModel,
} from '../../viewmodels/useQuotationListViewModel';
import { formatDate } from '../format';
import { card, elevation, radius, size, space, theme, type } from '../theme';

interface Props {
  readonly onOpen: (quotationId: string) => void;
  readonly onNewQuotation: () => void;
}

export function QuotationListScreen({ onOpen, onNewQuotation }: Props) {
  const vm = useQuotationListViewModel();
  const { refresh } = vm;

  // A quotation written on the screen before this one must be here on return.
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
        onPress={onNewQuotation}
        accessibilityRole="button"
        accessibilityLabel="New quotation"
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
  vm: ReturnType<typeof useQuotationListViewModel>;
  onOpen: (quotationId: string) => void;
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
          No quotations yet. When someone asks what a job would cost, price it up here and send
          them the estimate as a PDF.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      data={vm.items}
      keyExtractor={(item) => item.quotation.id}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={
        vm.openCount > 0 ? (
          <Text style={styles.summary}>
            {vm.openCount} {vm.openCount === 1 ? 'quotation is' : 'quotations are'} still standing.
          </Text>
        ) : null
      }
      renderItem={({ item }) => <Row item={item} onPress={() => onOpen(item.quotation.id)} />}
    />
  );
}

function Row({ item, onPress }: { item: QuotationListItem; onPress: () => void }) {
  const { quotation } = item;

  return (
    <Pressable style={styles.row} onPress={onPress} accessibilityRole="button">
      <View style={styles.rowMain}>
        <Text style={styles.customer} numberOfLines={1}>
          {item.customerName ?? 'Counter enquiry'}
        </Text>
        <Text style={styles.number}>{quotation.quotationNo}</Text>
        <Text style={styles.when}>
          {formatDate(quotation.issuedAt)} · {quotation.items.length}{' '}
          {quotation.items.length === 1 ? 'item' : 'items'}
        </Text>
        <Text style={styles.when}>{validityLine(item)}</Text>
      </View>
      <View style={styles.rowSide}>
        <Text style={styles.total}>{quotation.grandTotal.format()}</Text>
        <QuotationBadge status={item.status} />
      </View>
    </Pressable>
  );
}

/** Plain words rather than a date, because "2 days left" is what is being asked. */
function validityLine(item: QuotationListItem): string {
  if (item.status === 'accepted') return 'Billed';
  if (item.daysLeft < 0) return `Expired ${formatDate(item.quotation.validUntil)}`;
  if (item.daysLeft === 0) return 'Last day';
  return item.daysLeft === 1 ? '1 day left' : `${item.daysLeft} days left`;
}

const WORD: Record<QuotationStatus, string> = {
  open: 'Open',
  accepted: 'Accepted',
  expired: 'Expired',
};

export function QuotationBadge({ status }: { status: QuotationStatus }) {
  return <Text style={[styles.badge, styles[status]]}>{WORD[status]}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background },
  list: { backgroundColor: theme.background },
  // Clears the floating action, so the newest quotation is never under it.
  listContent: { padding: space.lg, paddingBottom: 110 },
  summary: { ...type.caption, color: theme.textMuted, marginBottom: space.md },
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
  open: { color: theme.warningText, backgroundColor: theme.warningBg },
  accepted: { color: theme.accentInk, backgroundColor: theme.accentSurface },
  expired: { color: theme.textMuted, backgroundColor: theme.surfaceSunken },

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
});
