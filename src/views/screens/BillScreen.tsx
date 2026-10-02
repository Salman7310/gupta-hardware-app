import React, { useState } from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';
import { KeyboardAware } from '../components/KeyboardAware';
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
import { useConfirmLeave } from '../confirmLeave';
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

  const hasWork =
    !vm.isEmpty ||
    vm.customer !== null ||
    vm.draft.billDiscount.trim() !== '' ||
    vm.draft.paid.trim() !== '' ||
    vm.draft.notes.trim() !== '';
  const allowLeave = useConfirmLeave(
    hasWork,
    'Discard this bill?',
    'It has not been saved. The items and amounts you typed will be lost.',
  );

  const submit = async () => {
    const saved = await vm.save();
    if (!saved) return;
    allowLeave();
    onSaved(saved);
  };

  return (
    <KeyboardAware style={styles.flex}>
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

        {vm.chargesGstWithoutGstin ? (
          <View style={styles.gstWarning}>
            <Text style={styles.gstWarningTitle}>No GSTIN on file</Text>
            <Text style={styles.gstWarningBody}>
              This bill charges GST, but the shop has no GSTIN saved. Only a GST-registered shop
              may charge GST, and without one the bill is not printed as a tax invoice. Add the
              GSTIN in the Shop tab, or set GST to 0 on these products.
            </Text>
          </View>
        ) : null}

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
    </KeyboardAware>
  );
}
