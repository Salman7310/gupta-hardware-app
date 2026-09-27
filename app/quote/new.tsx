import React from 'react';
import { useRouter } from 'expo-router';
import { QuotationScreen } from '../../src/views/screens/QuotationScreen';

export default function NewQuotationRoute() {
  const router = useRouter();

  // Straight to the saved quotation, replacing the form so Back does not
  // reopen a draft that has already been written. Sharing the PDF is the next
  // thing the shopkeeper does, and it lives on that screen.
  return <QuotationScreen onSaved={(quotation) => router.replace(`/quote/${quotation.id}`)} />;
}
