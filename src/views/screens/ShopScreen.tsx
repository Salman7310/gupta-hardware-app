import React, { useCallback } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDate } from '../../core';
import { useFocusEffect } from 'expo-router';
import { ShopDetailsInput } from '../../services/identity';
import {
  ShopViewModel,
  draftFromShop,
  useShopViewModel,
} from '../../viewmodels/useShopViewModel';
import { confirmDiscard } from '../confirmLeave';
import { BrandMark } from '../components/BrandMark';
import { folderLabel } from '../format';
import { card, radius, size, space, theme, type } from '../theme';

interface Props {
  readonly onImport: () => void;
}

/**
 * The shop's own details and the housekeeping that does not belong on a
 * counter screen: where bills are filed, and bringing a catalogue in.
 */
export function ShopScreen({ onImport }: Props) {
  const vm = useShopViewModel();
  const { refreshFolder } = vm;

  // Depends on the stable command, never the ViewModel — see ProductListScreen.
  useFocusEffect(
    useCallback(() => {
      void refreshFolder();
    }, [refreshFolder]),
  );
  const { shop, device } = vm;

  return (
    <>
      <ShopDetailsSheet vm={vm} />
      <RestoreConfirmation vm={vm} />
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.mark}>
          <BrandMark size={40} color={theme.accent} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.shopName}>{shop.name}</Text>
          {shop.address ? <Text style={styles.meta}>{shop.address}</Text> : null}
        </View>
      </View>

      <Section title="Backup">
        <Detail
          label="Last backed up"
          value={vm.lastBackupAt ? formatDate(vm.lastBackupAt) : 'Never'}
        />
        {vm.lastBackupAt === null ? (
          <Text style={styles.warning}>
            Nothing is backed up yet. If this phone is lost or the app is removed, every bill and
            stock figure goes with it.
          </Text>
        ) : null}
        <Text style={styles.hint}>
          Everything — bills, quotations, stock, customers and products — written as one file
          into the same folder as your saved bills. That folder survives the app being removed;
          the app&apos;s own data does not.
        </Text>
        <Pressable
          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
          onPress={() => void vm.backUpNow()}
          disabled={vm.isBackingUp}
          accessibilityRole="button"
        >
          <Text style={styles.actionLabel}>
            {vm.isBackingUp ? 'Backing up…' : 'Back up now'}
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
          onPress={() => void vm.chooseBackup()}
          accessibilityRole="button"
        >
          <Text style={styles.actionLabel}>Restore from a backup</Text>
        </Pressable>
        {vm.backupNotice ? (
          <Pressable onPress={vm.dismissBackupNotice}>
            <Text style={styles.notice}>{vm.backupNotice}</Text>
          </Pressable>
        ) : null}
      </Section>

      <Section title="Shop details">
        <Detail label="Name" value={shop.name} />
        <Detail label="Address" value={shop.address ?? 'Not set'} />
        <Detail label="Mobile" value={shop.phone ?? 'Not set'} />
        <Detail label="GSTIN" value={shop.gstin ?? 'Not set'} />
        <Text style={styles.hint}>These print at the top of every bill and quotation.</Text>
        <Pressable
          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
          onPress={vm.startEditing}
          accessibilityRole="button"
        >
          <Text style={styles.actionLabel}>Edit shop details</Text>
        </Pressable>
      </Section>

      <Section title="Billing">
        <Detail label="Bill series" value={`${shop.invoicePrefix}/${device.letter}/…`} />
        <Detail
          label="This device"
          value={`Counter ${device.letter}`}
          hint="Each phone or tablet has its own letter, so two counters never issue the same bill number."
        />
      </Section>

      <Section title="Saved bills">
        {vm.isLoading ? (
          <Detail label="Folder" value="Checking…" />
        ) : vm.billsFolder ? (
          <>
            <Detail
              label="Folder"
              value={folderLabel(vm.billsFolder)}
              hint="Bills are written here as PDFs as they are saved. They stay on the phone even if this app is removed."
            />
            <Pressable
              style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
              onPress={() => void vm.forgetFolder()}
              accessibilityRole="button"
            >
              <Text style={styles.actionLabel}>Choose a different folder</Text>
            </Pressable>
            <Text style={styles.hint}>
              The next bill you save will ask where to put it. Bills already written stay where they
              are.
            </Text>
          </>
        ) : (
          <>
            <Detail label="Folder" value="Not chosen yet" />
            <Text style={styles.hint}>
              Open any bill and tap Save PDF. You will be asked once where bills should be kept, and
              every bill after that is filed there automatically.
            </Text>
          </>
        )}
      </Section>

      <Section title="Catalogue">
        <Pressable
          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
          onPress={onImport}
          accessibilityRole="button"
        >
          <Text style={styles.actionLabel}>Import from a spreadsheet</Text>
        </Pressable>
        <Text style={styles.hint}>
          Brings products in from a CSV. Names already in the catalogue are left alone rather than
          added twice.
        </Text>
      </Section>
    </ScrollView>
    </>
  );
}

/**
 * Restoring replaces everything, so it is never one tap. The owner is shown
 * what the file holds first — how many bills, how many products — because
 * those numbers are the only way to tell a good backup from the wrong one.
 */
function RestoreConfirmation({ vm }: { vm: ShopViewModel }) {
  const insets = useSafeAreaInsets();
  const pending = vm.pendingRestore;
  if (!pending) return null;

  const counts = pending.counts;

  return (
    <Modal visible animationType="slide" onRequestClose={vm.cancelRestore}>
      <View style={[styles.sheet, { paddingTop: insets.top + space.lg }]}>
        <View style={styles.sheetHead}>
          <Text style={styles.sheetTitle}>Restore this backup?</Text>
          <Pressable onPress={vm.cancelRestore} accessibilityRole="button" hitSlop={12}>
            <Text style={styles.actionLabel}>Cancel</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.sheetBody}>
          <Text style={styles.hint}>{pending.name}</Text>
          {pending.file.shopName ? (
            <Text style={styles.restoreShop}>{pending.file.shopName}</Text>
          ) : null}

          <View style={styles.card}>
            <Detail label="Bills" value={String(counts.invoices ?? 0)} />
            <Detail label="Quotations" value={String(counts.quotations ?? 0)} />
            <Detail label="Products" value={String(counts.products ?? 0)} />
            <Detail label="Customers" value={String(counts.customers ?? 0)} />
            <Detail label="Payments" value={String(counts.payments ?? 0)} />
          </View>

          <Text style={styles.warning}>
            This replaces everything currently in the app. Anything written since this backup was
            made will be lost.
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.destructive,
              (pressed || vm.isRestoring) && styles.destructivePressed,
            ]}
            onPress={() => void vm.confirmRestore()}
            disabled={vm.isRestoring}
            accessibilityRole="button"
          >
            <Text style={styles.saveLabel}>
              {vm.isRestoring ? 'Restoring…' : 'Replace everything with this backup'}
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

/**
 * Editing in a sheet rather than on a screen of its own: these are five
 * fields the shop touches once a year, and a route for them would be one more
 * thing to navigate past.
 */
function ShopDetailsSheet({ vm }: { vm: ShopViewModel }) {
  // A bare Modal sits outside the navigator, so nothing here keeps the header
  // clear of the status bar and camera cutout.
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={vm.isEditing} animationType="slide" onRequestClose={() => closeEditing(vm)}>
      <KeyboardAvoidingView
        style={[styles.sheet, { paddingTop: insets.top + space.lg }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheetHead}>
          <Text style={styles.sheetTitle}>Shop details</Text>
          <Pressable onPress={() => closeEditing(vm)} accessibilityRole="button" hitSlop={12}>
            <Text style={styles.actionLabel}>Cancel</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
          <SheetField
            label="Shop name"
            field="name"
            vm={vm}
            placeholder="Gupta Home Solutions"
            autoFocus
          />
          <SheetField
            label="Address"
            field="address"
            vm={vm}
            placeholder="Domchanch, Giridih Road, Koderma"
            multiline
          />
          <SheetField
            label="Mobile"
            field="phone"
            vm={vm}
            placeholder="98765 43210"
            keyboard="phone-pad"
            hint="Printed on the bill so a customer can ring you"
          />
          <SheetField
            label="GSTIN"
            field="gstin"
            vm={vm}
            placeholder="Optional"
            autoCapitalize="characters"
            hint="Your GST number. Bills print as tax invoices only when this is filled in."
          />
          <SheetField
            label="Bill prefix"
            field="invoicePrefix"
            vm={vm}
            placeholder="GH"
            autoCapitalize="characters"
            hint="Bills already written keep the number they were issued under"
          />

          {vm.error ? <Text style={styles.error}>{vm.error}</Text> : null}

          <Pressable
            style={({ pressed }) => [styles.save, (pressed || vm.isSaving) && styles.savePressed]}
            onPress={() => void vm.save()}
            disabled={vm.isSaving}
            accessibilityRole="button"
          >
            <Text style={styles.saveLabel}>{vm.isSaving ? 'Saving…' : 'Save details'}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Closes the details sheet, asking first if anything was changed. */
function closeEditing(vm: ShopViewModel): void {
  const saved = draftFromShop(vm.shop);
  const changed = (Object.keys(saved) as (keyof typeof saved)[]).some(
    (field) => vm.draft[field] !== saved[field],
  );
  confirmDiscard(
    changed,
    'Discard your changes?',
    'The shop details have not been saved.',
    vm.cancelEditing,
  );
}

function SheetField({
  label,
  field,
  vm,
  placeholder,
  hint,
  multiline,
  autoCapitalize,
  keyboard,
  autoFocus,
}: {
  label: string;
  field: keyof ShopDetailsInput;
  vm: ShopViewModel;
  placeholder?: string;
  hint?: string;
  multiline?: boolean;
  autoCapitalize?: 'none' | 'characters' | 'words' | 'sentences';
  keyboard?: 'default' | 'phone-pad';
  autoFocus?: boolean;
}) {
  return (
    <View style={styles.sheetField}>
      <Text style={styles.sheetLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={vm.draft[field]}
        onChangeText={(value) => vm.setField(field, value)}
        placeholder={placeholder}
        placeholderTextColor={theme.textPlaceholder}
        multiline={multiline}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboard}
        autoFocus={autoFocus}
        autoCorrect={false}
      />
      {vm.fieldErrors[field] ? <Text style={styles.error}>{vm.fieldErrors[field]}</Text> : null}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Detail({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={styles.detail}>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: theme.background },
  content: { padding: space.lg, paddingBottom: space.huge },

  header: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginBottom: space.xl },
  mark: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: theme.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopName: { ...type.title, color: theme.text },
  meta: { ...type.caption, color: theme.textMuted, marginTop: 2, lineHeight: 18 },

  section: { marginBottom: space.xl, gap: space.sm },
  sectionTitle: {
    ...type.micro,
    color: theme.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginLeft: space.xs,
  },
  card: { ...card, padding: space.lg, gap: space.md },

  detail: { gap: space.xs },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
  detailLabel: { ...type.body, color: theme.textLabel },
  detailValue: { ...type.bodyStrong, color: theme.text, flexShrink: 1, textAlign: 'right' },
  hint: { ...type.caption, color: theme.textMuted, lineHeight: 18 },

  action: {
    height: size.tap,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.accentSurface,
  },
  actionPressed: { opacity: 0.7 },
  sheet: { flex: 1, backgroundColor: theme.background },
  sheetHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.lg,
  },
  sheetTitle: { ...type.title, color: theme.text },
  sheetBody: { padding: space.lg, gap: space.md, paddingBottom: space.huge },
  sheetField: { gap: space.xs },
  sheetLabel: { ...type.label, color: theme.textLabel },
  input: {
    paddingHorizontal: space.lg,
    minHeight: size.tap,
    ...type.body,
    color: theme.text,
    backgroundColor: theme.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.border,
  },
  inputMultiline: { minHeight: 88, paddingTop: space.md, textAlignVertical: 'top' },
  error: { ...type.caption, color: theme.danger },
  save: {
    marginTop: space.lg,
    height: size.control,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.accent,
  },
  savePressed: { backgroundColor: theme.accentPressed },
  notice: { ...type.caption, color: theme.accentInk, lineHeight: 20 },
  restoreShop: { ...type.bodyStrong, color: theme.text },
  warning: { ...type.caption, color: theme.danger, lineHeight: 20, marginTop: space.sm },
  destructive: {
    marginTop: space.lg,
    height: size.control,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.danger,
  },
  destructivePressed: { opacity: 0.8 },
  saveLabel: { ...type.bodyStrong, color: theme.accentText },

  actionLabel: { ...type.bodyStrong, color: theme.accentInk },
});
