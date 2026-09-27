import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { QuotationDetailScreen } from '../../src/views/screens/QuotationDetailScreen';

export default function QuotationRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  return (
    <QuotationDetailScreen
      quotationId={id}
      onMakeBill={(quotationId) => router.push(`/bill/new?from=${quotationId}`)}
      onOpenBill={(invoiceId) => router.push(`/bill/${invoiceId}`)}
    />
  );
}
