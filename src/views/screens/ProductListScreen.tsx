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
import { BrandMark } from '../components/BrandMark';
import { elevation, radius, size, space, theme, type } from '../theme';

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
        returnKeyType="search"
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
          <View style={styles.emptyMark}>
            <BrandMark size={44} color={theme.accent} />
          </View>
          <Text style={styles.emptyTitle}>Your catalogue is empty</Text>
          <Text style={styles.emptyText}>
            Import the shop catalogue from a spreadsheet, or add the first product by hand.
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
    margin: space.lg,
    marginBottom: space.sm,
    paddingHorizontal: space.lg,
    height: size.tap,
    ...type.body,
    color: theme.text,
    backgroundColor: theme.surface,
    borderRadius: radius.md,
    ...elevation.card,
  },
  state: { marginTop: space.xxl, textAlign: 'center', ...type.body },
  muted: { color: theme.textMuted, paddingHorizontal: space.huge, lineHeight: 22 },
  error: { color: theme.danger },

  empty: { paddingHorizontal: space.huge, paddingTop: space.huge, alignItems: 'center' },
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
  emptyText: {
    ...type.body,
    color: theme.textMuted,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: space.xl,
  },
  secondary: {
    paddingHorizontal: space.xl,
    height: size.tap,
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: theme.accentSurface,
  },
  secondaryLabel: { ...type.label, color: theme.accentInk },

  listContent: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: 110 },

  // Sits above the list rather than in it, so the shop can add a product from
  // anywhere in a long catalogue without scrolling back.
  fab: {
    position: 'absolute',
    right: space.xl,
    bottom: space.xxl,
    width: size.fab,
    height: size.fab,
    borderRadius: size.fab / 2,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.raised,
  },
  fabPressed: { backgroundColor: theme.accentPressed },
  fabLabel: { fontSize: 30, lineHeight: 34, color: theme.accentText },
});
