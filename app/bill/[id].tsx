import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { InvoiceDetailScreen } from '../../src/views/screens/InvoiceDetailScreen';

export default function InvoiceRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <InvoiceDetailScreen invoiceId={id} />;
}
