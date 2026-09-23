import React, { useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useProductListViewModel } from '../../viewmodels/useProductListViewModel';
import { ProductRow } from '../components/ProductRow';
import { theme } from '../theme';

interface Props {
  readonly onAdd: () => void;
  readonly onEdit: (productId: string) => void;
  readonly onImport: () => void;
}

export function ProductListScreen({ onAdd, onEdit, onImport }: Props) {
  const vm = useProductListViewModel();
  const { refresh } = vm;
  const isFirstFocus = useRef(true);

  // Returning from the form or the importer must show what changed. The first
  // focus is skipped because the ViewModel already loads on mount.
  //
  // Depends on `refresh`, which is stable, and never on `vm`: the ViewModel
  // returns a fresh object after every load, so depending on it would give this
  // effect a new identity each time, and useFocusEffect re-runs the callback on
  // every identity change while the screen is focused — refresh, load, refresh,
  // without end.
  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      refresh();
    }, [refresh]),
  );

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="Search products"
        placeholderTextColor={theme.textPlaceholder}
        value={vm.query}
        onChangeText={vm.setQuery}
        autoCorrect={false}
      />

      {vm.isLoading ? <ActivityIndicator style={styles.state} /> : null}
      {vm.error ? <Text style={[styles.state, styles.error]}>{vm.error}</Text> : null}
      {vm.hasNoResults ? (
        <Text style={[styles.state, styles.muted]}>No product matches that search.</Text>
      ) : null}

      {vm.isEmpty ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            No products yet. Import the shop catalogue from a spreadsheet, or add the first product
            by hand.
          </Text>
          <Pressable style={styles.secondary} onPress={onImport} accessibilityRole="button">
            <Text style={styles.secondaryLabel}>Import from CSV</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={vm.items}
          keyExtractor={(item) => item.product.id}
          renderItem={({ item }) => (
            <ProductRow item={item} onPress={() => onEdit(item.product.id)} />
          )}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
        />
      )}

      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        onPress={onAdd}
        accessibilityRole="button"
        accessibilityLabel="Add product"
      >
        <Text style={styles.fabLabel}>＋</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
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
  state: { marginTop: 24, textAlign: 'center', fontSize: 15 },
  muted: { color: theme.textMuted, paddingHorizontal: 32, lineHeight: 22 },
  error: { color: theme.danger },
  empty: { paddingHorizontal: 32, paddingTop: 24, alignItems: 'center', gap: 20 },
  emptyText: { fontSize: 15, color: theme.textMuted, textAlign: 'center', lineHeight: 22 },
  secondary: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.accent,
  },
  secondaryLabel: { fontSize: 15, color: theme.accent },
  listContent: { paddingBottom: 96 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabPressed: { opacity: 0.85 },
  fabLabel: { fontSize: 28, color: theme.accentText, lineHeight: 32 },
});
