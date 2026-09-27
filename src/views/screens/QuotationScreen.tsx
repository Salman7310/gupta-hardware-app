import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, Text, View } from 'react-native';
import { Quotation } from '../../models/quotation';
import { CustomerPicker } from '../components/CustomerPicker';
import {
  AddItem,
  CustomerCard,
  EntryField,
  LineEntryRow,
  SaveBar,
  TotalRow,
  entryStyles as styles,
} from '../components/LineEntry';
import { ProductPicker } from '../components/ProductPicker';
import { useQuotationViewModel } from '../../viewmodels/useQuotationViewModel';

interface Props {
  readonly onSaved: (quotation: Quotation) => void;
}

/**
 * Pricing up a job at the counter.
 *
 * The same form as a bill, less the amount paid and plus how long the prices
 * hold. That likeness is the feature: the customer is quoted from the same
 * catalogue, the same discounts and the same tax arithmetic that will produce
 * their bill, so the two figures agree.
 */
export function QuotationScreen({ onSaved }: Props) {
  const vm = useQuotationViewModel();
  const [isPicking, setIsPicking] = useState(false);
  const [isPickingCustomer, setIsPickingCustomer] = useState(false);

  const submit = async () => {
    const saved = await vm.save();
    if (saved) onSaved(saved);
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.note}>
          An estimate to hand over, not a bill. Nothing is sold, no stock moves and nothing is
          owed until the customer comes back and you bill it.
        </Text>

        <CustomerCard
          customer={vm.customer}
          label="Quotation for"
          emptyLabel="Counter enquiry"
          onPress={() => setIsPickingCustomer(true)}
        />

        {vm.isEmpty ? (
          <Text style={styles.empty}>
            No items yet. Add what the customer asked about, and the estimate will follow as you
            type.
          </Text>
        ) : (
          vm.draft.lines.map((line) => (
            <LineEntryRow
              key={line.key}
              line={line}
              total={vm.lineTotals[line.key]?.total ?? null}
              error={vm.errors.lines[line.key]}
              onChange={(field, value) => vm.setLineField(line.key, field, value)}
              onRemove={() => vm.removeLine(line.key)}
              onDimensionChange={(dimensionKey, field, value) =>
                vm.setDimensionField(line.key, dimensionKey, field, value)
              }
              onAddDimension={() => vm.addDimension(line.key)}
              onRemoveDimension={(dimensionKey) => vm.removeDimension(line.key, dimensionKey)}
              onToggleMeasuring={(measured) => vm.setMeasuring(line.key, measured)}
            />
          ))
        )}

        <AddItem onPress={() => setIsPicking(true)} />

        <EntryField
          label="Discount on the whole quotation"
          value={vm.draft.billDiscount}
          onChange={vm.setBillDiscount}
          placeholder="Optional"
          prefix="₹"
          error={vm.errors.billDiscount}
          hint="Spread across the items before GST, exactly as it would be on the bill"
        />

        <EntryField
          label="Prices hold for"
          value={vm.draft.validDays}
          onChange={vm.setValidDays}
          placeholder="7"
          suffix="days"
          error={vm.errors.validDays}
          hint="Printed on the quotation, so a rate change next month is not your problem"
        />

        <View style={styles.totals}>
          <TotalRow label="Subtotal" value={vm.totals.subtotal} />
          {vm.totals.discount.isZero() ? null : (
            <TotalRow label="Discount" value={vm.totals.discount.negate()} />
          )}
          <TotalRow label="Taxable" value={vm.totals.taxable} />
          <TotalRow label="CGST" value={vm.totals.cgst} />
          <TotalRow label="SGST" value={vm.totals.sgst} />
          {vm.totals.roundOff.isZero() ? null : (
            <TotalRow label="Round off" value={vm.totals.roundOff} />
          )}
          <TotalRow label="Estimated total" value={vm.totals.grandTotal} emphasis />
        </View>

        {vm.errors.form ? <Text style={styles.formError}>{vm.errors.form}</Text> : null}
      </ScrollView>

      <SaveBar
        label={vm.isSaving ? 'Saving…' : `Save quotation · ${vm.totals.grandTotal.format()}`}
        onPress={() => void submit()}
        disabled={vm.isSaving}
      />

      <Modal
        visible={isPickingCustomer}
        animationType="slide"
        onRequestClose={() => setIsPickingCustomer(false)}
      >
        <CustomerPicker
          title="Who is this quotation for?"
          anonymousLabel="Counter enquiry"
          anonymousHint="No name on the quotation"
          onPick={(customer) => {
            vm.setCustomer(customer);
            setIsPickingCustomer(false);
          }}
          onClose={() => setIsPickingCustomer(false)}
        />
      </Modal>

      <Modal visible={isPicking} animationType="slide" onRequestClose={() => setIsPicking(false)}>
        <ProductPicker
          onPick={(product) => {
            vm.addProduct(product);
            setIsPicking(false);
          }}
          onClose={() => setIsPicking(false)}
        />
      </Modal>
    </KeyboardAvoidingView>
  );
}
