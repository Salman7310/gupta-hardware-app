import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Customer } from '../../models/customer';
import { CustomerField } from '../../services/customer';
import { useCustomerPickerViewModel } from '../../viewmodels/useCustomerPickerViewModel';
import { card, radius, size, space, theme, type } from '../theme';

interface Props {
  readonly onPick: (customer: Customer | null) => void;
  readonly onClose: () => void;
}

export function CustomerPicker({ onPick, onClose }: Props) {
  const vm = useCustomerPickerViewModel();

  const add = async () => {
    const created = await vm.create();
    if (created) onPick(created);
  };

  if (vm.isAdding) {
    return (
      <View style={styles.screen}>
        <Header title="New customer" actionLabel="Cancel" onAction={vm.cancelAdding} />
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Field
            label="Name"
            value={vm.draft.name}
            onChange={(v) => vm.setField('name', v)}
            placeholder="Sharma Builders"
            error={vm.errors.name}
            autoFocus
          />
          <Field
            label="Phone"
            value={vm.draft.phone}
            onChange={(v) => vm.setField('phone', v)}
            placeholder="Optional"
            keyboard="phone-pad"
            error={vm.errors.phone}
          />
          <Field
            label="GSTIN"
            value={vm.draft.gstin}
            onChange={(v) => vm.setField('gstin', v)}
            placeholder="Optional"
            autoCapitalize="characters"
            error={vm.errors.gstin}
            hint="Needed only if they claim the tax back"
          />
          <Field
            label="Address"
            value={vm.draft.address}
            onChange={(v) => vm.setField('address', v)}
            placeholder="Optional"
            error={vm.errors.address}
          />

          <Pressable
            style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}
            onPress={() => void add()}
            disabled={vm.isSaving}
            accessibilityRole="button"
          >
            <Text style={styles.primaryLabel}>
              {vm.isSaving ? 'Saving…' : 'Save and use on this bill'}
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Header title="Who is this bill for?" actionLabel="Close" onAction={onClose} />

      <TextInput
        style={styles.search}
        value={vm.query}
        onChangeText={vm.setQuery}
        placeholder="Search by name or phone"
        placeholderTextColor={theme.textPlaceholder}
        autoCorrect={false}
        autoFocus
      />

      <Pressable style={styles.walkIn} onPress={() => onPick(null)} accessibilityRole="button">
        <Text style={styles.walkInLabel}>Walk-in customer</Text>
        <Text style={styles.walkInHint}>No name on the bill</Text>
      </Pressable>

      {vm.isLoading ? <ActivityIndicator style={styles.state} /> : null}

      <FlatList
        data={vm.items}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => onPick(item)} accessibilityRole="button">
            <View style={styles.flex}>
              <Text style={styles.name}>{item.name}</Text>
              {item.phone || item.gstin ? (
                <Text style={styles.meta}>
                  {[item.phone, item.gstin].filter(Boolean).join(' · ')}
                </Text>
              ) : null}
            </View>
          </Pressable>
        )}
        ListFooterComponent={
          <Pressable style={styles.addNew} onPress={vm.startAdding} accessibilityRole="button">
            <Text style={styles.addNewLabel}>
              {vm.query.trim().length > 0 ? `+ Add "${vm.query.trim()}"` : '+ Add a new customer'}
            </Text>
          </Pressable>
        }
      />
    </View>
  );
}

function Header({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      <Pressable onPress={onAction} accessibilityRole="button" hitSlop={12}>
        <Text style={styles.headerAction}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  error,
  hint,
  keyboard,
  autoCapitalize,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  hint?: string;
  keyboard?: 'phone-pad';
  autoCapitalize?: 'none' | 'characters';
  autoFocus?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, error ? styles.inputError : null]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={theme.textPlaceholder}
        keyboardType={keyboard}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        autoFocus={autoFocus}
      />
      {hint && !error ? <Text style={styles.hint}>{hint}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: theme.background, paddingTop: space.lg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    gap: space.md,
  },
  title: { ...type.title, color: theme.text, flex: 1 },
  headerAction: { ...type.label, color: theme.accentInk },

  search: {
    margin: space.lg,
    paddingHorizontal: space.lg,
    height: size.tap,
    ...type.body,
    color: theme.text,
    backgroundColor: theme.surface,
    borderRadius: radius.md,
  },

  walkIn: {
    ...card,
    marginHorizontal: space.lg,
    marginBottom: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    minHeight: size.tap,
    justifyContent: 'center',
  },
  walkInLabel: { ...type.body, color: theme.text },
  walkInHint: { ...type.micro, color: theme.textMuted, marginTop: 2 },

  state: { marginTop: space.xl },
  list: { paddingHorizontal: space.lg, paddingBottom: space.huge },
  row: {
    ...card,
    minHeight: size.tap,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    marginBottom: space.sm,
  },
  name: { ...type.body, color: theme.text },
  meta: { ...type.caption, color: theme.textMuted, marginTop: 2 },

  addNew: {
    height: size.tap,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.borderStrong,
    marginTop: space.sm,
  },
  addNewLabel: { ...type.label, color: theme.accentInk },

  form: { padding: space.lg, gap: space.lg, paddingBottom: space.huge },
  field: { gap: space.sm },
  label: { ...type.label, color: theme.textLabel },
  input: {
    paddingHorizontal: space.lg,
    minHeight: size.tap,
    ...type.body,
    color: theme.text,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: radius.md,
  },
  inputError: { borderColor: theme.danger },
  hint: { ...type.micro, color: theme.textMuted },
  error: { ...type.caption, color: theme.danger },

  primary: {
    height: size.control,
    borderRadius: radius.md,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.sm,
  },
  primaryPressed: { backgroundColor: theme.accentPressed },
  primaryLabel: { ...type.bodyStrong, color: theme.accentText },
});
