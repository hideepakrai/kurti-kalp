/**
 * StorefrontConnector Contract.
 *
 * Pages and presentation components access commerce, CMS, and customer-care data
 * strictly through this interface. Supports optional AbortSignal, timeout, and correlation ID.
 */

import { Cart, AddCartItemInput, UpdateCartItemInput, RemoveCartItemInput } from '../domain/cart';
import {
  CollectionMetadata,
  CollectionQuery,
  CollectionResult,
  ProductDetail,
  ProductQuery,
  SearchQuery,
} from '../domain/catalog';
import { CheckoutQuote, CheckoutQuoteInput, CreateOrderInput, OrderResult } from '../domain/checkout';
import { Navigation, PageManifest, StorefrontCapabilities, StorefrontConfig } from '../domain/content';
import {
  CustomerAddressRecord,
  CustomerOrderSummary,
  CustomerSession,
  ExchangeEligibilityQuery,
  ExchangeEligibilityResult,
  ExchangeRequestResult,
  GuestOrderLookupInput,
  ProductReviewsResult,
  SavedItemsResult,
  SubmitExchangeRequestInput,
  SupportInquiryInput,
  SupportInquiryResult,
} from '../domain/customer';

export interface ConnectorRequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  correlationId?: string;
}

export interface StorefrontConnector {
  // Bootstrap, Configuration, Navigation & CMS Homepage
  getCapabilities(options?: ConnectorRequestOptions): Promise<StorefrontCapabilities>;
  getStorefrontConfig(options?: ConnectorRequestOptions): Promise<StorefrontConfig>;
  getNavigation(options?: ConnectorRequestOptions): Promise<Navigation>;
  getHomePage(options?: ConnectorRequestOptions): Promise<PageManifest>;

  // Catalog, Collections, Search, Product Detail & Variants
  getCollections(options?: ConnectorRequestOptions): Promise<CollectionMetadata[]>;
  getCollection(query: CollectionQuery, options?: ConnectorRequestOptions): Promise<CollectionResult>;
  searchProducts(query: SearchQuery, options?: ConnectorRequestOptions): Promise<CollectionResult>;
  getProduct(query: ProductQuery, options?: ConnectorRequestOptions): Promise<ProductDetail>;

  // Cart & Revision Conflict Handling
  getCart(options?: ConnectorRequestOptions): Promise<Cart>;
  addCartItem(input: AddCartItemInput, options?: ConnectorRequestOptions): Promise<Cart>;
  updateCartItem(input: UpdateCartItemInput, options?: ConnectorRequestOptions): Promise<Cart>;
  removeCartItem(input: RemoveCartItemInput, options?: ConnectorRequestOptions): Promise<Cart>;

  // Checkout Quote, Expiry, Idempotency & Orders
  getCheckoutQuote(input: CheckoutQuoteInput, options?: ConnectorRequestOptions): Promise<CheckoutQuote>;
  createOrder(input: CreateOrderInput, options?: ConnectorRequestOptions): Promise<OrderResult>;

  // Guest Order Lookup & Support
  lookupOrder(input: GuestOrderLookupInput, options?: ConnectorRequestOptions): Promise<OrderResult>;
  submitSupportInquiry(
    input: SupportInquiryInput,
    options?: ConnectorRequestOptions
  ): Promise<SupportInquiryResult>;

  // 3-Day Exchange Eligibility & Request Status
  checkExchangeEligibility(
    query: ExchangeEligibilityQuery,
    options?: ConnectorRequestOptions
  ): Promise<ExchangeEligibilityResult>;
  submitExchangeRequest(
    input: SubmitExchangeRequestInput,
    options?: ConnectorRequestOptions
  ): Promise<ExchangeRequestResult>;

  // Customer OTP Session, Orders, Addresses, Saved Items & Reviews
  getCustomerSession(options?: ConnectorRequestOptions): Promise<CustomerSession>;
  listCustomerOrders(options?: ConnectorRequestOptions): Promise<CustomerOrderSummary[]>;
  getCustomerOrder(orderId: string, options?: ConnectorRequestOptions): Promise<CustomerOrderSummary>;
  listCustomerAddresses(options?: ConnectorRequestOptions): Promise<CustomerAddressRecord[]>;
  listSavedItems(options?: ConnectorRequestOptions): Promise<SavedItemsResult>;
  listProductReviews(productId: string, options?: ConnectorRequestOptions): Promise<ProductReviewsResult>;
}
