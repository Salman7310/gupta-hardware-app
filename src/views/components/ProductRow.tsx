import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { unitFor } from '../../core';
import { CATEGORY_LABELS, Product } from '../../models/product';

export function ProductRow({ product }: { product: Product }) {
  const unit = unitFor(product.unitCode);
  return (
    <View style={styles.row}>
      <View style={styles.details}>
        <Text style={styles.name} numberOfLines={1}>
          {product.name}
        </Text>
        <Text style={styles.category}>{CATEGORY_LABELS[product.category]}</Text>
      </View>
      <Text style={styles.rate}>
        {product.salePrice.format()}
        <Text style={styles.unit}>/{unit.label}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d8d8d2',
  },
  details: { flex: 1, marginRight: 12 },
  name: { fontSize: 16, color: '#1a1a18' },
  category: { fontSize: 13, color: '#6b6b66', marginTop: 2 },
  rate: { fontSize: 16, color: '#1a1a18' },
  unit: { fontSize: 13, color: '#6b6b66' },
});
