/**
 * StorefrontConnector Contract.
 *
 * Pages and presentation components access commerce and CMS data strictly
 * through this interface. Supports optional AbortSignal and timeout options.
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

export interface ConnectorRequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface StorefrontConnector {
  getCapabilities(options?: ConnectorRequestOptions): Promise<StorefrontCapabilities>;
  getStorefrontConfig(options?: ConnectorRequestOptions): Promise<StorefrontConfig>;
  getNavigation(options?: ConnectorRequestOptions): Promise<Navigation>;
  getHomePage(options?: ConnectorRequestOptions): Promise<PageManifest>;
  getCollections(options?: ConnectorRequestOptions): Promise<CollectionMetadata[]>;
  getCollection(query: CollectionQuery, options?: ConnectorRequestOptions): Promise<CollectionResult>;
  searchProducts(query: SearchQuery, options?: ConnectorRequestOptions): Promise<CollectionResult>;
  getProduct(query: ProductQuery, options?: ConnectorRequestOptions): Promise<ProductDetail>;
  getCart(options?: ConnectorRequestOptions): Promise<Cart>;
  addCartItem(input: AddCartItemInput, options?: ConnectorRequestOptions): Promise<Cart>;
  updateCartItem(input: UpdateCartItemInput, options?: ConnectorRequestOptions): Promise<Cart>;
  removeCartItem(input: RemoveCartItemInput, options?: ConnectorRequestOptions): Promise<Cart>;
  getCheckoutQuote(input: CheckoutQuoteInput, options?: ConnectorRequestOptions): Promise<CheckoutQuote>;
  createOrder(input: CreateOrderInput, options?: ConnectorRequestOptions): Promise<OrderResult>;
}
