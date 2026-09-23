import React from 'react';
import { StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';
import { theme } from '../theme';

interface Props {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly hint?: string;
  readonly error?: string;
  readonly multiline?: boolean;
  readonly keyboardType?: KeyboardTypeOptions;
  readonly autoCapitalize?: 'none' | 'characters' | 'words' | 'sentences';
  readonly suffix?: string;
}

export function FormField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  error,
  multiline,
  keyboardType,
  autoCapitalize,
  suffix,
}: Props) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputRow, error ? styles.inputRowError : null]}>
        <TextInput
          style={[styles.input, multiline && styles.inputMultiline]}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={theme.textPlaceholder}
          multiline={multiline}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
        />
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!error && hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 18 },
  label: { fontSize: 14, color: theme.textLabel, marginBottom: 6 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    borderRadius: 8,
    paddingRight: 12,
  },
  inputRowError: { borderColor: theme.danger },
  input: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: theme.text },
  inputMultiline: { minHeight: 76, textAlignVertical: 'top' },
  suffix: { fontSize: 14, color: theme.textMuted },
  hint: { fontSize: 12, color: theme.textMuted, marginTop: 6, lineHeight: 17 },
  error: { fontSize: 12, color: theme.danger, marginTop: 6 },
});
