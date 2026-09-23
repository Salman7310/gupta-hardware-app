import React from 'react';
import { useRouter } from 'expo-router';
import { ProductImportScreen } from '../src/views/screens/ProductImportScreen';

export default function ImportRoute() {
  const router = useRouter();
  return <ProductImportScreen onDone={() => router.dismissTo('/')} />;
}
