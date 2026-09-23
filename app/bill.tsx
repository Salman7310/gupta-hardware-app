import React from 'react';
import { useRouter } from 'expo-router';
import { BillScreen } from '../src/views/screens/BillScreen';

export default function BillRoute() {
  const router = useRouter();

  // Back to where billing started once the bill is written. The PDF and the
  // share sheet are Sprint 4; until then saving is the end of the journey.
  return <BillScreen onSaved={() => router.back()} />;
}
