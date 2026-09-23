import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Quantity } from '../../core';
import { DimensionDraft, DimensionField } from '../../services/bill';
import { theme } from '../theme';

interface Props {
  readonly dimensions: readonly DimensionDraft[];
  /** What the pieces entered so far come to, or null while none read yet. */
  readonly area: Quantity | null;
  readonly onChange: (dimensionKey: string, field: DimensionField, value: string) => void;
  readonly onAdd: () => void;
  readonly onRemove: (dimensionKey: string) => void;
}

/**
 * The stone keypad: pieces measured length by width, in feet and inches.
 *
 * The shop measures a slab and says "five six by two three". Asking for square
 * feet instead would mean the shopkeeper doing that multiplication in their
 * head at the counter, which is the arithmetic this app exists to take off
 * them — and a slab multiplied wrong is a wrong bill.
 */
export function DimensionEntry({ dimensions, area, onChange, onAdd, onRemove }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.headings}>
        <Text style={[styles.heading, styles.piecesCol]}>Pieces</Text>
        <Text style={[styles.heading, styles.measureCol]}>Length</Text>
        <Text style={[styles.heading, styles.measureCol]}>Width</Text>
        <View style={styles.removeCol} />
      </View>

      {dimensions.map((dimension) => (
        <View key={dimension.key} style={styles.row}>
          <View style={styles.piecesCol}>
            <Cell
              value={dimension.pieces}
              onChange={(v) => onChange(dimension.key, 'pieces', v)}
              placeholder="1"
            />
          </View>

          <View style={[styles.measureCol, styles.pair]}>
            <Cell
              value={dimension.lengthFeet}
              onChange={(v) => onChange(dimension.key, 'lengthFeet', v)}
              placeholder="0"
              affix="′"
            />
            <Cell
              value={dimension.lengthInches}
              onChange={(v) => onChange(dimension.key, 'lengthInches', v)}
              placeholder="0"
              affix="″"
            />
          </View>

          <View style={[styles.measureCol, styles.pair]}>
            <Cell
              value={dimension.widthFeet}
              onChange={(v) => onChange(dimension.key, 'widthFeet', v)}
              placeholder="0"
              affix="′"
            />
            <Cell
              value={dimension.widthInches}
              onChange={(v) => onChange(dimension.key, 'widthInches', v)}
              placeholder="0"
              affix="″"
            />
          </View>

          <View style={styles.removeCol}>
            {dimensions.length > 1 ? (
              <Pressable
                onPress={() => onRemove(dimension.key)}
                accessibilityRole="button"
                accessibilityLabel="Remove this piece"
                hitSlop={10}
              >
                <Text style={styles.remove}>✕</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ))}

      <View style={styles.footer}>
        <Pressable onPress={onAdd} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.add}>+ Add piece</Text>
        </Pressable>
        <Text style={styles.area}>{area ? area.toDisplay() : '—'}</Text>
      </View>

      {area?.describeWorking() ? (
        <Text style={styles.working}>{area.describeWorking()}</Text>
      ) : null}
    </View>
  );
}

function Cell({
  value,
  onChange,
  placeholder,
  affix,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  affix?: string;
}) {
  return (
    <View style={styles.cell}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        keyboardType="number-pad"
        placeholder={placeholder}
        placeholderTextColor={theme.textPlaceholder}
        selectTextOnFocus
      />
      {affix ? <Text style={styles.affix}>{affix}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  headings: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heading: { fontSize: 12, color: theme.textLabel },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  piecesCol: { width: 56 },
  measureCol: { flex: 1 },
  removeCol: { width: 28, alignItems: 'flex-end' },
  pair: { flexDirection: 'row', gap: 6 },

  cell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  input: { flex: 1, fontSize: 16, color: theme.text, paddingVertical: 10 },
  affix: { fontSize: 13, color: theme.textMuted },
  remove: { fontSize: 16, color: theme.textMuted },

  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  add: { fontSize: 14, color: theme.accent },
  area: { fontSize: 16, color: theme.text },
  working: { fontSize: 12, color: theme.textMuted, lineHeight: 18 },
});
