import React from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useProductListViewModel } from '../../viewmodels/useProductListViewModel';
import { ProductRow } from '../components/ProductRow';

/**
 * View: renders the ViewModel and forwards input to it. No business rules,
 * no data access, no formatting decisions of its own.
 */
export function ProductListScreen() {
  const vm = useProductListViewModel();

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="Search products"
        placeholderTextColor="#8d8d86"
        value={vm.query}
        onChangeText={vm.setQuery}
        autoCorrect={false}
      />

      {vm.isLoading ? <ActivityIndicator style={styles.state} /> : null}
      {vm.error ? <Text style={[styles.state, styles.error]}>{vm.error}</Text> : null}
      {vm.isEmpty ? (
        <Text style={[styles.state, styles.muted]}>
          No products yet. Import the shop catalogue to get started.
        </Text>
      ) : null}

      <FlatList
        data={vm.products}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <ProductRow product={item} />}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fbfbf9' },
  search: {
    margin: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1a1a18',
    backgroundColor: '#ffffff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d8d8d2',
    borderRadius: 8,
  },
  state: { marginTop: 24, textAlign: 'center', fontSize: 15 },
  muted: { color: '#6b6b66', paddingHorizontal: 32, lineHeight: 22 },
  error: { color: '#a32d2d' },
});
