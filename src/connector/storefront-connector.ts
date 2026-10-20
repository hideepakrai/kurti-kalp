/**
 * Proposed StorefrontConnector Interface (Stage A Prototype -> Stage B Kalp Target)
 *
 * Pages and presentation components must access commerce and CMS data strictly
 * through this interface. Note: @kalp/storefront-connector is a planned future
 * dependency; Stage A binds this contract to the local replaceable mock adapter.
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

export interface StorefrontConnector {
  getCapabilities(): Promise<StorefrontCapabilities>;
  getStorefrontConfig(): Promise<StorefrontConfig>;
  getNavigation(): Promise<Navigation>;
  getHomePage(): Promise<PageManifest>;
  getCollections(): Promise<CollectionMetadata[]>;
  getCollection(query: CollectionQuery): Promise<CollectionResult>;
  searchProducts(query: SearchQuery): Promise<CollectionResult>;
  getProduct(query: ProductQuery): Promise<ProductDetail>;
  getCart(): Promise<Cart>;
  addCartItem(input: AddCartItemInput): Promise<Cart>;
  updateCartItem(input: UpdateCartItemInput): Promise<Cart>;
  removeCartItem(input: RemoveCartItemInput): Promise<Cart>;
  getCheckoutQuote(input: CheckoutQuoteInput): Promise<CheckoutQuote>;
  createOrder(input: CreateOrderInput): Promise<OrderResult>;
}
