import React, { useCallback, useLayoutEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from 'expo-router';
import { Money, formatDate } from '../../core';
import { Quotation, QuotationItem } from '../../models/quotation';
import { useQuotationDetailViewModel } from '../../viewmodels/useQuotationDetailViewModel';
import { HeaderMenu } from '../components/HeaderMenu';
import { QuotationBadge } from './QuotationListScreen';
import { theme, type } from '../theme';

interface Props {
  readonly quotationId: string;
  readonly onMakeBill: (quotationId: string) => void;
  readonly onOpenBill: (invoiceId: string) => void;
  /** Called once the estimate is gone, so the screen showing it can close. */
  readonly onDeleted: () => void;
}

/**
 * An estimate as it was given.
 *
 * Every figure is read back from what was stored rather than recalculated: the
 * customer was quoted a price, and the shop stands behind that price until the
 * date on it passes, whatever the catalogue says by then.
 */
export function QuotationDetailScreen({
  quotationId,
  onMakeBill,
  onOpenBill,
  onDeleted,
}: Props) {
  const vm = useQuotationDetailViewModel(quotationId);
  const { refresh, canDelete, deleteQuotation } = vm;
  // Named apart from the narrowed `quotation` the body uses after its guard.
  const headerQuotation = vm.quotation;
  const navigation = useNavigation();

  // In the header, for the same reason as on a bill: at the foot of the screen
  // it is below the fold on any estimate with more than a couple of lines.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        headerQuotation && canDelete ? (
          <HeaderMenu
            actions={[
              {
                label: 'Delete this estimate',
                destructive: true,
                onPress: () => confirmDelete(headerQuotation, deleteQuotation, onDeleted),
              },
            ]}
          />
        ) : null,
    });
  }, [navigation, headerQuotation, canDelete, deleteQuotation, onDeleted]);

  // Billing this quotation happens on the screen after this one, so what came
  // back is stale by the time it is seen again. Depends on the stable command,
  // never the ViewModel — see InvoiceListScreen.
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

  if (!vm.quotation) {
    return (
      <View style={styles.centre}>
        <Text style={styles.error}>{vm.error}</Text>
      </View>
    );
  }

  const { quotation, customer } = vm;
  const billedAs = quotation.acceptedInvoiceId;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.head}>
        <View style={styles.flex}>
          <Text style={styles.number}>{quotation.quotationNo}</Text>
          <Text style={styles.when}>{formatDate(quotation.issuedAt)}</Text>
        </View>
        {vm.status ? <QuotationBadge status={vm.status} /> : null}
      </View>

      <Text style={vm.status === 'expired' ? styles.expiredNote : styles.validNote}>
        {vm.status === 'expired'
          ? `These prices stopped standing on ${formatDate(quotation.validUntil)}. Make a fresh quotation before you promise them again.`
          : `Prices hold until ${formatDate(quotation.validUntil)}.`}
      </Text>

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
              : customer
                ? `Send to ${customer.name} on WhatsApp`
                : 'Send on WhatsApp'}
          </Text>
        </Pressable>
      ) : null}

      <View style={styles.actions}>
        <Action label="Share quotation" busy={vm.isSharing} onPress={vm.shareQuotation} primary />
        <Action label="Save PDF" busy={vm.isSavingPdf} onPress={vm.saveQuotation} />
      </View>

      {vm.fileError ? (
        <Pressable onPress={vm.dismissFileNotice}>
          <Text style={styles.fileError}>{vm.fileError}</Text>
        </Pressable>
      ) : null}
      {vm.savedTo ? (
        <Pressable onPress={vm.dismissFileNotice}>
          <Text style={styles.fileOk}>
            Saved to your documents folder. It stays there even if the app is removed.
          </Text>
        </Pressable>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.label}>Quotation for</Text>
        <Text style={styles.customerName}>{customer ? customer.name : 'Counter enquiry'}</Text>
        {customer?.address ? <Text style={styles.meta}>{customer.address}</Text> : null}
        {customer?.phone ? <Text style={styles.meta}>{customer.phone}</Text> : null}
        {customer?.gstin ? <Text style={styles.meta}>GSTIN {customer.gstin}</Text> : null}
      </View>

      <View style={styles.card}>
        {quotation.items.map((item) => (
          <Line key={item.id} item={item} />
        ))}
      </View>

      <View style={styles.card}>
        <Row label="Subtotal" value={quotation.subtotal} />
        {quotation.discount.isZero() ? null : (
          <Row label="Discount" value={quotation.discount.negate()} />
        )}
        <Row label="Taxable" value={quotation.taxable} />
        <Row label="CGST" value={quotation.cgst} />
        <Row label="SGST" value={quotation.sgst} />
        {quotation.roundOff.isZero() ? null : <Row label="Round off" value={quotation.roundOff} />}
        <Row label="Estimated total" value={quotation.grandTotal} emphasis />
      </View>

      {billedAs ? (
        <Pressable
          style={styles.secondary}
          onPress={() => onOpenBill(billedAs)}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryLabel}>Open the bill this became</Text>
        </Pressable>
      ) : (
        <Pressable
          style={({ pressed }) => [styles.convert, pressed && styles.convertPressed]}
          onPress={() => onMakeBill(quotation.id)}
          accessibilityRole="button"
        >
          <Text style={styles.convertLabel}>Customer accepted · make this a bill</Text>
        </Pressable>
      )}

      {quotation.notes ? <Text style={styles.notes}>{quotation.notes}</Text> : null}

      <Text style={styles.terms}>
        This is an estimate, not a tax invoice. Nothing has been sold, no stock has moved and no
        tax has been charged.
      </Text>

      {vm.deleteError ? (
        <Pressable onPress={vm.dismissDeleteError}>
          <Text style={styles.deleteError}>{vm.deleteError}</Text>
        </Pressable>
      ) : null}
    </ScrollView>
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

function Line({ item }: { item: QuotationItem }) {
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

function Row({ label, value, emphasis }: { label: string; value: Money; emphasis?: boolean }) {
  return (
    <View style={styles.totalRow}>
      <Text style={[styles.totalLabel, emphasis && styles.strong]}>{label}</Text>
      <Text style={[styles.totalValue, emphasis && styles.strong]}>{value.format()}</Text>
    </View>
  );
}

/**
 * Deleting asks first and names the estimate, because it does not come back.
 * Nothing about it is reversible, but nothing about it is costly either — no
 * sale, no stock, no tax — so the question stays short.
 */
function confirmDelete(
  quotation: Quotation,
  deleteQuotation: () => Promise<boolean>,
  onDeleted: () => void,
): void {
  Alert.alert(
    `Delete ${quotation.quotationNo}?`,
    'The estimate is removed for good. Nothing was sold and no stock moves, so there is nothing else to undo.',
    [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteQuotation().then((gone) => {
            if (gone) onDeleted();
          });
        },
      },
    ],
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
  validNote: { ...type.caption, color: theme.accentInk },
  expiredNote: { ...type.caption, color: theme.danger, lineHeight: 20 },

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
  label: { fontSize: 12, color: theme.textMuted },
  customerName: { fontSize: 16, color: theme.text, marginTop: 2 },
  meta: { fontSize: 13, color: theme.textMuted, marginTop: 2 },

  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  lineName: { fontSize: 15, color: theme.text },
  lineDetail: { fontSize: 13, color: theme.textMuted, marginTop: 2 },
  working: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  lineTotal: { fontSize: 15, color: theme.text },

  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { fontSize: 14, color: theme.textMuted },
  totalValue: { fontSize: 14, color: theme.text },
  strong: { fontSize: 17, color: theme.text },
  notes: { fontSize: 14, color: theme.textMuted, lineHeight: 20 },
  deleteError: { ...type.caption, color: theme.danger, textAlign: 'center' },
  terms: { fontSize: 12, color: theme.textMuted, lineHeight: 18 },

  convert: {
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.accent,
  },
  convertPressed: { backgroundColor: theme.accentPressed },
  convertLabel: { ...type.bodyStrong, color: theme.accentText },
  secondary: {
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.borderStrong,
    backgroundColor: theme.surface,
  },
  secondaryLabel: { ...type.bodyStrong, color: theme.accentInk },
});
