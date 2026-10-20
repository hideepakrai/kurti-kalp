/**
 * UnavailableStorefrontConnector — Honest connector used when the storefront
 * is in `unavailable` mode or when Demo Mode is requested in a production build
 * where demo fixtures are intentionally excluded.
 */

import { buildStorefrontCapabilities, GAYRAA_STOREFRONT_CONFIG } from '../config/storefront';
import { GAYRAA_NAVIGATION } from '../config/navigation';
import { StorefrontError } from '../domain/errors';
import { StorefrontConnector } from './storefront-connector';

export class UnavailableStorefrontConnector implements StorefrontConnector {
  private readonly reason: string;

  constructor(
    reason = 'Live Kalp Business API is not configured for this environment. The storefront refuses to serve fabricated live catalog or checkout data.'
  ) {
    this.reason = reason;
  }

  private unavailableError(): StorefrontError {
    return new StorefrontError({
      code: 'UPSTREAM_UNAVAILABLE',
      message: this.reason,
      recoverable: true,
      statusCode: 503,
    });
  }

  async getCapabilities() {
    return buildStorefrontCapabilities('unavailable');
  }

  async getStorefrontConfig() {
    return structuredClone(GAYRAA_STOREFRONT_CONFIG);
  }

  async getNavigation() {
    return structuredClone(GAYRAA_NAVIGATION);
  }

  async getHomePage(): Promise<never> {
    throw this.unavailableError();
  }

  async getCollections(): Promise<never> {
    throw this.unavailableError();
  }

  async getCollection(): Promise<never> {
    throw this.unavailableError();
  }

  async searchProducts(): Promise<never> {
    throw this.unavailableError();
  }

  async getProduct(): Promise<never> {
    throw this.unavailableError();
  }

  async getCart(): Promise<never> {
    throw this.unavailableError();
  }

  async addCartItem(): Promise<never> {
    throw this.unavailableError();
  }

  async updateCartItem(): Promise<never> {
    throw this.unavailableError();
  }

  async removeCartItem(): Promise<never> {
    throw this.unavailableError();
  }

  async getCheckoutQuote(): Promise<never> {
    throw this.unavailableError();
  }

  async createOrder(): Promise<never> {
    throw this.unavailableError();
  }

  async createGuestOrderChallenge(): Promise<never> {
    throw this.unavailableError();
  }

  async verifyGuestOrderChallenge(): Promise<never> {
    throw this.unavailableError();
  }

  async getVerifiedGuestOrder(): Promise<never> {
    throw this.unavailableError();
  }

  async submitSupportInquiry(): Promise<never> {
    throw this.unavailableError();
  }

  async checkExchangeEligibility(): Promise<never> {
    throw this.unavailableError();
  }

  async submitExchangeRequest(): Promise<never> {
    throw this.unavailableError();
  }

  async getCustomerSession(): Promise<never> {
    throw this.unavailableError();
  }

  async listCustomerOrders(): Promise<never> {
    throw this.unavailableError();
  }

  async getCustomerOrder(): Promise<never> {
    throw this.unavailableError();
  }

  async listCustomerAddresses(): Promise<never> {
    throw this.unavailableError();
  }

  async listSavedItems(): Promise<never> {
    throw this.unavailableError();
  }

  async listProductReviews(): Promise<never> {
    throw this.unavailableError();
  }
}
