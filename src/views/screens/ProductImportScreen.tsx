import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { pickTextFile } from '../../data/file-picker';
import { describeRowErrors, ImportRow } from '../../services/product-import';
import { useProductImportViewModel } from '../../viewmodels/useProductImportViewModel';
import { theme } from '../theme';

const PREVIEW_LIMIT = 8;

export function ProductImportScreen({ onDone }: { onDone: () => void }) {
  const vm = useProductImportViewModel(pickTextFile);
  const preview = vm.preview;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <Text style={styles.intro}>
        Choose a spreadsheet exported as CSV. It needs a name column and a rate column; category,
        unit, GST, pieces per box, square feet per box and opening stock are used when present.
      </Text>

      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        onPress={() => void vm.pickFile()}
        disabled={vm.isPicking}
        accessibilityRole="button"
      >
        <Text style={styles.buttonLabel}>{vm.isPicking ? 'Opening…' : 'Choose a CSV file'}</Text>
      </Pressable>

      {vm.error ? <Text style={styles.error}>{vm.error}</Text> : null}

      {vm.importedCount !== null ? (
        <View style={styles.done}>
          <Text style={styles.doneText}>
            Imported {vm.importedCount} {vm.importedCount === 1 ? 'product' : 'products'}.
          </Text>
          <Pressable style={styles.secondary} onPress={onDone} accessibilityRole="button">
            <Text style={styles.secondaryLabel}>Back to products</Text>
          </Pressable>
        </View>
      ) : null}

      {preview ? (
        <View style={styles.preview}>
          <Text style={styles.fileName}>{vm.fileName}</Text>

          {preview.missingColumns.length > 0 ? (
            <Text style={styles.error}>
              This file has no {preview.missingColumns.join(' or ')} column.
            </Text>
          ) : (
            <>
              <Text style={styles.summary}>
                {preview.valid.length} ready to import
                {preview.invalid.length > 0 ? `, ${preview.invalid.length} with problems` : ''}
              </Text>

              {preview.duplicates.length > 0 ? (
                <View style={styles.problems}>
                  <Text style={styles.problemsTitle}>
                    {preview.duplicates.length} already in the catalogue
                  </Text>
                  <Text style={styles.problemReason}>
                    Importing adds them again rather than updating. Check these names first:{' '}
                    {preview.duplicates
                      .slice(0, 4)
                      .map((r) => r.name)
                      .join(', ')}
                    {preview.duplicates.length > 4 ? ' and more' : ''}
                  </Text>
                </View>
              ) : null}

              {preview.invalid.length > 0 ? (
                <View style={styles.problems}>
                  <Text style={styles.problemsTitle}>Rows that will be skipped</Text>
                  {preview.invalid.slice(0, PREVIEW_LIMIT).map((row) => (
                    <ProblemRow key={row.line} row={row} />
                  ))}
                  {preview.invalid.length > PREVIEW_LIMIT ? (
                    <Text style={styles.more}>
                      and {preview.invalid.length - PREVIEW_LIMIT} more
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {preview.valid.length > 0 ? (
                <Pressable
                  style={({ pressed }) => [styles.button, pressed && styles.pressed]}
                  onPress={() => void vm.confirm()}
                  disabled={vm.isImporting}
                  accessibilityRole="button"
                >
                  <Text style={styles.buttonLabel}>
                    {vm.isImporting ? 'Importing…' : `Import ${preview.valid.length} products`}
                  </Text>
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      ) : null}

      {vm.isImporting ? <ActivityIndicator style={styles.spinner} /> : null}
    </ScrollView>
  );
}

function ProblemRow({ row }: { row: ImportRow }) {
  return (
    <View style={styles.problemRow}>
      <Text style={styles.problemLine}>Line {row.line}</Text>
      <View style={styles.problemDetail}>
        <Text style={styles.problemName} numberOfLines={1}>
          {row.name}
        </Text>
        <Text style={styles.problemReason}>{describeRowErrors(row)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.background },
  container: { padding: 20, paddingBottom: 48 },
  intro: { fontSize: 15, color: theme.textMuted, lineHeight: 22, marginBottom: 20 },
  button: {
    paddingVertical: 15,
    borderRadius: 8,
    backgroundColor: theme.accent,
    alignItems: 'center',
    marginTop: 8,
  },
  pressed: { opacity: 0.85 },
  buttonLabel: { fontSize: 16, color: theme.accentText },
  error: { fontSize: 14, color: theme.danger, marginTop: 16, lineHeight: 20 },
  preview: { marginTop: 24 },
  fileName: { fontSize: 14, color: theme.textMuted, marginBottom: 6 },
  summary: { fontSize: 17, color: theme.text, marginBottom: 16 },
  problems: {
    backgroundColor: theme.warningBg,
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  problemsTitle: { fontSize: 14, color: theme.warningText, marginBottom: 2 },
  problemRow: { flexDirection: 'row', gap: 10 },
  problemLine: { fontSize: 13, color: theme.warningText, width: 58 },
  problemDetail: { flex: 1 },
  problemName: { fontSize: 14, color: theme.text },
  problemReason: { fontSize: 13, color: theme.warningText, marginTop: 1 },
  more: { fontSize: 13, color: theme.warningText },
  done: { marginTop: 24, gap: 16, alignItems: 'flex-start' },
  doneText: { fontSize: 16, color: theme.text },
  secondary: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.accent,
  },
  secondaryLabel: { fontSize: 15, color: theme.accent },
  spinner: { marginTop: 24 },
});
