import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ShopSetupInput } from '../../services/identity';

interface Props {
  readonly onSubmit: (input: ShopSetupInput) => void;
  readonly isSubmitting: boolean;
  readonly error: string | null;
}

/** First run only. Establishes who the shop is and which counter this is. */
export function SetupScreen({ onSubmit, isSubmitting, error }: Props) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [invoicePrefix, setInvoicePrefix] = useState('');
  const [deviceLetter, setDeviceLetter] = useState('A');

  const submit = () => onSubmit({ name, address, gstin, invoicePrefix, deviceLetter });

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Set up your shop</Text>
        <Text style={styles.subtitle}>
          These details print on every bill. You can change them later in settings.
        </Text>

        <Field label="Shop name" value={name} onChange={setName} placeholder="Gupta Hardware" />
        <Field
          label="Address"
          value={address}
          onChange={setAddress}
          placeholder="Shop address"
          multiline
        />
        <Field
          label="GSTIN"
          value={gstin}
          onChange={setGstin}
          placeholder="Optional"
          autoCapitalize="characters"
        />
        <Field
          label="Bill prefix"
          value={invoicePrefix}
          onChange={setInvoicePrefix}
          placeholder="GH"
          autoCapitalize="characters"
          hint="Appears at the start of every bill number, for example GH/A/0001"
        />
        <Field
          label="Counter letter"
          value={deviceLetter}
          onChange={setDeviceLetter}
          placeholder="A"
          autoCapitalize="characters"
          hint="Give each phone or tablet its own letter so two counters never issue the same bill number"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={submit}
          disabled={isSubmitting}
          accessibilityRole="button"
        >
          <Text style={styles.buttonLabel}>{isSubmitting ? 'Saving…' : 'Start using the app'}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  hint,
  multiline,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  multiline?: boolean;
  autoCapitalize?: 'none' | 'characters' | 'words' | 'sentences';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#8d8d86"
        multiline={multiline}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fbfbf9' },
  container: { padding: 24, paddingBottom: 48, gap: 4 },
  title: { fontSize: 24, color: '#1a1a18', marginBottom: 4 },
  subtitle: { fontSize: 15, color: '#6b6b66', lineHeight: 22, marginBottom: 20 },
  field: { marginBottom: 18 },
  label: { fontSize: 14, color: '#44443f', marginBottom: 6 },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1a1a18',
    backgroundColor: '#ffffff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d8d8d2',
    borderRadius: 8,
  },
  inputMultiline: { minHeight: 76, textAlignVertical: 'top' },
  hint: { fontSize: 12, color: '#6b6b66', marginTop: 6, lineHeight: 17 },
  error: { fontSize: 14, color: '#a32d2d', marginBottom: 12 },
  button: {
    marginTop: 8,
    paddingVertical: 16,
    borderRadius: 8,
    backgroundColor: '#1d9e75',
    alignItems: 'center',
  },
  buttonPressed: { opacity: 0.85 },
  buttonLabel: { fontSize: 16, color: '#ffffff' },
});
