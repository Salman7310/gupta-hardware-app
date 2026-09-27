import React from 'react';
import { useRouter } from 'expo-router';
import { QuotationListScreen } from '../../src/views/screens/QuotationListScreen';

export default function QuotesRoute() {
  const router = useRouter();

  return (
    <QuotationListScreen
      onOpen={(quotationId) => router.push(`/quote/${quotationId}`)}
      onNewQuotation={() => router.push('/quote/new')}
    />
  );
}
