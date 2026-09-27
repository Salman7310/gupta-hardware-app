import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { unitFor } from '../../core';
import { Product } from '../../models/product';
import { useProductPickerViewModel } from '../../viewmodels/useProductPickerViewModel';
import { elevation, radius, size, space, theme, type } from '../theme';

interface Props {
  readonly onPick: (product: Product) => void;
  readonly onClose: () => void;
}

/** Choosing an item, for a bill or a quotation alike. */
export function ProductPicker({ onPick, onClose }: Props) {
  const picker = useProductPickerViewModel();
  // A bare Modal renders outside the navigator, so nothing here keeps the title
  // and Close button clear of the status bar and camera cutout. Pad by the real
  // inset rather than a guessed constant, which differs per device.
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.picker, { paddingTop: insets.top + space.lg }]}>
      <View style={styles.pickerHead}>
        <Text style={styles.pickerTitle}>Add an item</Text>
        <Pressable onPress={onClose} accessibilityRole="button" hitSlop={12}>
          <Text style={styles.close}>Close</Text>
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

const styles = StyleSheet.create({
  picker: { flex: 1, backgroundColor: theme.background },
  pickerHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.lg,
  },
  pickerTitle: { ...type.title, color: theme.text },
  close: { ...type.label, color: theme.accentInk },
  search: {
    margin: space.lg,
    paddingHorizontal: space.lg,
    height: size.tap,
    ...type.body,
    color: theme.text,
    backgroundColor: theme.surface,
    borderRadius: radius.md,
    ...elevation.card,
  },
  state: { marginTop: space.xxl, textAlign: 'center', ...type.body, color: theme.textMuted },
  pickRow: {
    paddingHorizontal: space.lg,
    minHeight: size.tap,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.md,
  },
  pickName: { flex: 1, ...type.body, color: theme.text },
  pickRate: { ...type.caption, color: theme.textMuted },
});
