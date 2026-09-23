import React from 'react';
import { useRouter } from 'expo-router';
import { ProductListScreen } from '../src/views/screens/ProductListScreen';

export default function ProductsRoute() {
  const router = useRouter();

  return (
    <ProductListScreen
      onAdd={() => router.push('/product/new')}
      onEdit={(productId) => router.push(`/product/${productId}`)}
      onImport={() => router.push('/import')}
    />
  );
}
