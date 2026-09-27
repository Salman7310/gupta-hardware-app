import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, Text, View } from 'react-native';
import { Invoice } from '../../models/invoice';
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
import { BillStart, useBillViewModel } from '../../viewmodels/useBillViewModel';

interface Props {
  readonly onSaved: (invoice: Invoice) => void;
  /** Present when the bill was opened from a quotation the customer accepted. */
  readonly start?: BillStart;
}

export function BillScreen({ onSaved, start }: Props) {
  const vm = useBillViewModel(start);
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
        {vm.startedFrom ? (
          <Text style={styles.note}>
            Started from quotation {vm.startedFrom.quotationNo}. Change anything the customer has
            changed their mind about — nothing is charged until this is saved.
          </Text>
        ) : null}

        <CustomerCard
          customer={vm.customer}
          label="Customer"
          emptyLabel="Walk-in"
          onPress={() => setIsPickingCustomer(true)}
        />

        {vm.isEmpty ? (
          <Text style={styles.empty}>
            No items on this bill yet. Add the first one, and the total will follow as you type.
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
          label="Discount on the whole bill"
          value={vm.draft.billDiscount}
          onChange={vm.setBillDiscount}
          placeholder="Optional"
          prefix="₹"
          error={vm.errors.billDiscount}
          hint="Spread across the items before GST, so the tax stays right"
        />

        <EntryField
          label="Amount paid"
          value={vm.draft.paid}
          onChange={vm.setPaid}
          placeholder="Optional"
          prefix="₹"
          error={vm.errors.paid}
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
          <TotalRow label="Total" value={vm.totals.grandTotal} emphasis />
        </View>

        {vm.errors.form ? <Text style={styles.formError}>{vm.errors.form}</Text> : null}
      </ScrollView>

      <SaveBar
        label={vm.isSaving ? 'Saving…' : `Save bill · ${vm.totals.grandTotal.format()}`}
        onPress={() => void submit()}
        disabled={vm.isSaving}
      />

      <Modal
        visible={isPickingCustomer}
        animationType="slide"
        onRequestClose={() => setIsPickingCustomer(false)}
      >
        <CustomerPicker
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
