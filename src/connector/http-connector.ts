/**
 * HttpStorefrontConnector — Production-ready HTTP connector for Connected Mode.
 *
 * Rules Enforced:
 * - Calls ONLY same-origin `/api/storefront/v1/*` endpoints (rejects external origins).
 * - Sends `credentials: 'same-origin'` (HttpOnly session cookies; zero bearer tokens or secrets in browser).
 * - Implements request timeouts, external AbortSignal support, typed response validation,
 *   and normalized `StorefrontError` mapping.
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
  FieldValidationIssue,
  StorefrontError,
  StorefrontErrorCode,
} from '../domain/errors';
import { assertValidMoney } from '../domain/money';
import { ConnectorRequestOptions, StorefrontConnector } from './storefront-connector';

export interface HttpStorefrontConnectorConfig {
  basePath?: string;
  defaultTimeoutMs?: number;
  fetchImpl?: typeof fetch;
}

interface BffErrorEnvelope {
  error?: {
    code?: StorefrontErrorCode;
    message?: string;
    recoverable?: boolean;
    fieldIssues?: FieldValidationIssue[];
    latestCartRevision?: string;
  };
}

export class HttpStorefrontConnector implements StorefrontConnector {
  private readonly basePath: string;
  private readonly defaultTimeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(config?: HttpStorefrontConnectorConfig) {
    const basePath = config?.basePath ?? '/api/storefront/v1';
    if (!basePath.startsWith('/api/storefront/v1')) {
      throw new Error(
        `HttpStorefrontConnector requires same-origin "/api/storefront/v1" prefix (received "${basePath}").`
      );
    }
    this.basePath = basePath.replace(/\/$/, '');
    this.defaultTimeoutMs = config?.defaultTimeoutMs ?? 8000;
    this.fetchFn = config?.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  private async requestJson<T>(
    path: string,
    init: RequestInit,
    options?: ConnectorRequestOptions,
    validator?: (data: unknown) => T
  ): Promise<T> {
    if (!path.startsWith('/')) {
      throw new Error(`Relative path must start with "/" (received "${path}")`);
    }

    const url = `${this.basePath}${path}`;
    const timeoutMs = options?.timeoutMs ?? this.defaultTimeoutMs;
    const timeoutController = new AbortController();
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      timeoutController.abort();
    }, timeoutMs);

    // Combine external AbortSignal with timeout signal
    const onExternalAbort = () => timeoutController.abort();
    if (options?.signal) {
      if (options.signal.aborted) {
        clearTimeout(timer);
        throw new StorefrontError({
          code: 'REQUEST_ABORTED',
          message: 'Request was cancelled.',
          recoverable: true,
        });
      }
      options.signal.addEventListener('abort', onExternalAbort, { once: true });
    }

    try {
      const response = await this.fetchFn(url, {
        ...init,
        credentials: 'same-origin',
        signal: timeoutController.signal,
        headers: {
          Accept: 'application/json',
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          ...(init.headers || {}),
        },
      });

      let payload: unknown = null;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        payload = await response.json();
      }

      if (!response.ok) {
        throw this.normalizeHttpError(response.status, payload);
      }

      if ( payload === null || typeof payload !== 'object') {
        throw new StorefrontError({
          code: 'NETWORK_FAILURE',
          message: 'Received malformed non-JSON response from storefront BFF.',
          statusCode: response.status,
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
        });
      }
      if (options?.signal?.aborted || (err instanceof Error && err.name === 'AbortError')) {
        throw new StorefrontError({
          code: 'REQUEST_ABORTED',
          message: 'Request was cancelled.',
          recoverable: true,
        });
      }
      throw new StorefrontError({
        code: 'NETWORK_FAILURE',
        message:
          err instanceof Error
            ? `Network request failed: ${err.message}`
            : 'Unable to reach same-origin storefront BFF.',
        recoverable: true,
      });
    } finally {
      clearTimeout(timer);
      if (options?.signal) {
        options.signal.removeEventListener('abort', onExternalAbort);
      }
    }
  }

  private normalizeHttpError(status: number, payload: unknown): StorefrontError {
    const envelope = (payload && typeof payload === 'object' ? payload : {}) as BffErrorEnvelope;
    const errObj = envelope.error;

    const fallbackCode: StorefrontErrorCode =
      status === 404
        ? 'NOT_FOUND'
        : status === 409
          ? 'CART_CONFLICT'
          : status === 422 || status === 400
            ? 'VALIDATION_ERROR'
            : status === 503 || status === 502
              ? 'UPSTREAM_UNAVAILABLE'
              : 'NETWORK_FAILURE';

    return new StorefrontError({
      code: errObj?.code ?? fallbackCode,
      message:
        errObj?.message ??
        (status === 503
          ? 'Storefront backend is currently unavailable or awaiting Kalp Business Core configuration.'
          : `Storefront API returned HTTP ${status}.`),
      recoverable: errObj?.recoverable ?? true,
      statusCode: status,
      fieldIssues: errObj?.fieldIssues,
      latestCartRevision: errObj?.latestCartRevision,
    });
  }

  private assertObject<T>(val: unknown, label: string): T {
    if (!val || typeof val !== 'object') {
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
    const params = new URLSearchParams();
    if (query.sizes?.length) params.set('sizes', query.sizes.join(','));
    if (query.fabrics?.length) params.set('fabrics', query.fabrics.join(','));
    if (typeof query.maxPriceMinor === 'number') {
      params.set('maxPriceMinor', String(query.maxPriceMinor));
    }
    if (query.inStockOnly) params.set('inStockOnly', 'true');
    if (query.sort) params.set('sort', query.sort);
    if (query.page) params.set('page', String(query.page));
    if (query.pageSize) params.set('pageSize', String(query.pageSize));

    const qs = params.toString();
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
    const params = new URLSearchParams();
    params.set('q', query.q || '');
    if (query.sizes?.length) params.set('sizes', query.sizes.join(','));
    if (query.fabrics?.length) params.set('fabrics', query.fabrics.join(','));
    if (typeof query.maxPriceMinor === 'number') {
      params.set('maxPriceMinor', String(query.maxPriceMinor));
    }
    if (query.inStockOnly) params.set('inStockOnly', 'true');
    if (query.sort) params.set('sort', query.sort);
    if (query.page) params.set('page', String(query.page));
    if (query.pageSize) params.set('pageSize', String(query.pageSize));

    return this.requestJson(
      `/search?${params.toString()}`,
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
    return this.requestJson(
      '/cart/items',
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
      options,
      (data) => this.assertObject<Cart>(data, 'Cart')
    );
  }

  async updateCartItem(
    input: UpdateCartItemInput,
    options?: ConnectorRequestOptions
  ): Promise<Cart> {
    return this.requestJson(
      `/cart/items/${encodeURIComponent(input.lineItemId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          quantity: input.quantity,
          expectedRevision: input.expectedRevision,
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
    const qs = input.expectedRevision
      ? `?expectedRevision=${encodeURIComponent(input.expectedRevision)}`
      : '';
    return this.requestJson(
      `/cart/items/${encodeURIComponent(input.lineItemId)}${qs}`,
      { method: 'DELETE' },
      options,
      (data) => this.assertObject<Cart>(data, 'Cart')
    );
  }

  async getCheckoutQuote(
    input: CheckoutQuoteInput,
    options?: ConnectorRequestOptions
  ): Promise<CheckoutQuote> {
    return this.requestJson(
      '/checkout/quote',
      {
        method: 'POST',
        body: JSON.stringify(input),
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
}
