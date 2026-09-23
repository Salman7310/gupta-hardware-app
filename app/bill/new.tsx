import React from 'react';
import { useRouter } from 'expo-router';
import { BillScreen } from '../../src/views/screens/BillScreen';

export default function BillRoute() {
  const router = useRouter();

  // Straight to the bill that was written, replacing the form so Back does not
  // reopen a draft that has already been saved. Sprint 4 hangs the PDF and the
  // share sheet off that screen.
  return <BillScreen onSaved={(invoice) => router.replace(`/bill/${invoice.id}`)} />;
}
