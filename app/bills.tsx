import React from 'react';
import { useRouter } from 'expo-router';
import { InvoiceListScreen } from '../src/views/screens/InvoiceListScreen';

export default function BillsRoute() {
  const router = useRouter();
  return <InvoiceListScreen onOpen={(invoiceId) => router.push(`/bill/${invoiceId}`)} />;
}
