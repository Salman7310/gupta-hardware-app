import React from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * The Gupta Hardware mark: four tiles with the last one not yet laid.
 *
 * Drawn from Views rather than an image so it stays sharp at any size and
 * takes its colour from the caller — the same mark sits on the green launch
 * screen and, one day, at the top of a printed bill.
 */
export function BrandMark({ size = 72, color = '#FFFFFF' }: { size?: number; color?: string }) {
  const gap = size * 0.12;
  const tile = (size - gap) / 2;
  const borderRadius = tile * 0.2;
  const stroke = Math.max(tile * 0.1, 2);
  const far = tile + gap;

  const laid = { width: tile, height: tile, borderRadius, backgroundColor: color };

  return (
    <View style={{ width: size, height: size }} accessibilityRole="image" accessibilityLabel="Gupta Hardware">
      <View style={[styles.tile, laid, { top: 0, left: 0 }]} />
      <View style={[styles.tile, laid, { top: 0, left: far }]} />
      <View style={[styles.tile, laid, { top: far, left: 0 }]} />
      <View
        style={[
          styles.tile,
          {
            top: far,
            left: far,
            width: tile,
            height: tile,
            borderRadius,
            borderWidth: stroke,
            borderColor: color,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { position: 'absolute' },
});
