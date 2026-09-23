import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { unitFor } from '../../core';
import { CATEGORY_LABELS } from '../../models/product';
import { ProductListItem } from '../../viewmodels/useProductListViewModel';
import { card, radius, size, space, theme, type } from '../theme';

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
          <View style={[styles.stockPill, isLow && styles.stockPillLow]}>
            <Text style={[styles.stock, isLow && styles.stockLow]}>
              {isLow ? 'Low · ' : ''}
              {stock.toDisplay()}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.priceBlock}>
        <Text style={styles.rate}>{product.salePrice.format()}</Text>
        <Text style={styles.unit}>per {unit.label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    ...card,
    minHeight: size.tap,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    marginBottom: space.sm,
  },
  rowPressed: { backgroundColor: theme.surfaceSunken },
  details: { flex: 1, marginRight: space.md },
  name: { ...type.body, color: theme.text },
  meta: { flexDirection: 'row', alignItems: 'center', marginTop: space.xs, gap: space.sm },
  category: { ...type.caption, color: theme.textMuted },

  // The stock figure is what the shopkeeper scans the list for, so it is set
  // apart rather than left as another line of grey text beside the category.
  stockPill: {
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: theme.surfaceSunken,
  },
  stockPillLow: { backgroundColor: theme.warningBg },
  stock: { ...type.micro, color: theme.textMuted },
  stockLow: { color: theme.warningText },

  priceBlock: { alignItems: 'flex-end' },
  rate: { ...type.bodyStrong, color: theme.text },
  unit: { ...type.micro, color: theme.textMuted, marginTop: 2 },
});
