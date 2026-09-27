import React from 'react';
import { StyleSheet, Text, View, type ColorValue } from 'react-native';

/**
 * The four tab icons, drawn from Views for the same reasons as the brand mark:
 * they stay sharp at any size, take their colour from the caller, and cost the
 * bundle nothing. The alternative was a font icon pack, which is a megabyte of
 * glyphs to use four of.
 *
 * All four are outlines at one of two weights. A filled active state would
 * read better on one or two of them and worse on the rest, and a bar where
 * each icon changes differently looks like four icons rather than a set.
 */

export interface TabIconProps {
  // The navigator hands icons a ColorValue, not a plain string.
  readonly color: ColorValue;
  readonly focused: boolean;
}

const BOX = 24;
const strokeFor = (focused: boolean) => (focused ? 2.3 : 1.7);

function Frame({ children }: { children: React.ReactNode }) {
  return <View style={styles.frame}>{children}</View>;
}

/** Four tiles, the shop's own shape. */
export function ProductsIcon({ color, focused }: TabIconProps) {
  const stroke = strokeFor(focused);
  const tile = { borderWidth: stroke, borderColor: color, ...styles.tile };

  return (
    <Frame>
      <View style={[tile, { top: 2, left: 2 }]} />
      <View style={[tile, { top: 2, left: 13 }]} />
      <View style={[tile, { top: 13, left: 2 }]} />
      <View style={[tile, { top: 13, left: 13 }]} />
    </Frame>
  );
}

/** A bill: a sheet with writing on it. */
export function BillsIcon({ color, focused }: TabIconProps) {
  const stroke = strokeFor(focused);

  return (
    <Frame>
      <View
        style={[styles.sheet, { borderWidth: stroke, borderColor: color }]}
      />
      <View style={[styles.rule, { backgroundColor: color, top: 8, width: 9 }]} />
      <View style={[styles.rule, { backgroundColor: color, top: 12, width: 9 }]} />
      <View style={[styles.rule, { backgroundColor: color, top: 16, width: 5 }]} />
    </Frame>
  );
}

/**
 * Money owed. A rupee sign says this faster than any drawing could, and this
 * is the one tab whose meaning has to be unmistakable at a glance.
 */
export function DuesIcon({ color, focused }: TabIconProps) {
  const stroke = strokeFor(focused);

  return (
    <Frame>
      <View style={[styles.coin, { borderWidth: stroke, borderColor: color }]}>
        <Text style={[styles.rupee, { color, fontWeight: focused ? '700' : '600' }]}>₹</Text>
      </View>
    </Frame>
  );
}

/**
 * A price tag: what a quotation is, before anything is sold. Distinct at a
 * glance from the bill sheet beside it, which is the only thing it has to be.
 */
export function QuotesIcon({ color, focused }: TabIconProps) {
  const stroke = strokeFor(focused);

  return (
    <Frame>
      <View style={[styles.tag, { borderWidth: stroke, borderColor: color }]} />
      <View style={[styles.tagHole, { backgroundColor: color }]} />
    </Frame>
  );
}

/** A shop front: an awning over a counter. */
export function ShopIcon({ color, focused }: TabIconProps) {
  const stroke = strokeFor(focused);

  return (
    <Frame>
      <View style={[styles.awning, { backgroundColor: color }]} />
      <View style={[styles.walls, { borderWidth: stroke, borderColor: color }]} />
    </Frame>
  );
}

const styles = StyleSheet.create({
  frame: { width: BOX, height: BOX },
  tile: { position: 'absolute', width: 9, height: 9, borderRadius: 2.5 },

  sheet: { position: 'absolute', top: 2, left: 4, width: 16, height: 20, borderRadius: 3 },
  rule: { position: 'absolute', left: 8, height: 1.6, borderRadius: 1 },

  coin: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rupee: { fontSize: 12, lineHeight: 15 },

  tag: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 16,
    height: 16,
    borderRadius: 3,
    transform: [{ rotate: '45deg' }],
  },
  tagHole: { position: 'absolute', top: 7, left: 7, width: 3.4, height: 3.4, borderRadius: 1.7 },

  awning: { position: 'absolute', top: 4, left: 2, width: 20, height: 3, borderRadius: 1.5 },
  walls: { position: 'absolute', top: 9, left: 4, width: 16, height: 13, borderRadius: 2 },
});
