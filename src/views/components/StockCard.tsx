import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { KeyboardAware } from './KeyboardAware';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { unitFor } from '../../core';
import {
  ProductStockViewModel,
  StockAction,
  useProductStockViewModel,
} from '../../viewmodels/useProductStockViewModel';
import { card, radius, space, theme, type } from '../theme';
import { confirmDiscard } from '../confirmLeave';
import { FormField } from './FormField';

const COPY: Record<
  StockAction,
  { title: string; hint: string; field: string; save: string; saving: string }
> = {
  receive: {
    title: 'Receive stock',
    hint: 'A delivery that has come in. It is added to what is already on the shelf.',
    field: 'Quantity received',
    save: 'Add to stock',
    saving: 'Adding…',
  },
  count: {
    title: 'Correct the count',
    hint: 'Count what is on the shelf and enter it. The app records the difference, so its figure matches yours again. Past sales are not changed.',
    field: 'On the shelf now',
    save: 'Record the count',
    saving: 'Saving…',
  },
};

/**
 * What is on the shelf, and the two ways of changing it that are not a sale.
 *
 * At the top of the product, not at the foot of its form: receiving a
 * delivery is something the shop does every week, and an action placed below
 * a long form is an action nobody finds.
 */
export function StockCard({ productId }: { productId: string }) {
  const vm = useProductStockViewModel(productId);
  if (!vm.product || !vm.onHand) return null;

  const negative = vm.onHand.amount < 0;
  const figureStyle = negative ? styles.figureDanger : vm.isLow ? styles.figureLow : null;

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>STOCK</Text>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>In stock</Text>
        <Text style={[styles.figure, figureStyle]}>{vm.onHand.toDisplay()}</Text>
      </View>
      {negative ? (
        <Text style={styles.warn}>
          Below zero: more has been billed than was ever recorded coming in. Count the shelf
          and correct it.
        </Text>
      ) : vm.isLow ? (
        <Text style={styles.warn}>At or below the low-stock alert.</Text>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          onPress={() => vm.start('receive')}
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.primaryLabel}>+ Receive stock</Text>
        </Pressable>
        <Pressable
          onPress={() => vm.start('count')}
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryLabel}>Correct the count</Text>
        </Pressable>
      </View>

      {vm.confirmation ? <Text style={styles.confirmation}>{vm.confirmation}</Text> : null}

      <Modal visible={vm.action !== null} animationType="slide" onRequestClose={() => close(vm)}>
        {vm.action ? <StockSheet vm={vm} action={vm.action} /> : null}
      </Modal>
    </View>
  );
}

/** Closes the sheet, asking first if a quantity or note has been typed. */
function close(vm: ProductStockViewModel): void {
  confirmDiscard(
    vm.quantity.trim() !== '' || vm.note.trim() !== '',
    'Discard this entry?',
    'The stock has not been changed.',
    vm.cancel,
  );
}

function StockSheet({ vm, action }: { vm: ProductStockViewModel; action: StockAction }) {
  // A bare Modal renders outside the navigator, so nothing here keeps the
  // header clear of the status bar and camera cutout.
  const insets = useSafeAreaInsets();
  const copy = COPY[action];
  const unit = unitFor(vm.product!.unitCode);

  return (
    <KeyboardAware style={[styles.sheet, { paddingTop: insets.top + space.lg }]}>
      <View style={styles.sheetHead}>
        <Text style={styles.sheetTitle}>{copy.title}</Text>
        <Pressable onPress={() => close(vm)} accessibilityRole="button" hitSlop={12}>
          <Text style={styles.sheetAction}>Cancel</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
        <Text style={styles.productName}>{vm.product!.name}</Text>
        <Text style={styles.hint}>
          {copy.hint} The app has {vm.onHand!.toDisplay()} now.
        </Text>

        <FormField
          label={copy.field}
          value={vm.quantity}
          onChange={vm.setQuantity}
          placeholder={unit.entry === 'whole' ? '20' : '120.5'}
          keyboardType="decimal-pad"
          suffix={unit.label}
          error={vm.error ?? undefined}
        />

        {action === 'receive' ? (
          <FormField
            label="Note"
            value={vm.note}
            onChange={vm.setNote}
            placeholder="Optional, for example the supplier or their bill number"
          />
        ) : null}

        <Pressable
          onPress={() => void vm.confirm()}
          disabled={vm.isSaving}
          style={({ pressed }) => [styles.save, (pressed || vm.isSaving) && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.saveLabel}>{vm.isSaving ? copy.saving : copy.save}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAware>
  );
}

const styles = StyleSheet.create({
  card: { ...card, padding: space.lg, marginBottom: space.xl, gap: space.sm },
  heading: { ...type.micro, color: theme.textMuted, letterSpacing: 0.6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  rowLabel: { ...type.body, color: theme.textLabel },
  figure: { ...type.heading, color: theme.text },
  figureDanger: { color: theme.danger },
  figureLow: { color: theme.warningText },
  warn: { ...type.caption, color: theme.warningText, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  primary: {
    flex: 1,
    paddingVertical: space.md,
    borderRadius: radius.md,
    backgroundColor: theme.accentSurface,
    alignItems: 'center',
  },
  primaryLabel: { ...type.bodyStrong, color: theme.accentInk },
  secondary: {
    flex: 1,
    paddingVertical: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
  },
  secondaryLabel: { ...type.body, color: theme.text },
  pressed: { opacity: 0.8 },
  confirmation: { ...type.caption, color: theme.accentInk, lineHeight: 20 },

  sheet: { flex: 1, backgroundColor: theme.background, paddingHorizontal: space.lg },
  sheetHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.lg,
  },
  sheetTitle: { ...type.title, color: theme.text },
  sheetAction: { ...type.body, color: theme.accentInk },
  sheetBody: { paddingBottom: 48, gap: space.sm },
  productName: { ...type.bodyStrong, color: theme.text },
  hint: { ...type.caption, color: theme.textMuted, lineHeight: 20, marginBottom: space.sm },
  save: {
    marginTop: space.sm,
    paddingVertical: 16,
    borderRadius: radius.md,
    backgroundColor: theme.accent,
    alignItems: 'center',
  },
  saveLabel: { fontSize: 16, color: theme.accentText },
});
