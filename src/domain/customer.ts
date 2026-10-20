/**
 * Framework-independent Customer Experience, Multi-Step Guest Order Access,
 * Support, Exchange, OTP Session, Address, Saved Item, and Review adapter contracts.
 *
 * Security & Authority Guarantees:
 * - Guest order access uses a 3-step flow:
 *   1. createGuestOrderChallenge(orderReference, email) -> returns challengeId (never OTP or proof)
 *   2. verifyGuestOrderChallenge(challengeId, orderReference, email, code) -> BFF stores short-lived
 *      proof server-side bound to (sessionId, tenantId, orderReference); browser never receives raw proof token.
 *   3. getVerifiedGuestOrder(orderReference) -> uses server-held proof only for the matching order.
 * - Saved items store only product identity references (`productId`, `productSlug`, `savedAt`) and
 *   optional live-resolved `liveProduct` from the authoritative catalog—never copied price/stock snapshots.
 * - Support and exchange writes include `idempotencyKey`.
 */

import { ProductSummary } from './catalog';
import { OrderResult, PostalAddress } from './checkout';

export type GuestOrderProofScope =
  | 'ORDER_DETAIL'
  | 'EXCHANGE_ELIGIBILITY'
  | 'EXCHANGE_REQUEST';

export interface GuestOrderChallengeInput {
  orderReference: string;
  email: string;
  idempotencyKey?: string;
}

export interface GuestOrderChallengeResult {
  challengeId: string;
  orderReference: string;
  maskedEmail: string;
  expiresAt: string;
  verificationStep: 'EMAIL_CODE_REQUIRED';
  isDemoChallenge: boolean;
}

export interface GuestOrderVerifyInput {
  challengeId: string;
  orderReference: string;
  email: string;
  code: string;
  idempotencyKey?: string;
}

export interface GuestOrderVerifyResult {
  verified: true;
  orderReference: string;
  proofExpiresAt: string;
  allowedScopes: GuestOrderProofScope[];
  isDemoVerification: boolean;
}

export interface SupportInquiryInput {
  idempotencyKey?: string;
  fullName: string;
  email: string;
  phone?: string;
  orderReference?: string;
  topic:
    | 'SIZING_FIT'
    | 'EXPRESS_SHIPPING_INQUIRY'
    | 'ORDER_STATUS'
    | 'EXCHANGE_ASSISTANCE'
    | 'GENERAL';
  message: string;
}

export interface SupportInquiryResult {
  inquiryReference: string;
  idempotencyKey: string;
  receivedAt: string;
  status: 'RECORDED_DEMO_ONLY' | 'QUEUED_FOR_SUPPORT';
  summaryMessage: string;
  isDemoRecord: boolean;
}

export type ExchangeReasonCode = 'SIZE_FIT_ISSUE' | 'DEFECTIVE_OR_DAMAGED_ITEM';

export interface ExchangeEligibilityQuery {
  orderReference: string;
  email?: string;
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
  idempotencyKey?: string;
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
  idempotencyKey: string;
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

/**
 * SavedItemEntry stores ONLY product identity references—never static price or stock copies.
 * Price and availability must always be resolved authoritatively from Kalp catalog on read.
 */
export interface SavedItemReference {
  productId: string;
  productSlug: string;
  savedAt: string;
  liveProduct?: ProductSummary;
}

export interface SavedItemsResult {
  items: SavedItemReference[];
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
