import React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ALL_UNITS, UnitCode, unitFor } from '../../core';
import { CATEGORY_LABELS, ProductCategory } from '../../models/product';
import { useProductFormViewModel } from '../../viewmodels/useProductFormViewModel';
import { ChipSelector } from '../components/ChipSelector';
import { FormField } from '../components/FormField';
import { StockCard } from '../components/StockCard';
import { useConfirmLeave } from '../confirmLeave';
import { theme } from '../theme';

const CATEGORY_OPTIONS = (Object.keys(CATEGORY_LABELS) as ProductCategory[]).map((value) => ({
  value,
  label: CATEGORY_LABELS[value],
}));

/**
 * Examples that fit the product being entered. Every product once showed
 * "Vitrified tile 2x2" at ₹450, which on a tap or a tin of paint reads as a
 * mistake already made rather than a hint.
 */
const NAME_EXAMPLE: Record<ProductCategory, string> = {
  marble: 'Makrana white marble',
  granite: 'Black galaxy granite',
  tiles: 'Vitrified tile 2x2',
  putty: 'Birla wall putty 40kg',
  paint: 'Asian Paints Apex',
  sanitary: 'Jaquar pillar tap',
  other: 'Ultratech cement 50kg',
};

const RATE_EXAMPLE: Record<UnitCode, string> = {
  sqft: '120',
  box: '450',
  bag: '420',
  litre: '380',
  piece: '1250',
};

const UNIT_OPTIONS = ALL_UNITS.map((unit) => ({
  value: unit.code as UnitCode,
  label: unit.label,
}));

export function ProductFormScreen({
  productId,
  onSaved,
}: {
  productId: string | null;
  onSaved: () => void;
}) {
  const vm = useProductFormViewModel(productId);
  const unit = unitFor(vm.draft.unitCode);
  const allowLeave = useConfirmLeave(
    vm.isDirty,
    vm.isEditing ? 'Discard your changes?' : 'Discard this product?',
    'Nothing you typed here has been saved.',
  );

  if (vm.isLoading) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator />
      </View>
    );
  }

  if (vm.loadError) {
    return (
      <View style={styles.centre}>
        <Text style={styles.loadError}>{vm.loadError}</Text>
      </View>
    );
  }

  const submit = async () => {
    const saved = await vm.save();
    if (!saved) return;
    allowLeave();
    onSaved();
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {productId ? <StockCard productId={productId} /> : null}

        <FormField
          label="Product name"
          value={vm.draft.name}
          onChange={(v) => vm.setField('name', v)}
          placeholder={NAME_EXAMPLE[vm.draft.category]}
          error={vm.errors.name}
        />

        <ChipSelector
          label="Category"
          options={CATEGORY_OPTIONS}
          selected={vm.draft.category}
          onSelect={vm.setCategory}
        />

        <ChipSelector
          label="Sold by"
          options={UNIT_OPTIONS}
          selected={vm.draft.unitCode}
          onSelect={vm.setUnit}
        />

        <FormField
          label={`Rate per ${unit.label}`}
          value={vm.draft.salePrice}
          onChange={(v) => vm.setField('salePrice', v)}
          placeholder={RATE_EXAMPLE[vm.draft.unitCode]}
          keyboardType="decimal-pad"
          error={vm.errors.salePrice}
        />

        <FormField
          label="Cost price"
          value={vm.draft.purchasePrice}
          onChange={(v) => vm.setField('purchasePrice', v)}
          placeholder="Optional"
          keyboardType="decimal-pad"
          error={vm.errors.purchasePrice}
        />

        <FormField
          label="GST"
          value={vm.draft.taxPercent}
          onChange={(v) => vm.setField('taxPercent', v)}
          placeholder="18"
          keyboardType="decimal-pad"
          suffix="%"
          error={vm.errors.taxPercent}
          hint="Read this off an existing bill rather than guessing"
        />

        {/* Only boxed goods need a conversion; marble and paint never do. */}
        {unit.code === 'box' ? (
          <>
            <FormField
              label="Pieces per box"
              value={vm.draft.piecesPerBox}
              onChange={(v) => vm.setField('piecesPerBox', v)}
              placeholder="4"
              keyboardType="number-pad"
              error={vm.errors.piecesPerBox}
            />
            <FormField
              label="Square feet per box"
              value={vm.draft.sqftPerBox}
              onChange={(v) => vm.setField('sqftPerBox', v)}
              placeholder="16"
              keyboardType="decimal-pad"
              suffix="sq ft"
              error={vm.errors.sqftPerBox}
              hint="Lets the app answer how many boxes a room needs"
            />
          </>
        ) : null}

        <FormField
          label="Low stock alert"
          value={vm.draft.minStock}
          onChange={(v) => vm.setField('minStock', v)}
          placeholder="Optional"
          keyboardType="decimal-pad"
          suffix={unit.label}
          error={vm.errors.minStock}
        />

        <FormField
          label="HSN code"
          value={vm.draft.hsnCode}
          onChange={(v) => vm.setField('hsnCode', v)}
          placeholder="Optional"
          autoCapitalize="characters"
        />

        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={() => void submit()}
          disabled={vm.isSaving}
          accessibilityRole="button"
        >
          <Text style={styles.buttonLabel}>
            {vm.isSaving ? 'Saving…' : vm.isEditing ? 'Save changes' : 'Add product'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.background },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: theme.background,
  },
  container: { padding: 20, paddingBottom: 48 },
  loadError: { fontSize: 15, color: theme.danger, textAlign: 'center' },
  button: {
    marginTop: 8,
    paddingVertical: 16,
    borderRadius: 8,
    backgroundColor: theme.accent,
    alignItems: 'center',
  },
  buttonPressed: { opacity: 0.85 },
  buttonLabel: { fontSize: 16, color: theme.accentText },
});
