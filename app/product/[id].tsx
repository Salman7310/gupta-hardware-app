import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ProductFormScreen } from '../../src/views/screens/ProductFormScreen';

export default function ProductFormRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const productId = id === 'new' ? null : (id ?? null);

  return <ProductFormScreen productId={productId} onSaved={() => router.back()} />;
}
