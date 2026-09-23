import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Money } from '../../core';
import { InvoiceItem } from '../../models/invoice';
import { useInvoiceDetailViewModel } from '../../viewmodels/useInvoiceDetailViewModel';
import { formatDate, formatTime } from '../format';
import { theme } from '../theme';
import { PaymentBadge } from './InvoiceListScreen';

interface Props {
  readonly invoiceId: string;
}

/**
 * A bill as it was written. Every figure is read back from what was stored,
 * never recalculated: a bill reprinted months later must say what the customer
 * was charged, even if a rate or a tax rate has moved since.
 */
export function InvoiceDetailScreen({ invoiceId }: Props) {
  const vm = useInvoiceDetailViewModel(invoiceId);

  if (vm.isLoading) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!vm.invoice) {
    return (
      <View style={styles.centre}>
        <Text style={styles.error}>{vm.error}</Text>
      </View>
    );
  }

  const { invoice } = vm;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.head}>
        <View style={styles.flex}>
          <Text style={styles.number}>{invoice.invoiceNo}</Text>
          <Text style={styles.when}>
            {formatDate(invoice.issuedAt)} · {formatTime(invoice.issuedAt)}
          </Text>
        </View>
        {vm.state ? <PaymentBadge state={vm.state} /> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.customerLabel}>Billed to</Text>
        <Text style={styles.customerName}>{vm.customer ? vm.customer.name : 'Walk-in customer'}</Text>
        {vm.customer?.phone ? <Text style={styles.customerMeta}>{vm.customer.phone}</Text> : null}
        {vm.customer?.gstin ? (
          <Text style={styles.customerMeta}>GSTIN {vm.customer.gstin}</Text>
        ) : null}
      </View>

      <View style={styles.card}>
        {invoice.items.map((item) => (
          <Line key={item.id} item={item} />
        ))}
      </View>

      <View style={styles.card}>
        <Row label="Subtotal" value={invoice.subtotal} />
        {invoice.discount.isZero() ? null : (
          <Row label="Discount" value={invoice.discount.negate()} />
        )}
        {invoice.billDiscount.isZero() ? null : (
          <Row label="of which off the bill" value={invoice.billDiscount.negate()} muted />
        )}
        <Row label="Taxable" value={invoice.taxable} />
        <Row label="CGST" value={invoice.cgst} />
        <Row label="SGST" value={invoice.sgst} />
        {invoice.roundOff.isZero() ? null : <Row label="Round off" value={invoice.roundOff} />}
        <Row label="Total" value={invoice.grandTotal} emphasis />
        {invoice.paid.isZero() ? null : <Row label="Paid" value={invoice.paid} />}
        {vm.due && !vm.due.isZero() ? <Row label="Due" value={vm.due} emphasis /> : null}
      </View>

      {invoice.notes ? <Text style={styles.notes}>{invoice.notes}</Text> : null}
    </ScrollView>
  );
}

function Line({ item }: { item: InvoiceItem }) {
  const working = item.quantity.describeWorking();

  return (
    <View style={styles.line}>
      <View style={styles.flex}>
        <Text style={styles.lineName}>{item.name}</Text>
        <Text style={styles.lineDetail}>
          {item.quantity.toDisplay()} @ {item.rate.format()}
        </Text>
        {working ? <Text style={styles.working}>{working}</Text> : null}
        {item.discount.isZero() ? null : (
          <Text style={styles.working}>Less {item.discount.format()}</Text>
        )}
      </View>
      <Text style={styles.lineTotal}>{item.lineTotal.format()}</Text>
    </View>
  );
}

function Row({
  label,
  value,
  emphasis,
  muted,
}: {
  label: string;
  value: Money;
  emphasis?: boolean;
  muted?: boolean;
}) {
  return (
    <View style={styles.totalRow}>
      <Text style={[styles.totalLabel, emphasis && styles.strong, muted && styles.muted]}>
        {label}
      </Text>
      <Text style={[styles.totalValue, emphasis && styles.strong, muted && styles.muted]}>
        {value.format()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { backgroundColor: theme.background },
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: theme.background,
  },
  error: { fontSize: 15, color: theme.danger, textAlign: 'center' },

  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  number: { fontSize: 20, color: theme.text },
  when: { fontSize: 13, color: theme.textMuted, marginTop: 2 },

  card: {
    backgroundColor: theme.surface,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    padding: 14,
    gap: 10,
  },
  customerLabel: { fontSize: 12, color: theme.textMuted },
  customerName: { fontSize: 16, color: theme.text, marginTop: 2 },
  customerMeta: { fontSize: 13, color: theme.textMuted, marginTop: 2 },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  lineName: { fontSize: 15, color: theme.text },
  lineDetail: { fontSize: 13, color: theme.textMuted, marginTop: 2 },
  working: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  lineTotal: { fontSize: 15, color: theme.text },

  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { fontSize: 14, color: theme.textMuted },
  totalValue: { fontSize: 14, color: theme.text },
  strong: { fontSize: 17, color: theme.text },
  muted: { fontSize: 12, color: theme.textMuted },
  notes: { fontSize: 14, color: theme.textMuted, lineHeight: 20 },
});
