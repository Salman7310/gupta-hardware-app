import React from 'react';
import { useRouter } from 'expo-router';
import { DuesScreen } from '../../src/views/screens/DuesScreen';

export default function DuesRoute() {
  const router = useRouter();
  return <DuesScreen onOpenBill={(invoiceId) => router.push(`/bill/${invoiceId}`)} />;
}
