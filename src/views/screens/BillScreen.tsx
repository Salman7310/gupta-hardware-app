import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Money, unitFor } from '../../core';
import { Invoice } from '../../models/invoice';
import { Product } from '../../models/product';
import { BillLineDraft, DimensionField, isMeasured, toQuantity } from '../../services/bill';
import { DimensionEntry } from '../components/DimensionEntry';
import { useBillViewModel } from '../../viewmodels/useBillViewModel';
import { useProductPickerViewModel } from '../../viewmodels/useProductPickerViewModel';
import { theme } from '../theme';

interface Props {
  readonly onSaved: (invoice: Invoice) => void;
}

export function BillScreen({ onSaved }: Props) {
  const vm = useBillViewModel();
  const [isPicking, setIsPicking] = useState(false);

  const submit = async () => {
    const saved = await vm.save();
    if (saved) onSaved(saved);
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {vm.isEmpty ? (
          <Text style={styles.empty}>
            No items on this bill yet. Add the first one, and the total will follow as you type.
          </Text>
        ) : (
          vm.draft.lines.map((line) => (
            <LineRow
              key={line.key}
              line={line}
              total={vm.lineTotals[line.key]?.total ?? null}
              error={vm.errors.lines[line.key]}
              onChange={(field, value) => vm.setLineField(line.key, field, value)}
              onRemove={() => vm.removeLine(line.key)}
              onDimensionChange={(dimensionKey, field, value) =>
                vm.setDimensionField(line.key, dimensionKey, field, value)
              }
              onAddDimension={() => vm.addDimension(line.key)}
              onRemoveDimension={(dimensionKey) => vm.removeDimension(line.key, dimensionKey)}
            />
          ))
        )}

        <Pressable
          style={styles.addItem}
          onPress={() => setIsPicking(true)}
          accessibilityRole="button"
        >
          <Text style={styles.addItemLabel}>+ Add item</Text>
        </Pressable>

        <Field
          label="Discount on the whole bill"
          value={vm.draft.billDiscount}
          onChange={vm.setBillDiscount}
          placeholder="Optional"
          prefix="₹"
          error={vm.errors.billDiscount}
          hint="Spread across the items before GST, so the tax stays right"
        />

        <Field
          label="Amount paid"
          value={vm.draft.paid}
          onChange={vm.setPaid}
          placeholder="Optional"
          prefix="₹"
          error={vm.errors.paid}
        />

        <View style={styles.totals}>
          <TotalRow label="Subtotal" value={vm.totals.subtotal} />
          {vm.totals.discount.isZero() ? null : (
            <TotalRow label="Discount" value={vm.totals.discount.negate()} />
          )}
          <TotalRow label="Taxable" value={vm.totals.taxable} />
          <TotalRow label="CGST" value={vm.totals.cgst} />
          <TotalRow label="SGST" value={vm.totals.sgst} />
          {vm.totals.roundOff.isZero() ? null : (
            <TotalRow label="Round off" value={vm.totals.roundOff} />
          )}
          <TotalRow label="Total" value={vm.totals.grandTotal} emphasis />
        </View>

        {vm.errors.form ? <Text style={styles.formError}>{vm.errors.form}</Text> : null}
      </ScrollView>

      <View style={styles.saveBar}>
        <Pressable
          style={({ pressed }) => [styles.save, pressed && styles.savePressed]}
          onPress={() => void submit()}
          disabled={vm.isSaving}
          accessibilityRole="button"
        >
          <Text style={styles.saveLabel}>
            {vm.isSaving ? 'Saving…' : `Save bill · ${vm.totals.grandTotal.format()}`}
          </Text>
        </Pressable>
      </View>

      <Modal visible={isPicking} animationType="slide" onRequestClose={() => setIsPicking(false)}>
        <ProductPicker
          onPick={(product) => {
            vm.addProduct(product);
            setIsPicking(false);
          }}
          onClose={() => setIsPicking(false)}
        />
      </Modal>
    </KeyboardAvoidingView>
  );
}

function LineRow({
  line,
  total,
  error,
  onChange,
  onRemove,
  onDimensionChange,
  onAddDimension,
  onRemoveDimension,
}: {
  line: BillLineDraft;
  total: Money | null;
  error?: string;
  onChange: (field: 'quantity' | 'discountPercent', value: string) => void;
  onRemove: () => void;
  onDimensionChange: (dimensionKey: string, field: DimensionField, value: string) => void;
  onAddDimension: () => void;
  onRemoveDimension: (dimensionKey: string) => void;
}) {
  const unit = unitFor(line.unitCode);
  const measured = isMeasured(line.unitCode);

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

      <View style={styles.lineInputs}>
        {measured ? null : (
          <View style={styles.flex}>
            <Text style={styles.smallLabel}>Quantity</Text>
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

function TotalRow({ label, value, emphasis }: { label: string; value: Money; emphasis?: boolean }) {
  return (
    <View style={styles.totalRow}>
      <Text style={[styles.totalLabel, emphasis && styles.totalStrong]}>{label}</Text>
      <Text style={[styles.totalValue, emphasis && styles.totalStrong]}>{value.format()}</Text>
    </View>
  );
}

function ProductPicker({
  onPick,
  onClose,
}: {
  onPick: (product: Product) => void;
  onClose: () => void;
}) {
  const picker = useProductPickerViewModel();

  return (
    <View style={styles.picker}>
      <View style={styles.pickerHead}>
        <Text style={styles.pickerTitle}>Add an item</Text>
        <Pressable onPress={onClose} accessibilityRole="button" hitSlop={12}>
          <Text style={styles.remove}>Close</Text>
        </Pressable>
      </View>

      <TextInput
        style={styles.search}
        value={picker.query}
        onChangeText={picker.setQuery}
        placeholder="Search products"
        placeholderTextColor={theme.textPlaceholder}
        autoCorrect={false}
        autoFocus
      />

      {picker.isLoading ? <ActivityIndicator style={styles.state} /> : null}
      {picker.hasNoResults ? (
        <Text style={styles.state}>No product matches that search.</Text>
      ) : null}

      <FlatList
        data={picker.items}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <Pressable style={styles.pickRow} onPress={() => onPick(item)} accessibilityRole="button">
            <Text style={styles.pickName}>{item.name}</Text>
            <Text style={styles.pickRate}>
              {item.salePrice.format()}/{unitFor(item.unitCode).label}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  prefix,
  hint,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  prefix?: string;
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
      </View>
      {hint && !error ? <Text style={styles.hint}>{hint}</Text> : null}
      {error ? <Text style={styles.lineError}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 16 },
  empty: {
    fontSize: 15,
    color: theme.textMuted,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  line: {
    backgroundColor: theme.surface,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    padding: 14,
    gap: 12,
  },
  lineHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  lineName: { fontSize: 16, color: theme.text },
  lineRate: { fontSize: 13, color: theme.textMuted, marginTop: 2 },
  remove: { fontSize: 14, color: theme.accent },
  lineInputs: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  lineTotal: { flex: 1, alignItems: 'flex-end' },
  lineTotalValue: { fontSize: 16, color: theme.text, paddingVertical: 10 },
  lineError: { fontSize: 13, color: theme.danger },

  smallLabel: { fontSize: 12, color: theme.textLabel, marginBottom: 4 },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  input: { flex: 1, fontSize: 16, color: theme.text, paddingVertical: 10 },
  affix: { fontSize: 14, color: theme.textMuted },

  addItem: {
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.accent,
    alignItems: 'center',
  },
  addItemLabel: { fontSize: 15, color: theme.accent },

  field: { gap: 6 },
  label: { fontSize: 14, color: theme.textLabel },
  hint: { fontSize: 12, color: theme.textMuted, lineHeight: 18 },

  totals: {
    backgroundColor: theme.surface,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    padding: 14,
    gap: 8,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { fontSize: 14, color: theme.textMuted },
  totalValue: { fontSize: 14, color: theme.text },
  totalStrong: { fontSize: 17, color: theme.text },
  formError: { fontSize: 14, color: theme.danger, textAlign: 'center' },

  saveBar: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.border,
    backgroundColor: theme.background,
  },
  save: {
    backgroundColor: theme.accent,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  savePressed: { opacity: 0.85 },
  saveLabel: { fontSize: 16, color: theme.accentText },

  picker: { flex: 1, backgroundColor: theme.background, paddingTop: 16 },
  pickerHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  pickerTitle: { fontSize: 18, color: theme.text },
  search: {
    margin: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.text,
    backgroundColor: theme.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    borderRadius: 8,
  },
  state: { marginTop: 24, textAlign: 'center', fontSize: 15, color: theme.textMuted },
  pickRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  pickName: { flex: 1, fontSize: 16, color: theme.text },
  pickRate: { fontSize: 14, color: theme.textMuted },
});
