import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { unitFor } from '../../core';
import { CATEGORY_LABELS } from '../../models/product';
import { ProductListItem } from '../../viewmodels/useProductListViewModel';
import { theme } from '../theme';

export function ProductRow({ item, onPress }: { item: ProductListItem; onPress: () => void }) {
  const { product, stock, isLow } = item;
  const unit = unitFor(product.unitCode);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
    >
      <View style={styles.details}>
        <Text style={styles.name} numberOfLines={1}>
          {product.name}
        </Text>
        <View style={styles.meta}>
          <Text style={styles.category}>{CATEGORY_LABELS[product.category]}</Text>
          <Text style={[styles.stock, isLow && styles.stockLow]}>
            {isLow ? 'Low: ' : ''}
            {stock.toDisplay()} in stock
          </Text>
        </View>
      </View>
      <Text style={styles.rate}>
        {product.salePrice.format()}
        <Text style={styles.unit}>/{unit.label}</Text>
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  rowPressed: { backgroundColor: '#f1efe8' },
  details: { flex: 1, marginRight: 12 },
  name: { fontSize: 16, color: theme.text },
  meta: { flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 8 },
  category: { fontSize: 13, color: theme.textMuted },
  stock: { fontSize: 13, color: theme.textMuted },
  stockLow: { color: theme.warningText },
  rate: { fontSize: 16, color: theme.text },
  unit: { fontSize: 13, color: theme.textMuted },
});
