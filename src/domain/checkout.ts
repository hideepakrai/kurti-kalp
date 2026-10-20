/**
 * Framework-independent Checkout, Quote, and Order domain contracts.
 * Separates order status from payment status and enforces quote revisions and idempotency.
 */

import { CartLineItem } from './cart';
import { Money } from './money';

export interface CustomerContact {
  fullName: string;
  email: string;
  phone: string;
}

export interface PostalAddress {
  recipientName: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string;
}

export interface ShippingMethodOption {
  id: string;
  title: string;
  dispatchEstimate: string;
  transitEstimate: string;
  fee: Money;
  eligible: boolean;
  ineligibilityReason?: string;
  requiresInquiry?: boolean;
  inquiryNote?: string;
}

export type PaymentMethodCode = 'PREPAID_INTENT' | 'CASH_ON_DELIVERY';

export interface PaymentMethodOption {
  code: PaymentMethodCode;
  title: string;
  description: string;
  eligible: boolean;
  ineligibilityReason?: string;
}

export interface CheckoutQuoteTotals {
  itemsSubtotal: Money;
  discountTotal: Money;
  shippingFee: Money;
  taxTotal: Money;
  payableTotal: Money;
}

export interface CheckoutQuoteInput {
  cartRevision: string;
  shippingAddress?: Partial<PostalAddress>;
  shippingMethodId?: string;
  idempotencyKey?: string;
}

export interface CheckoutQuote {
  quoteId: string;
  cartRevision: string;
  issuedAt: string;
  expiresAt: string;
  currency: string;
  items: CartLineItem[];
  selectedShippingMethodId: string;
  shippingMethods: ShippingMethodOption[];
  paymentMethods: PaymentMethodOption[];
  totals: CheckoutQuoteTotals;
  serviceabilityNote: string;
  isDemoQuote: boolean;
}

export interface CreateOrderInput {
  idempotencyKey: string;
  quoteId: string;
  cartRevision: string;
  contact: CustomerContact;
  shippingAddress: PostalAddress;
  billingSameAsShipping: boolean;
  billingAddress?: PostalAddress;
  shippingMethodId: string;
  paymentMethodCode: PaymentMethodCode;
}

export type OrderLifecycleStatus =
  | 'CREATED_DEMO_HOLD'
  | 'PENDING_MERCHANT_VERIFICATION'
  | 'CONFIRMED'
  | 'CANCELLED';

export type PaymentLifecycleStatus =
  | 'PENDING_PAYMENT_INTENT_HANDOFF'
  | 'COD_PENDING_COLLECTION_AT_DELIVERY'
  | 'UNPAID'
  | 'FAILED';

export interface PaymentHandoffAction {
  type: 'PROVIDER_INTENT_PLACEHOLDER' | 'COD_VERIFICATION_PLACEHOLDER';
  summary: string;
  nextStepInstruction: string;
  intentReference: string;
}

export interface OrderResult {
  orderId: string;
  orderReference: string;
  createdAt: string;
  idempotencyKey: string;
  quoteId: string;
  orderStatus: OrderLifecycleStatus;
  paymentStatus: PaymentLifecycleStatus;
  paymentMethodCode: PaymentMethodCode;
  paymentAction: PaymentHandoffAction;
  contact: CustomerContact;
  shippingAddress: PostalAddress;
  shippingMethod: ShippingMethodOption;
  items: CartLineItem[];
  totals: CheckoutQuoteTotals;
  isDemoOrder: boolean;
  demoDisclaimer: string;
}
