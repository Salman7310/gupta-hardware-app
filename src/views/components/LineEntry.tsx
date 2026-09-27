import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Money, unitFor } from '../../core';
import { Customer } from '../../models/customer';
import { BillLineDraft, DimensionField, canMeasure, toQuantity } from '../../services/bill';
import { DimensionEntry } from './DimensionEntry';
import { card, elevation, radius, size, space, theme, type } from '../theme';

/**
 * The parts a document is typed with: who it is for, its lines, its fields and
 * the bar that saves it.
 *
 * A bill and a quotation are entered the same way, so they are drawn the same
 * way. Two copies of this would let the two screens drift, and a customer
 * being shown one layout for an estimate and another for the bill that follows
 * reads as two different shops.
 */

export function CustomerCard({
  customer,
  label,
  emptyLabel,
  onPress,
}: {
  customer: Customer | null;
  label: string;
  emptyLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.customer} onPress={onPress} accessibilityRole="button">
      <View style={styles.flex}>
        <Text style={styles.customerLabel}>{label}</Text>
        <Text style={styles.customerName}>{customer ? customer.name : emptyLabel}</Text>
        {/* Shown so the shop can see at a glance that it will reach the bill. */}
        {customer?.phone ? <Text style={styles.customerMeta}>{customer.phone}</Text> : null}
        {customer?.gstin ? <Text style={styles.customerMeta}>GSTIN {customer.gstin}</Text> : null}
      </View>
      <Text style={styles.customerAction}>{customer ? 'Change' : 'Add name & mobile'}</Text>
    </Pressable>
  );
}

export function LineEntryRow({
  line,
  total,
  error,
  onChange,
  onRemove,
  onDimensionChange,
  onAddDimension,
  onRemoveDimension,
  onToggleMeasuring,
}: {
  line: BillLineDraft;
  total: Money | null;
  error?: string;
  onChange: (field: 'quantity' | 'discountPercent', value: string) => void;
  onRemove: () => void;
  onDimensionChange: (dimensionKey: string, field: DimensionField, value: string) => void;
  onAddDimension: () => void;
  onRemoveDimension: (dimensionKey: string) => void;
  onToggleMeasuring: (measured: boolean) => void;
}) {
  const unit = unitFor(line.unitCode);
  const { measured } = line;

  return (
    <View style={styles.line}>
      <View style={styles.lineHead}>
        <View style={styles.flex}>
          <Text style={styles.lineName}>{line.name}</Text>
          <Text style={styles.lineRate}>
            {line.rate.format()}/{unit.label}
          </Text>
        </View>
        <Pressable onPress={onRemove} accessibilityRole="button" hitSlop={12}>
          <Text style={styles.remove}>Remove</Text>
        </Pressable>
      </View>

      {measured ? (
        <DimensionEntry
          dimensions={line.dimensions}
          area={toQuantity(line)}
          onChange={onDimensionChange}
          onAdd={onAddDimension}
          onRemove={onRemoveDimension}
        />
      ) : null}

      {/*
        Stone is usually billed from a figure the shop already has, so the
        plain total is the default and measuring is one tap away. The link
        stays visible in both directions so neither is a dead end.
      */}
      {canMeasure(line.unitCode) ? (
        <Pressable
          onPress={() => onToggleMeasuring(!measured)}
          accessibilityRole="button"
          hitSlop={8}
        >
          <Text style={styles.switchMode}>
            {measured
              ? `← Enter the total ${unit.label} instead`
              : `Measure pieces instead, length × width →`}
          </Text>
        </Pressable>
      ) : null}

      <View style={styles.lineInputs}>
        {measured ? null : (
          <View style={styles.flex}>
            <Text style={styles.smallLabel}>{canMeasure(line.unitCode) ? 'Area' : 'Quantity'}</Text>
            <View style={styles.inputBox}>
              <TextInput
                style={styles.input}
                value={line.quantity}
                onChangeText={(v) => onChange('quantity', v)}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={theme.textPlaceholder}
              />
              <Text style={styles.affix}>{unit.label}</Text>
            </View>
          </View>
        )}

        <View style={styles.flex}>
          <Text style={styles.smallLabel}>Discount</Text>
          <View style={styles.inputBox}>
            <TextInput
              style={styles.input}
              value={line.discountPercent}
              onChangeText={(v) => onChange('discountPercent', v)}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={theme.textPlaceholder}
            />
            <Text style={styles.affix}>%</Text>
          </View>
        </View>

        <View style={styles.lineTotal}>
          <Text style={styles.smallLabel}>Line total</Text>
          <Text style={styles.lineTotalValue}>{total ? total.format() : '—'}</Text>
        </View>
      </View>

      {error ? <Text style={styles.lineError}>{error}</Text> : null}
    </View>
  );
}

export function AddItem({ onPress }: { onPress: () => void }) {
  return (
    <Pressable style={styles.addItem} onPress={onPress} accessibilityRole="button">
      <Text style={styles.addItemLabel}>+ Add item</Text>
    </Pressable>
  );
}

export function EntryField({
  label,
  value,
  onChange,
  placeholder,
  prefix,
  suffix,
  hint,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  prefix?: string;
  suffix?: string;
  hint?: string;
  error?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputBox}>
        {prefix ? <Text style={styles.affix}>{prefix}</Text> : null}
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          keyboardType="decimal-pad"
          placeholder={placeholder}
          placeholderTextColor={theme.textPlaceholder}
        />
        {suffix ? <Text style={styles.affix}>{suffix}</Text> : null}
      </View>
      {hint && !error ? <Text style={styles.hint}>{hint}</Text> : null}
      {error ? <Text style={styles.lineError}>{error}</Text> : null}
    </View>
  );
}

export function TotalRow({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: Money;
  emphasis?: boolean;
}) {
  return (
    <View style={styles.totalRow}>
      <Text style={[styles.totalLabel, emphasis && styles.totalStrong]}>{label}</Text>
      <Text style={[styles.totalValue, emphasis && styles.totalStrong]}>{value.format()}</Text>
    </View>
  );
}

export function SaveBar({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.saveBar}>
      <Pressable
        style={({ pressed }) => [styles.save, pressed && styles.savePressed]}
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
      >
        <Text style={styles.saveLabel}>{label}</Text>
      </Pressable>
    </View>
  );
}

export const entryStyles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.background },
  content: { padding: space.lg, paddingBottom: space.huge, gap: space.lg },
  empty: {
    ...type.body,
    color: theme.textMuted,
    lineHeight: 24,
    textAlign: 'center',
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
  },
  totals: { ...card, padding: space.lg, gap: space.md },
  formError: { ...type.body, color: theme.danger, textAlign: 'center' },
  note: {
    ...card,
    padding: space.md,
    ...type.caption,
    color: theme.textMuted,
    lineHeight: 20,
    overflow: 'hidden',
  },
});

const styles = StyleSheet.create({
  flex: { flex: 1 },

  customer: {
    ...card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    minHeight: size.tap,
  },
  customerLabel: { ...type.micro, color: theme.textMuted },
  customerName: { ...type.bodyStrong, color: theme.text, marginTop: 2 },
  customerMeta: { ...type.micro, color: theme.textMuted, marginTop: 2 },
  customerAction: { ...type.label, color: theme.accentInk },

  line: { ...card, padding: space.lg, gap: space.md },
  lineHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  lineName: { ...type.bodyStrong, color: theme.text },
  lineRate: { ...type.caption, color: theme.textMuted, marginTop: 2 },
  remove: { ...type.label, color: theme.accentInk },
  switchMode: { ...type.caption, color: theme.accentInk },
  lineInputs: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  lineTotal: { flex: 1, alignItems: 'flex-end' },
  lineTotalValue: { ...type.bodyStrong, color: theme.text, paddingVertical: space.md },
  lineError: { ...type.caption, color: theme.danger },

  smallLabel: { ...type.micro, color: theme.textLabel, marginBottom: space.xs },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    minHeight: size.tap,
  },
  input: { flex: 1, ...type.body, color: theme.text, paddingVertical: space.md },
  affix: { ...type.caption, color: theme.textMuted },

  addItem: {
    height: size.tap,
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.borderStrong,
    alignItems: 'center',
    backgroundColor: theme.surface,
  },
  addItemLabel: { ...type.label, color: theme.accentInk },

  field: { gap: space.sm },
  label: { ...type.label, color: theme.textLabel },
  hint: { ...type.micro, color: theme.textMuted, lineHeight: 18 },

  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { ...type.caption, color: theme.textMuted },
  totalValue: { ...type.caption, color: theme.text },
  totalStrong: { ...type.title, color: theme.text },

  saveBar: {
    padding: space.lg,
    backgroundColor: theme.surface,
    ...elevation.raised,
  },
  save: {
    backgroundColor: theme.accent,
    borderRadius: radius.md,
    height: size.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savePressed: { backgroundColor: theme.accentPressed },
  saveLabel: { ...type.bodyStrong, color: theme.accentText },
});
