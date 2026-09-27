import React from 'react';
import { useRouter } from 'expo-router';
import { ShopScreen } from '../../src/views/screens/ShopScreen';

export default function ShopRoute() {
  const router = useRouter();
  return <ShopScreen onImport={() => router.push('/import')} />;
}
