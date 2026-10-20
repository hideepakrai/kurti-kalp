/**
 * Framework-independent Customer Experience, Order Lookup, Support, Exchange,
 * OTP Session, Address, Saved Item, and Review adapter contracts.
 *
 * Prepared for Stage B Kalp Business API mapping. In connected mode, unmapped
 * endpoints return explicit UPSTREAM_UNAVAILABLE / UNAUTHORIZED states rather
 * than fabricated live data.
 */

import { ProductSummary } from './catalog';
import { OrderResult, PostalAddress } from './checkout';

export interface GuestOrderLookupInput {
  orderReference: string;
  emailOrPhone?: string;
}

export interface SupportInquiryInput {
  fullName: string;
  email: string;
  phone?: string;
  orderReference?: string;
  topic: 'SIZING_FIT' | 'EXPRESS_SHIPPING_INQUIRY' | 'ORDER_STATUS' | 'EXCHANGE_ASSISTANCE' | 'GENERAL';
  message: string;
}

export interface SupportInquiryResult {
  inquiryReference: string;
  receivedAt: string;
  status: 'RECORDED_DEMO_ONLY' | 'QUEUED_FOR_SUPPORT';
  summaryMessage: string;
  isDemoRecord: boolean;
}

export type ExchangeReasonCode = 'SIZE_FIT_ISSUE' | 'DEFECTIVE_OR_DAMAGED_ITEM';

export interface ExchangeEligibilityQuery {
  orderReference: string;
  emailOrPhone?: string;
}

export interface ExchangeEligibilityResult {
  orderReference: string;
  eligible: boolean;
  windowDays: number;
  deliveredWithinWindow: boolean;
  alreadyExchanged: boolean;
  allowedReasons: ExchangeReasonCode[];
  customerReturnShippingRequired: boolean;
  refundsAllowed: false;
  policySummary: string;
  ineligibilityReason?: string;
  isDemoRecord: boolean;
}

export interface SubmitExchangeRequestInput {
  orderReference: string;
  email: string;
  reason: ExchangeReasonCode;
  replacementSize?: string;
  notes?: string;
  confirmedWithin3Days: boolean;
  confirmedUnusedWithTags: boolean;
  confirmedCustomerReturnShipping: boolean;
}

export interface ExchangeRequestResult {
  exchangeReference: string;
  orderReference: string;
  createdAt: string;
  status: 'PENDING_DEMO_REVIEW' | 'AWAITING_CUSTOMER_RETURN_SHIPMENT';
  reason: ExchangeReasonCode;
  replacementSize?: string;
  returnShippingInstruction: string;
  isDemoRecord: boolean;
  demoDisclaimer: string;
}

export interface CustomerSession {
  authenticated: boolean;
  sessionStatus: 'AUTHENTICATED' | 'UNAUTHENTICATED' | 'SESSION_EXPIRED';
  customer?: {
    id: string;
    fullName: string;
    email: string;
    phone?: string;
  };
  isDemoSession: boolean;
}

export interface CustomerAddressRecord extends PostalAddress {
  id: string;
  label: string;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
}

export interface SavedItemsResult {
  items: ProductSummary[];
  updatedAt: string;
  isDemoRecord: boolean;
}

export interface ProductReviewItem {
  id: string;
  productId: string;
  authorName: string;
  rating: number;
  title: string;
  comment: string;
  verifiedPurchase: boolean;
  createdAt: string;
  isDemoFixture: boolean;
}

export interface ProductReviewsResult {
  productId: string;
  averageRating: number;
  totalCount: number;
  reviews: ProductReviewItem[];
  canSubmitReview: boolean;
  isDemoFixture: boolean;
}

export type CustomerOrderSummary = OrderResult;
