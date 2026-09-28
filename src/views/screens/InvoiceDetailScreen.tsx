import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Money, formatDate, formatTime } from '../../core';
import { InvoiceItem } from '../../models/invoice';
import { PAYMENT_METHODS, Payment, paymentMethodLabel } from '../../models/payment';
import { InvoiceDetailViewModel, useInvoiceDetailViewModel } from '../../viewmodels/useInvoiceDetailViewModel';
import { ChipSelector } from '../components/ChipSelector';
import { AddItem, LineEntryRow, SaveBar, TotalRow } from '../components/LineEntry';
import { ProductPicker } from '../components/ProductPicker';
import { space, theme, type } from '../theme';
import { PaymentBadge } from './InvoiceListScreen';

interface Props {
  readonly invoiceId: string;
}

/**
 * A bill as it was written. Every figure is read back from what was stored,
 * never recalculated: a bill reprinted months later must say what the customer
 * was charged, even if a rate or a tax rate has moved since. What is owed is
 * the exception, because it falls as receipts are recorded against the bill.
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

  const { invoice, customer } = vm;
  const settled = !vm.due || vm.due.isZero();

  return (
    <>
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

        {/*
          WhatsApp gets its own row and the brand's green because it is what
          the shop actually uses to send a bill; Share and Save PDF are the
          fallbacks for everything else.
        */}
        {vm.canWhatsApp ? (
          <Pressable
            onPress={() => void vm.sendOnWhatsApp()}
            disabled={vm.isWhatsApping}
            style={({ pressed }) => [
              styles.whatsapp,
              (pressed || vm.isWhatsApping) && styles.whatsappPressed,
            ]}
            accessibilityRole="button"
          >
            <Text style={styles.whatsappLabel}>
              {vm.isWhatsApping
                ? 'Opening WhatsApp…'
                : vm.customer
                  ? `Send to ${vm.customer.name} on WhatsApp`
                  : 'Send on WhatsApp'}
            </Text>
          </Pressable>
        ) : null}

        <View style={styles.actions}>
          <Action label="Share bill" busy={vm.isSharing} onPress={vm.shareBill} primary />
          <Action label="Save PDF" busy={vm.isSavingPdf} onPress={vm.saveBill} />
        </View>

        {vm.fileError ? (
          <Pressable onPress={vm.dismissFileNotice}>
            <Text style={styles.fileError}>{vm.fileError}</Text>
          </Pressable>
        ) : null}
        {vm.savedTo ? (
          <Pressable onPress={vm.dismissFileNotice}>
            <Text style={styles.fileOk}>
              Saved to your bills folder. It stays there even if the app is removed.
            </Text>
          </Pressable>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.customerLabel}>Billed to</Text>
          <Text style={styles.customerName}>{customer ? customer.name : 'Walk-in customer'}</Text>
          {customer?.address ? <Text style={styles.customerMeta}>{customer.address}</Text> : null}
          {customer?.phone ? <Text style={styles.customerMeta}>{customer.phone}</Text> : null}
          {customer?.gstin ? (
            <Text style={styles.customerMeta}>GSTIN {customer.gstin}</Text>
          ) : null}
        </View>

        <View style={styles.card}>
          {invoice.items.map((item) => (
            <Line key={item.id} item={item} />
          ))}
          <Pressable
            onPress={vm.startAddingItems}
            style={styles.recordButton}
            accessibilityRole="button"
          >
            <Text style={styles.recordLabel}>+ Add more items to this bill</Text>
          </Pressable>
          {invoice.amendedAt ? (
            <Text style={styles.amended}>
              Items were added on {formatDate(invoice.amendedAt)} at{' '}
              {formatTime(invoice.amendedAt)}. The bill now shows the full amount.
            </Text>
          ) : null}
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

        <View style={styles.card}>
          <Text style={styles.customerLabel}>Payments</Text>
          {vm.payments.length === 0 ? (
            <Text style={styles.customerMeta}>Nothing received against this bill yet.</Text>
          ) : (
            vm.payments.map((payment) => <Receipt key={payment.id} payment={payment} />)
          )}

          {settled ? (
            <Text style={styles.settled}>This bill is settled in full.</Text>
          ) : (
            <Pressable
              onPress={vm.startRecording}
              style={styles.recordButton}
              accessibilityRole="button"
            >
              <Text style={styles.recordLabel}>+ Record a payment</Text>
            </Pressable>
          )}
        </View>

        {invoice.notes ? <Text style={styles.notes}>{invoice.notes}</Text> : null}
      </ScrollView>

      <Modal
        visible={vm.isRecording}
        animationType="slide"
        onRequestClose={vm.cancelRecording}
        transparent={false}
      >
        <RecordPayment vm={vm} />
      </Modal>

      <Modal visible={vm.isAdding} animationType="slide" onRequestClose={vm.cancelAddingItems}>
        <AddItemsSheet vm={vm} />
      </Modal>
    </>
  );
}

/**
 * Adding to a bill already issued, typed through the same rows as a new bill
 * so the shop is not learning a second way to enter an item.
 */
function AddItemsSheet({ vm }: { vm: InvoiceDetailViewModel }) {
  const insets = useSafeAreaInsets();
  const [isPicking, setIsPicking] = useState(false);
  const { adding } = vm;

  return (
    <View style={[styles.sheet, { paddingTop: insets.top + space.lg }]}>
      <View style={styles.sheetHead}>
        <Text style={styles.sheetTitle}>Add to this bill</Text>
        <Pressable onPress={vm.cancelAddingItems} accessibilityRole="button" hitSlop={12}>
          <Text style={styles.sheetAction}>Cancel</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
        <Text style={styles.addHint}>
          {vm.invoice?.invoiceNo} keeps its number. The total and the GST are worked out again
          over every item, and what is still owed goes up by what you add.
        </Text>

        {adding.isEmpty ? (
          <Text style={styles.addEmpty}>Nothing added yet.</Text>
        ) : (
          adding.lines.map((line) => (
            <LineEntryRow
              key={line.key}
              line={line}
              total={adding.lineTotals[line.key]?.total ?? null}
              onChange={(field, value) => adding.setLineField(line.key, field, value)}
              onRemove={() => adding.removeLine(line.key)}
              onDimensionChange={(dimensionKey, field, value) =>
                adding.setDimensionField(line.key, dimensionKey, field, value)
              }
              onAddDimension={() => adding.addDimension(line.key)}
              onRemoveDimension={(dimensionKey) => adding.removeDimension(line.key, dimensionKey)}
              onToggleMeasuring={(measured) => adding.setMeasuring(line.key, measured)}
            />
          ))
        )}

        <AddItem onPress={() => setIsPicking(true)} />

        {adding.isEmpty ? null : (
          <View style={styles.card}>
            <TotalRow label="Adding" value={adding.totals.grandTotal} emphasis />
          </View>
        )}

        {vm.addError ? <Text style={styles.fieldError}>{vm.addError}</Text> : null}
      </ScrollView>

      <SaveBar
        label={vm.isSavingItems ? 'Adding…' : 'Add to bill'}
        onPress={() => void vm.confirmAddedItems()}
        disabled={vm.isSavingItems || adding.isEmpty}
      />

      <Modal visible={isPicking} animationType="slide" onRequestClose={() => setIsPicking(false)}>
        <ProductPicker
          onPick={(product) => {
            adding.addProduct(product);
            setIsPicking(false);
          }}
          onClose={() => setIsPicking(false)}
        />
      </Modal>
    </View>
  );
}

function RecordPayment({ vm }: { vm: InvoiceDetailViewModel }) {
  // A bare Modal renders outside the navigator, so nothing here keeps the
  // header clear of the status bar and camera cutout.
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.sheet, { paddingTop: insets.top + space.lg }]}>
      <View style={styles.sheetHead}>
        <Text style={styles.sheetTitle}>Record a payment</Text>
        <Pressable onPress={vm.cancelRecording} accessibilityRole="button" hitSlop={12}>
          <Text style={styles.sheetAction}>Cancel</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
        {vm.due ? <Text style={styles.dueHint}>{vm.due.format()} still owed on this bill.</Text> : null}

        <Text style={styles.fieldLabel}>Amount received</Text>
        <TextInput
          style={styles.input}
          value={vm.draft.amount}
          onChangeText={vm.setAmount}
          placeholder="₹ 0.00"
          placeholderTextColor={theme.textPlaceholder}
          keyboardType="decimal-pad"
          autoFocus
        />
        {vm.errors.amount ? <Text style={styles.fieldError}>{vm.errors.amount}</Text> : null}

        <ChipSelector
          label="How it was paid"
          options={PAYMENT_METHODS.map((m) => ({ value: m, label: paymentMethodLabel(m) }))}
          selected={vm.draft.method}
          onSelect={vm.setMethod}
        />

        <Text style={styles.fieldLabel}>Note</Text>
        <TextInput
          style={styles.input}
          value={vm.draft.note}
          onChangeText={vm.setNote}
          placeholder="Optional, for example a cheque number"
          placeholderTextColor={theme.textPlaceholder}
        />

        <Pressable
          onPress={() => void vm.record()}
          disabled={vm.isSaving}
          style={({ pressed }) => [
            styles.save,
            pressed && styles.savePressed,
            vm.isSaving && styles.savePressed,
          ]}
          accessibilityRole="button"
        >
          <Text style={styles.saveLabel}>{vm.isSaving ? 'Saving…' : 'Record payment'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Action({
  label,
  busy,
  onPress,
  primary,
}: {
  label: string;
  busy: boolean;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [
        styles.action,
        primary && styles.actionPrimary,
        (pressed || busy) && styles.actionPressed,
      ]}
      accessibilityRole="button"
    >
      <Text style={[styles.actionLabel, primary && styles.actionLabelPrimary]}>
        {busy ? 'Working…' : label}
      </Text>
    </Pressable>
  );
}

function Receipt({ payment }: { payment: Payment }) {
  return (
    <View style={styles.totalRow}>
      <View style={styles.flex}>
        <Text style={styles.receiptWhen}>{formatDate(payment.receivedAt)}</Text>
        <Text style={styles.receiptHow}>
          {paymentMethodLabel(payment.method)}
          {payment.note ? ` · ${payment.note}` : ''}
        </Text>
      </View>
      <Text style={styles.totalValue}>{payment.amount.format()}</Text>
    </View>
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

  actions: { flexDirection: 'row', gap: 12 },
  action: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.borderStrong,
  },
  actionPrimary: { backgroundColor: theme.accent, borderColor: theme.accent },
  actionPressed: { opacity: 0.7 },
  actionLabel: { ...type.bodyStrong, color: theme.accentInk },
  actionLabelPrimary: { color: theme.accentText },

  whatsapp: {
    height: 52,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.whatsapp,
  },
  whatsappPressed: { backgroundColor: theme.whatsappPressed },
  whatsappLabel: { ...type.bodyStrong, color: theme.accentText },

  fileOk: { fontSize: 13, color: theme.accentInk },
  fileError: { fontSize: 13, color: theme.danger },

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

  receiptWhen: { fontSize: 14, color: theme.text },
  receiptHow: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  settled: { fontSize: 13, color: theme.accentInk },
  amended: { ...type.caption, color: theme.textMuted, lineHeight: 20 },
  addHint: { ...type.caption, color: theme.textMuted, lineHeight: 20 },
  addEmpty: { ...type.body, color: theme.textMuted, textAlign: 'center', paddingVertical: space.lg },
  recordButton: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordLabel: { ...type.bodyStrong, color: theme.accentInk },

  sheet: { flex: 1, backgroundColor: theme.background },
  sheetHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.lg,
  },
  sheetTitle: { ...type.title, color: theme.text },
  sheetAction: { ...type.label, color: theme.accentInk },
  sheetBody: { padding: space.lg, gap: space.sm },
  dueHint: { fontSize: 13, color: theme.textMuted, marginBottom: space.sm },
  fieldLabel: { ...type.label, color: theme.textLabel, marginTop: space.sm },
  input: {
    paddingHorizontal: space.lg,
    height: 52,
    ...type.body,
    color: theme.text,
    backgroundColor: theme.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
  },
  fieldError: { fontSize: 13, color: theme.danger },
  save: {
    marginTop: space.xl,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.accent,
  },
  savePressed: { backgroundColor: theme.accentPressed },
  saveLabel: { ...type.bodyStrong, color: theme.accentText },
});
