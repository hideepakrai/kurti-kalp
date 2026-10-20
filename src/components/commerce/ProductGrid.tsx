/**
 * ProductGrid — Responsive 2-column mobile, 4-column desktop grid.
 */

import React from 'react';
import { ProductSummary } from '../../domain/catalog';
import { ProductCard } from './ProductCard';

export function ProductGrid({
  products,
  prioritizeFirstRow = false,
}: {
  products: ProductSummary[];
  prioritizeFirstRow?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
      {products.map((product, index) => (
        <ProductCard
          key={product.id}
          product={product}
          priority={prioritizeFirstRow && index < 2}
        />
      ))}
    </div>
  );
}
