import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { theme } from '../theme';

export interface ChipOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

interface Props<T extends string> {
  readonly label: string;
  readonly options: readonly ChipOption<T>[];
  readonly selected: T;
  readonly onSelect: (value: T) => void;
}

export function ChipSelector<T extends string>({ label, options, selected, onSelect }: Props<T>) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.row}
        contentContainerStyle={styles.rowContent}
      >
        {options.map((option) => {
          const isSelected = option.value === selected;
          return (
            <Pressable
              key={option.value}
              onPress={() => onSelect(option.value)}
              style={[styles.chip, isSelected && styles.chipSelected]}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
            >
              <Text style={[styles.chipLabel, isSelected && styles.chipLabelSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 14, color: theme.textLabel, marginBottom: 6 },
  row: { marginBottom: 18 },
  rowContent: { gap: 8, paddingRight: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    backgroundColor: theme.surface,
  },
  chipSelected: { backgroundColor: theme.accent, borderColor: theme.accent },
  chipLabel: { fontSize: 14, color: theme.textLabel },
  chipLabelSelected: { color: theme.accentText },
});
