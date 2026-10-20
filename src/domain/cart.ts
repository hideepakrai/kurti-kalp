/**
 * Framework-independent Cart domain contracts.
 * Supports expected revision validation, conflict explanation, and idempotency keys on mutations.
 */

import { AvailabilityStatus, MediaAsset } from './catalog';
import { Money } from './money';

export interface CartLineItem {
  lineItemId: string;
  productId: string;
  productSlug: string;
  productTitle: string;
  variantId: string;
  sku: string;
  selectedOptions: Record<string, string>;
  quantity: number;
  maxAllowedQuantity: number;
  unitPrice: Money;
  compareAtUnitPrice?: Money;
  lineSubtotal: Money;
  image: MediaAsset;
  availability: AvailabilityStatus;
  setSummary: string;
  isDemoFixture: boolean;
}

export interface CartSummaryTotals {
  subtotal: Money;
  discountTotal: Money;
  payableSubtotal: Money;
  estimatedShippingNote: string;
  taxIncludedNote: string;
}

export interface Cart {
  id: string;
  revision: string;
  currency: string;
  itemCount: number;
  items: CartLineItem[];
  totals: CartSummaryTotals;
  adjustmentNotice?: string;
  updatedAt: string;
}

export interface AddCartItemInput {
  productId: string;
  variantId: string;
  quantity: number;
  expectedRevision?: string;
  idempotencyKey?: string;
}

export interface UpdateCartItemInput {
  lineItemId: string;
  quantity: number;
  expectedRevision?: string;
  idempotencyKey?: string;
}

export interface RemoveCartItemInput {
  lineItemId: string;
  expectedRevision?: string;
  idempotencyKey?: string;
}
