import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAware } from '../components/KeyboardAware';
import { ShopField, ShopSetupInput, shopFieldErrors } from '../../services/identity';

interface Props {
  readonly onSubmit: (input: ShopSetupInput) => void;
  readonly isSubmitting: boolean;
  readonly error: string | null;
}

/** First run only. Establishes who the shop is and which counter this is. */
export function SetupScreen({ onSubmit, isSubmitting, error }: Props) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [gstin, setGstin] = useState('');
  // Required, so it starts with a value rather than a grey hint that
  // looks like one. Setup refused the first attempt otherwise.
  const [invoicePrefix, setInvoicePrefix] = useState('GH');
  const [deviceLetter, setDeviceLetter] = useState('A');

  const [fieldErrors, setFieldErrors] = useState<Partial<Record<ShopField, string>>>({});

  // Every problem shown beside its own field at once, rather than one at a
  // time at the foot of a form taller than the screen.
  const submit = () => {
    const input = { name, address, phone, gstin, invoicePrefix, deviceLetter };
    const errors = shopFieldErrors(input);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    onSubmit(input);
  };

  /** A setter that also clears that field's error as it is corrected. */
  const edit = (field: ShopField, set: (v: string) => void) => (value: string) => {
    set(value);
    setFieldErrors((e) => (e[field] ? { ...e, [field]: undefined } : e));
  };

  return (
    <KeyboardAware style={styles.flex}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Set up your shop</Text>
        <Text style={styles.subtitle}>
          These details print on every bill. You can change them later in the Shop tab.
        </Text>

        <Field
          label="Shop name"
          value={name}
          onChange={edit('name', setName)}
          placeholder="Gupta Hardware"
          error={fieldErrors.name}
        />
        <Field
          label="Address"
          value={address}
          onChange={setAddress}
          placeholder="Shop address"
          multiline
        />
        <Field
          label="Mobile"
          value={phone}
          onChange={edit('phone', setPhone)}
          placeholder="98765 43210"
          keyboard="phone-pad"
          error={fieldErrors.phone}
        />
        <Field
          label="GSTIN"
          value={gstin}
          onChange={edit('gstin', setGstin)}
          placeholder="Optional"
          autoCapitalize="characters"
          hint="Your GST number. Bills print as tax invoices only when this is filled in."
          error={fieldErrors.gstin}
        />
        <Field
          label="Bill prefix"
          value={invoicePrefix}
          onChange={edit('invoicePrefix', setInvoicePrefix)}
          error={fieldErrors.invoicePrefix}
          placeholder="GH"
          autoCapitalize="characters"
          hint="Appears at the start of every bill number, for example GH/A/0001"
        />
        <Field
          label="Counter letter"
          value={deviceLetter}
          onChange={edit('deviceLetter', setDeviceLetter)}
          error={fieldErrors.deviceLetter}
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
    </KeyboardAware>
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
  keyboard,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  multiline?: boolean;
  autoCapitalize?: 'none' | 'characters' | 'words' | 'sentences';
  keyboard?: 'default' | 'phone-pad';
  error?: string;
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
        keyboardType={keyboard}
        autoCorrect={false}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
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
  fieldError: { fontSize: 13, color: '#A32D2D', marginTop: 6 },
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
