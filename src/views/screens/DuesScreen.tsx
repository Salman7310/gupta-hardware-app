import React, { useCallback } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { formatDate } from '../../core';
import { CustomerDue, daysWaiting } from '../../services/dues';
import { useDuesViewModel } from '../../viewmodels/useDuesViewModel';
import { BrandMark } from '../components/BrandMark';
import { card, radius, size, space, theme, type } from '../theme';

interface Props {
  readonly onOpenBill: (invoiceId: string) => void;
}

/**
 * What the shop is owed, longest wait first.
 *
 * The question this answers is asked every morning and, before this screen,
 * could only be answered by opening bills one at a time.
 */
export function DuesScreen({ onOpenBill }: Props) {
  const vm = useDuesViewModel();
  const { refresh } = vm;

  // A payment recorded on a bill must show here on return.
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
        <View style={styles.emptyMark}>
          <BrandMark size={44} color={theme.accent} />
        </View>
        <Text style={styles.emptyTitle}>Nothing outstanding</Text>
        <Text style={styles.emptyText}>
          Every bill has been paid in full. Part payments you record will show up here.
        </Text>
      </View>
    );
  }

  const { total, billCount, customers } = vm.dues;

  return (
    <View style={styles.screen}>
      <View style={styles.banner}>
        <Text style={styles.bannerLabel}>Outstanding</Text>
        <Text style={styles.bannerTotal}>{total.format()}</Text>
        <Text style={styles.bannerMeta}>
          across {billCount} {billCount === 1 ? 'bill' : 'bills'} · {customers.length}{' '}
          {customers.length === 1 ? 'customer' : 'customers'}
        </Text>
      </View>

      <FlatList
        data={customers}
        keyExtractor={(item) => item.customerId ?? 'walk-in'}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <CustomerCard due={item} asOf={vm.asOf} onOpenBill={onOpenBill} />
        )}
      />
    </View>
  );
}

function CustomerCard({
  due,
  asOf,
  onOpenBill,
}: {
  due: CustomerDue;
  asOf: number;
  onOpenBill: (invoiceId: string) => void;
}) {
  const waiting = daysWaiting(due.oldestAt, asOf);

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.flex}>
          <Text style={styles.name}>{due.name}</Text>
          {due.phone ? <Text style={styles.phone}>{due.phone}</Text> : null}
        </View>
        <View style={styles.cardSide}>
          <Text style={styles.owed}>{due.outstanding.format()}</Text>
          <Text style={[styles.waiting, waiting >= 30 && styles.waitingLong]}>
            {waiting === 0 ? 'today' : waiting === 1 ? '1 day' : `${waiting} days`}
          </Text>
        </View>
      </View>

      {due.bills.map(({ invoice, due: owed }) => (
        <Pressable
          key={invoice.id}
          style={({ pressed }) => [styles.billRow, pressed && styles.billRowPressed]}
          onPress={() => onOpenBill(invoice.id)}
          accessibilityRole="button"
        >
          <View style={styles.flex}>
            <Text style={styles.billNo}>{invoice.invoiceNo}</Text>
            <Text style={styles.billWhen}>{formatDate(invoice.issuedAt)}</Text>
          </View>
          <Text style={styles.billOwed}>{owed.format()}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: theme.background },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xxl,
    backgroundColor: theme.background,
  },
  error: { ...type.body, color: theme.danger, textAlign: 'center' },

  emptyMark: {
    width: 88,
    height: 88,
    borderRadius: radius.xl,
    backgroundColor: theme.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xl,
  },
  emptyTitle: { ...type.title, color: theme.text, marginBottom: space.sm },
  emptyText: { ...type.body, color: theme.textMuted, textAlign: 'center', lineHeight: 24 },

  banner: {
    margin: space.lg,
    marginBottom: space.sm,
    padding: space.xl,
    borderRadius: radius.lg,
    backgroundColor: theme.accent,
  },
  bannerLabel: { ...type.micro, color: '#D6EFE5', textTransform: 'uppercase', letterSpacing: 0.6 },
  bannerTotal: { ...type.display, color: theme.accentText, marginTop: space.xs },
  bannerMeta: { ...type.caption, color: '#D6EFE5', marginTop: space.xs },

  listContent: { padding: space.lg, paddingTop: space.sm, paddingBottom: space.huge },

  card: { ...card, padding: space.lg, marginBottom: space.md, gap: space.sm },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  cardSide: { alignItems: 'flex-end' },
  name: { ...type.bodyStrong, color: theme.text },
  phone: { ...type.caption, color: theme.textMuted, marginTop: 2 },
  owed: { ...type.bodyStrong, color: theme.danger },
  waiting: { ...type.micro, color: theme.textMuted, marginTop: 2 },
  waitingLong: { color: theme.warningText },

  billRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: size.tap - 8,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    backgroundColor: theme.surfaceSunken,
  },
  billRowPressed: { opacity: 0.65 },
  billNo: { ...type.label, color: theme.text },
  billWhen: { ...type.micro, color: theme.textMuted, marginTop: 2 },
  billOwed: { ...type.label, color: theme.text },
});
