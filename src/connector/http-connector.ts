/**
 * HttpStorefrontConnector — Production-ready HTTP connector for Connected Mode.
 *
 * Rules Enforced:
 * - Calls ONLY same-origin `/api/storefront/v1/*` endpoints (rejects external origins).
 * - Sends `credentials: 'include'` (HttpOnly session cookies; zero bearer tokens, proof tokens, or secrets in browser).
 * - Sends and tracks `X-Correlation-Id` on every request.
 * - Context-aware GET deduplication: deduplicates concurrent in-flight idempotent GET requests ONLY when
 *   they share the same URL AND request context (`correlationId`, `timeoutMs`, and no custom `AbortSignal`).
 * - Safe retry ONLY for idempotent GET reads on transient network/timeout/429/502/504 errors.
 * - Never automatically retries POST, PATCH, PUT, or DELETE mutations.
 * - Every implemented mutation sends an `Idempotency-Key` header.
 * - Never falls back to demo fixtures on failure or 503 UPSTREAM_UNAVAILABLE.
 */

import {
  AddCartItemInput,
  Cart,
  RemoveCartItemInput,
  UpdateCartItemInput,
} from '../domain/cart';
import {
  CollectionMetadata,
  CollectionQuery,
  CollectionResult,
  ProductDetail,
  ProductQuery,
  SearchQuery,
} from '../domain/catalog';
import {
  CheckoutQuote,
  CheckoutQuoteInput,
  CreateOrderInput,
  OrderResult,
} from '../domain/checkout';
import {
  Navigation,
  PageManifest,
  StorefrontCapabilities,
  StorefrontConfig,
} from '../domain/content';
import {
  CustomerAddressRecord,
  CustomerOrderSummary,
  CustomerSession,
  ExchangeEligibilityQuery,
  ExchangeEligibilityResult,
  ExchangeRequestResult,
  GuestOrderChallengeInput,
  GuestOrderChallengeResult,
  GuestOrderVerifyInput,
  GuestOrderVerifyResult,
  ProductReviewsResult,
  SavedItemsResult,
  SubmitExchangeRequestInput,
  SupportInquiryInput,
  SupportInquiryResult,
} from '../domain/customer';
import {
  FieldValidationIssue,
  StorefrontError,
  StorefrontErrorCode,
} from '../domain/errors';
import { assertValidMoney } from '../domain/money';
import { ConnectorRequestOptions, StorefrontConnector } from './storefront-connector';

export interface HttpStorefrontConnectorConfig {
  basePath?: string;
  defaultTimeoutMs?: number;
  maxReadRetries?: number;
  retryDelayMs?: number;
  fetchImpl?: typeof fetch;
}

interface BffErrorEnvelope {
  error?: {
    code?: StorefrontErrorCode;
    message?: string;
    recoverable?: boolean;
    correlationId?: string;
    retryAfterSeconds?: number;
    fieldIssues?: FieldValidationIssue[];
    latestCartRevision?: string;
  };
}

function generateCorrelationId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function generateIdempotencyKey(prefix = 'idem'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function buildCatalogQueryString(
  query: Partial<CollectionQuery & SearchQuery>,
  includeSearchQ = false
): string {
  const params = new URLSearchParams();
  if (includeSearchQ) {
    params.set('q', query.q || '');
  }
  if (query.sizes?.length) params.set('sizes', query.sizes.join(','));
  if (query.fabrics?.length) params.set('fabrics', query.fabrics.join(','));
  if (typeof query.maxPriceMinor === 'number') {
    params.set('maxPriceMinor', String(query.maxPriceMinor));
  }
  if (query.inStockOnly) params.set('inStockOnly', 'true');
  if (query.sort) params.set('sort', query.sort);
  if (query.page) params.set('page', String(query.page));
  if (query.pageSize) params.set('pageSize', String(query.pageSize));
  return params.toString();
}

export class HttpStorefrontConnector implements StorefrontConnector {
  private readonly basePath: string;
  private readonly defaultTimeoutMs: number;
  private readonly maxReadRetries: number;
  private readonly retryDelayMs: number;
  private readonly fetchFn: typeof fetch;
  private readonly inFlightGetRequests = new Map<string, Promise<unknown>>();

  constructor(config?: HttpStorefrontConnectorConfig) {
    const basePath = config?.basePath ?? '/api/storefront/v1';
    if (!basePath.startsWith('/api/storefront/v1') || /^https?:\/\//i.test(basePath)) {
      throw new Error(
        `HttpStorefrontConnector requires same-origin "/api/storefront/v1" prefix (received "${basePath}").`
      );
    }
    this.basePath = basePath.replace(/\/$/, '');
    this.defaultTimeoutMs = config?.defaultTimeoutMs ?? 8000;
    this.maxReadRetries = config?.maxReadRetries ?? 1;
    this.retryDelayMs = config?.retryDelayMs ?? 120;
    this.fetchFn = config?.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  private isTransientReadError(err: StorefrontError): boolean {
    return (
      err.code === 'NETWORK_FAILURE' ||
      err.code === 'TIMEOUT_ERROR' ||
      err.code === 'RATE_LIMITED' ||
      err.code === 'BAD_GATEWAY' ||
      err.code === 'SERVER_ERROR'
    );
  }

  private buildGetDeduplicationKey(url: string, options?: ConnectorRequestOptions): string | null {
    // Never merge requests that have an external AbortSignal or distinct caller correlation IDs
    if (options?.signal) {
      return null;
    }
    const correlationContext = options?.correlationId ? `cid:${options.correlationId}` : 'cid:auto';
    const timeoutContext = `t:${options?.timeoutMs ?? this.defaultTimeoutMs}`;
    return `GET|${url}|${correlationContext}|${timeoutContext}`;
  }

  private async requestJson<T>(
    path: string,
    init: RequestInit,
    options?: ConnectorRequestOptions,
    validator?: (data: unknown) => T
  ): Promise<T> {
    if (!path.startsWith('/') || path.startsWith('//')) {
      throw new Error(`Relative path must start with a single "/" (received "${path}")`);
    }

    const method = (init.method || 'GET').toUpperCase();
    const isIdempotentRead = method === 'GET';
    const url = `${this.basePath}${path}`;

    // Context-aware deduplication for identical concurrent GET requests
    if (isIdempotentRead) {
      const dedupKey = this.buildGetDeduplicationKey(url, options);
      if (dedupKey) {
        const existing = this.inFlightGetRequests.get(dedupKey);
        if (existing) {
          return (await existing) as T;
        }
        const promise = this.executeWithSafeRetry<T>(url, method, init, options, validator).finally(
          () => {
            this.inFlightGetRequests.delete(dedupKey);
          }
        );
        this.inFlightGetRequests.set(dedupKey, promise);
        return promise;
      }
    }

    return this.executeWithSafeRetry<T>(url, method, init, options, validator);
  }

  private async executeWithSafeRetry<T>(
    url: string,
    method: string,
    init: RequestInit,
    options?: ConnectorRequestOptions,
    validator?: (data: unknown) => T
  ): Promise<T> {
    // Never automatically retry POST, PATCH, PUT, or DELETE mutations
    const isIdempotentRead = method === 'GET';
    const allowedRetries = isIdempotentRead ? this.maxReadRetries : 0;
    let attempt = 0;

    while (true) {
      try {
        return await this.executeSingleAttempt<T>(url, method, init, options, validator);
      } catch (err) {
        const sfErr = err instanceof StorefrontError ? err : null;
        if (
          isIdempotentRead &&
          attempt < allowedRetries &&
          sfErr &&
          this.isTransientReadError(sfErr) &&
          !options?.signal?.aborted
        ) {
          attempt += 1;
          const waitMs = sfErr.retryAfterSeconds
            ? Math.min(sfErr.retryAfterSeconds * 1000, 1500)
            : this.retryDelayMs * attempt;
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }
        throw err;
      }
    }
  }

  private async executeSingleAttempt<T>(
    url: string,
    method: string,
    init: RequestInit,
    options?: ConnectorRequestOptions,
    validator?: (data: unknown) => T
  ): Promise<T> {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new StorefrontError({
        code: 'OFFLINE_ERROR',
        message: 'Your device appears to be offline. Please check your internet connection and retry.',
        recoverable: true,
      });
    }

    const correlationId = options?.correlationId || generateCorrelationId();
    const timeoutMs = options?.timeoutMs ?? this.defaultTimeoutMs;
    const timeoutController = new AbortController();
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      timeoutController.abort();
    }, timeoutMs);

    const onExternalAbort = () => timeoutController.abort();
    if (options?.signal) {
      if (options.signal.aborted) {
        clearTimeout(timer);
        throw new StorefrontError({
          code: 'REQUEST_ABORTED',
          message: 'Request was cancelled.',
          recoverable: true,
          correlationId,
        });
      }
      options.signal.addEventListener('abort', onExternalAbort, { once: true });
    }

    try {
      const response = await this.fetchFn(url, {
        ...init,
        method,
        credentials: 'include',
        signal: timeoutController.signal,
        headers: {
          Accept: 'application/json',
          'X-Correlation-Id': correlationId,
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          ...(init.headers || {}),
        },
      });

      const responseCorrelationId =
        response.headers.get('x-correlation-id') || correlationId;
      const retryAfterHeader = response.headers.get('retry-after');
      const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : undefined;

      let payload: unknown = null;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        payload = await response.json();
      }

      if (!response.ok) {
        throw this.normalizeHttpError(
          response.status,
          payload,
          responseCorrelationId,
          Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined
        );
      }

      if (payload === null || typeof payload !== 'object') {
        throw new StorefrontError({
          code: 'BAD_GATEWAY',
          message: 'Received malformed non-JSON response from storefront BFF.',
          statusCode: response.status,
          correlationId: responseCorrelationId,
          recoverable: true,
        });
      }

      return validator ? validator(payload) : (payload as T);
    } catch (err) {
      if (err instanceof StorefrontError) {
        throw err;
      }
      if (timedOut) {
        throw new StorefrontError({
          code: 'TIMEOUT_ERROR',
          message: `Storefront request timed out after ${timeoutMs}ms.`,
          recoverable: true,
          correlationId,
        });
      }
      if (options?.signal?.aborted || (err instanceof Error && err.name === 'AbortError')) {
        throw new StorefrontError({
          code: 'REQUEST_ABORTED',
          message: 'Request was cancelled.',
          recoverable: true,
          correlationId,
        });
      }
      throw new StorefrontError({
        code: 'NETWORK_FAILURE',
        message:
          err instanceof Error
            ? `Network request failed: ${err.message}`
            : 'Unable to reach same-origin storefront BFF.',
        recoverable: true,
        correlationId,
      });
    } finally {
      clearTimeout(timer);
      if (options?.signal) {
        options.signal.removeEventListener('abort', onExternalAbort);
      }
    }
  }

  private normalizeHttpError(
    status: number,
    payload: unknown,
    correlationId: string,
    retryAfterSeconds?: number
  ): StorefrontError {
    const envelope = (payload && typeof payload === 'object' ? payload : {}) as BffErrorEnvelope;
    const errObj = envelope.error;

    const fallbackCode: StorefrontErrorCode =
      status === 401
        ? 'UNAUTHORIZED'
        : status === 403
          ? 'FORBIDDEN'
          : status === 440
            ? 'SESSION_EXPIRED'
            : status === 404
              ? 'NOT_FOUND'
              : status === 409
                ? 'CART_CONFLICT'
                : status === 429
                  ? 'RATE_LIMITED'
                  : status === 422 || status === 400
                    ? 'VALIDATION_ERROR'
                    : status === 502
                      ? 'BAD_GATEWAY'
                      : status === 503
                        ? 'UPSTREAM_UNAVAILABLE'
                        : status >= 500
                          ? 'SERVER_ERROR'
                          : 'NETWORK_FAILURE';

    return new StorefrontError({
      code: errObj?.code ?? fallbackCode,
      message:
        errObj?.message ??
        (status === 503
          ? 'Storefront backend is currently unavailable or awaiting Kalp Business Core configuration.'
          : status === 502
            ? 'Upstream service returned an invalid response.'
            : status === 429
              ? 'Too many requests. Please wait a moment and try again.'
              : status === 401
                ? 'Verification or authentication is required to access this resource.'
                : status === 403
                  ? 'Access to this resource is not permitted with the current verification scope.'
                  : status === 440
                    ? 'Your session or verification proof has expired.'
                    : `Storefront API returned HTTP ${status}.`),
      recoverable: errObj?.recoverable ?? true,
      statusCode: status,
      correlationId: errObj?.correlationId ?? correlationId,
      retryAfterSeconds: errObj?.retryAfterSeconds ?? retryAfterSeconds,
      fieldIssues: errObj?.fieldIssues,
      latestCartRevision: errObj?.latestCartRevision,
    });
  }

  private assertObject<T>(val: unknown, label: string): T {
    if (!val || typeof val !== 'object' || Array.isArray(val)) {
      throw new StorefrontError({
        code: 'VALIDATION_ERROR',
        message: `Invalid ${label} payload returned by BFF.`,
        recoverable: true,
      });
    }
    return val as T;
  }

  async getCapabilities(options?: ConnectorRequestOptions): Promise<StorefrontCapabilities> {
    return this.requestJson(
      '/capabilities',
      { method: 'GET' },
      options,
      (data) => this.assertObject<StorefrontCapabilities>(data, 'StorefrontCapabilities')
    );
  }

  async getStorefrontConfig(options?: ConnectorRequestOptions): Promise<StorefrontConfig> {
    return this.requestJson(
      '/config',
      { method: 'GET' },
      options,
      (data) => this.assertObject<StorefrontConfig>(data, 'StorefrontConfig')
    );
  }

  async getNavigation(options?: ConnectorRequestOptions): Promise<Navigation> {
    return this.requestJson(
      '/navigation',
      { method: 'GET' },
      options,
      (data) => this.assertObject<Navigation>(data, 'Navigation')
    );
  }

  async getHomePage(options?: ConnectorRequestOptions): Promise<PageManifest> {
    return this.requestJson(
      '/home',
      { method: 'GET' },
      options,
      (data) => this.assertObject<PageManifest>(data, 'PageManifest')
    );
  }

  async getCollections(options?: ConnectorRequestOptions): Promise<CollectionMetadata[]> {
    return this.requestJson('/collections', { method: 'GET' }, options, (data) => {
      if (!Array.isArray(data)) {
        throw new StorefrontError({
          code: 'VALIDATION_ERROR',
          message: 'Expected array of collections from BFF.',
          recoverable: true,
        });
      }
      return data as CollectionMetadata[];
    });
  }

  async getCollection(
    query: CollectionQuery,
    options?: ConnectorRequestOptions
  ): Promise<CollectionResult> {
    const qs = buildCatalogQueryString(query, false);
    return this.requestJson(
      `/collections/${encodeURIComponent(query.slug)}${qs ? `?${qs}` : ''}`,
      { method: 'GET' },
      options,
      (data) => this.assertObject<CollectionResult>(data, 'CollectionResult')
    );
  }

  async searchProducts(
    query: SearchQuery,
    options?: ConnectorRequestOptions
  ): Promise<CollectionResult> {
    const qs = buildCatalogQueryString(query, true);
    return this.requestJson(
      `/search?${qs}`,
      { method: 'GET' },
      options,
      (data) => this.assertObject<CollectionResult>(data, 'CollectionResult')
    );
  }

  async getProduct(query: ProductQuery, options?: ConnectorRequestOptions): Promise<ProductDetail> {
    return this.requestJson(
      `/products/${encodeURIComponent(query.slug)}`,
      { method: 'GET' },
      options,
      (data) => {
        const detail = this.assertObject<ProductDetail>(data, 'ProductDetail');
        assertValidMoney(detail.startingPrice, 'ProductDetail.startingPrice');
        return detail;
      }
    );
  }

  async getCart(options?: ConnectorRequestOptions): Promise<Cart> {
    return this.requestJson('/cart', { method: 'GET' }, options, (data) => {
      const cart = this.assertObject<Cart>(data, 'Cart');
      assertValidMoney(cart.totals.payableSubtotal, 'Cart.totals.payableSubtotal');
      return cart;
    });
  }

  async addCartItem(input: AddCartItemInput, options?: ConnectorRequestOptions): Promise<Cart> {
    const idempotencyKey = input.idempotencyKey || generateIdempotencyKey('idem_cart_add');
    return this.requestJson(
      '/cart/items',
      {
        method: 'POST',
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({ ...input, idempotencyKey }),
      },
      options,
      (data) => this.assertObject<Cart>(data, 'Cart')
    );
  }

  async updateCartItem(
    input: UpdateCartItemInput,
    options?: ConnectorRequestOptions
  ): Promise<Cart> {
    const idempotencyKey = input.idempotencyKey || generateIdempotencyKey('idem_cart_upd');
    return this.requestJson(
      `/cart/items/${encodeURIComponent(input.lineItemId)}`,
      {
        method: 'PATCH',
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          quantity: input.quantity,
          expectedRevision: input.expectedRevision,
          idempotencyKey,
        }),
      },
      options,
      (data) => this.assertObject<Cart>(data, 'Cart')
    );
  }

  async removeCartItem(
    input: RemoveCartItemInput,
    options?: ConnectorRequestOptions
  ): Promise<Cart> {
    const idempotencyKey = input.idempotencyKey || generateIdempotencyKey('idem_cart_rem');
    const qs = input.expectedRevision
      ? `?expectedRevision=${encodeURIComponent(input.expectedRevision)}`
      : '';
    return this.requestJson(
      `/cart/items/${encodeURIComponent(input.lineItemId)}${qs}`,
      {
        method: 'DELETE',
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
      },
      options,
      (data) => this.assertObject<Cart>(data, 'Cart')
    );
  }

  async getCheckoutQuote(
    input: CheckoutQuoteInput,
    options?: ConnectorRequestOptions
  ): Promise<CheckoutQuote> {
    const idempotencyKey = input.idempotencyKey || generateIdempotencyKey('idem_quote');
    return this.requestJson(
      '/checkout/quote',
      {
        method: 'POST',
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({ ...input, idempotencyKey }),
      },
      options,
      (data) => {
        const quote = this.assertObject<CheckoutQuote>(data, 'CheckoutQuote');
        assertValidMoney(quote.totals.payableTotal, 'CheckoutQuote.totals.payableTotal');
        return quote;
      }
    );
  }

  async createOrder(
    input: CreateOrderInput,
    options?: ConnectorRequestOptions
  ): Promise<OrderResult> {
    if (!input.idempotencyKey || input.idempotencyKey.trim().length < 6) {
      throw new StorefrontError({
        code: 'VALIDATION_ERROR',
        message: 'A valid idempotencyKey is required for order submission.',
        recoverable: true,
      });
    }
    return this.requestJson(
      '/orders',
      {
        method: 'POST',
        headers: {
          'Idempotency-Key': input.idempotencyKey,
        },
        body: JSON.stringify(input),
      },
      options,
      (data) => {
        const order = this.assertObject<OrderResult>(data, 'OrderResult');
        assertValidMoney(order.totals.payableTotal, 'OrderResult.totals.payableTotal');
        return order;
      }
    );
  }

  async createGuestOrderChallenge(
    input: GuestOrderChallengeInput,
    options?: ConnectorRequestOptions
  ): Promise<GuestOrderChallengeResult> {
    const idempotencyKey = input.idempotencyKey || generateIdempotencyKey('idem_ord_chal');
    return this.requestJson(
      '/orders/lookup/challenge',
      {
        method: 'POST',
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          orderReference: input.orderReference,
          email: input.email,
          idempotencyKey,
        }),
      },
      options,
      (data) => this.assertObject<GuestOrderChallengeResult>(data, 'GuestOrderChallengeResult')
    );
  }

  async verifyGuestOrderChallenge(
    input: GuestOrderVerifyInput,
    options?: ConnectorRequestOptions
  ): Promise<GuestOrderVerifyResult> {
    const idempotencyKey = input.idempotencyKey || generateIdempotencyKey('idem_ord_ver');
    return this.requestJson(
      '/orders/lookup/verify',
      {
        method: 'POST',
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          challengeId: input.challengeId,
          orderReference: input.orderReference,
          email: input.email,
          code: input.code,
          idempotencyKey,
        }),
      },
      options,
      (data) => this.assertObject<GuestOrderVerifyResult>(data, 'GuestOrderVerifyResult')
    );
  }

  async getVerifiedGuestOrder(
    orderReference: string,
    options?: ConnectorRequestOptions
  ): Promise<OrderResult> {
    return this.requestJson(
      `/orders/lookup/${encodeURIComponent(orderReference.trim().toUpperCase())}`,
      { method: 'GET' },
      options,
      (data) => {
        const order = this.assertObject<OrderResult>(data, 'OrderResult');
        assertValidMoney(order.totals.payableTotal, 'OrderResult.totals.payableTotal');
        return order;
      }
    );
  }

  async submitSupportInquiry(
    input: SupportInquiryInput,
    options?: ConnectorRequestOptions
  ): Promise<SupportInquiryResult> {
    const idempotencyKey = input.idempotencyKey || generateIdempotencyKey('idem_support');
    return this.requestJson(
      '/support/inquiries',
      {
        method: 'POST',
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({ ...input, idempotencyKey }),
      },
      options,
      (data) => this.assertObject<SupportInquiryResult>(data, 'SupportInquiryResult')
    );
  }

  async checkExchangeEligibility(
    query: ExchangeEligibilityQuery,
    options?: ConnectorRequestOptions
  ): Promise<ExchangeEligibilityResult> {
    const params = new URLSearchParams({ orderReference: query.orderReference });
    if (query.email) params.set('email', query.email);
    return this.requestJson(
      `/exchanges/eligibility?${params.toString()}`,
      { method: 'GET' },
      options,
      (data) => this.assertObject<ExchangeEligibilityResult>(data, 'ExchangeEligibilityResult')
    );
  }

  async submitExchangeRequest(
    input: SubmitExchangeRequestInput,
    options?: ConnectorRequestOptions
  ): Promise<ExchangeRequestResult> {
    const idempotencyKey = input.idempotencyKey || generateIdempotencyKey('idem_exchange');
    return this.requestJson(
      '/exchanges',
      {
        method: 'POST',
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({ ...input, idempotencyKey }),
      },
      options,
      (data) => this.assertObject<ExchangeRequestResult>(data, 'ExchangeRequestResult')
    );
  }

  async getCustomerSession(options?: ConnectorRequestOptions): Promise<CustomerSession> {
    return this.requestJson(
      '/customer/session',
      { method: 'GET' },
      options,
      (data) => this.assertObject<CustomerSession>(data, 'CustomerSession')
    );
  }

  async listCustomerOrders(options?: ConnectorRequestOptions): Promise<CustomerOrderSummary[]> {
    return this.requestJson('/customer/orders', { method: 'GET' }, options, (data) => {
      if (!Array.isArray(data)) {
        throw new StorefrontError({
          code: 'VALIDATION_ERROR',
          message: 'Expected array of customer orders from BFF.',
          recoverable: true,
        });
      }
      return data as CustomerOrderSummary[];
    });
  }

  async getCustomerOrder(
    orderId: string,
    options?: ConnectorRequestOptions
  ): Promise<CustomerOrderSummary> {
    return this.requestJson(
      `/customer/orders/${encodeURIComponent(orderId)}`,
      { method: 'GET' },
      options,
      (data) => this.assertObject<CustomerOrderSummary>(data, 'CustomerOrderSummary')
    );
  }

  async listCustomerAddresses(options?: ConnectorRequestOptions): Promise<CustomerAddressRecord[]> {
    return this.requestJson('/customer/addresses', { method: 'GET' }, options, (data) => {
      if (!Array.isArray(data)) {
        throw new StorefrontError({
          code: 'VALIDATION_ERROR',
          message: 'Expected array of customer addresses from BFF.',
          recoverable: true,
        });
      }
      return data as CustomerAddressRecord[];
    });
  }

  async listSavedItems(options?: ConnectorRequestOptions): Promise<SavedItemsResult> {
    return this.requestJson(
      '/customer/saved',
      { method: 'GET' },
      options,
      (data) => this.assertObject<SavedItemsResult>(data, 'SavedItemsResult')
    );
  }

  async listProductReviews(
    productId: string,
    options?: ConnectorRequestOptions
  ): Promise<ProductReviewsResult> {
    return this.requestJson(
      `/products/${encodeURIComponent(productId)}/reviews`,
      { method: 'GET' },
      options,
      (data) => this.assertObject<ProductReviewsResult>(data, 'ProductReviewsResult')
    );
  }
}
