/**
 * Kalp Business API Upstream Contract Adapter (`server/kalp-upstream-adapter.ts`).
 *
 * Responsibilities:
 * - Translates verified Kalp Business API `{ data, meta }` envelopes into typed Storefront domain models
 *   strictly inside the server BFF boundary.
 * - Enforces a strict outbound header allowlist (`Accept`, `Content-Type`, `X-Correlation-Id`,
 *   server-owned `X-Tenant-DB`, server-owned `Authorization`, `Idempotency-Key` on mutations,
 *   and server-held `X-Order-Access-Proof` only on proof-protected guest order routes).
 * - Never forwards browser-supplied privileged headers, cookies, or unvalidated parameters.
 * - Never retries POST, PATCH, PUT, or DELETE mutations; allows 1 safe retry on transient GET errors.
 * - Rejects malformed upstream responses or missing `{ data }` envelopes with a normalized 502 `BAD_GATEWAY`.
 * - Strips any raw OTP, secret, or proof token from public browser payloads.
 */

import {
  AvailabilityStatus,
  CollectionMetadata,
  CollectionResult,
  MediaAsset,
  ProductDetail,
  ProductSummary,
  ProductVariant,
} from '../src/domain/catalog.ts';
import { OrderResult } from '../src/domain/checkout.ts';
import { PageManifest } from '../src/domain/content.ts';
import {
  GuestOrderChallengeResult,
  GuestOrderVerifyResult,
} from '../src/domain/customer.ts';
import { StorefrontError, StorefrontErrorCode } from '../src/domain/errors.ts';
import { assertValidMoney, createMoney, Money } from '../src/domain/money.ts';

export interface KalpUpstreamEnvironmentConfig {
  upstreamBaseUrl: string;
  tenantDb: string;
  serverApiCredential?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export interface OutboundKalpRequestOptions {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  correlationId: string;
  idempotencyKey?: string;
  orderAccessProofToken?: string;
  body?: Record<string, unknown>;
}

/**
 * Strict allowlist of outbound headers that the BFF is permitted to send to Kalp Business API.
 */
const ALLOWED_OUTBOUND_HEADERS = new Set([
  'accept',
  'content-type',
  'x-correlation-id',
  'x-tenant-db',
  'authorization',
  'idempotency-key',
  'x-order-access-proof',
]);

function isRecord(val: unknown): val is Record<string, unknown> {
  return Boolean(val) && typeof val === 'object' && !Array.isArray(val);
}

function maskEmail(email: string): string {
  const [local, domain] = email.trim().split('@');
  if (!local || !domain) return '***@***';
  const prefix = local.slice(0, Math.min(2, local.length));
  return `${prefix}***@${domain}`;
}

export function buildStrictOutboundHeaders(
  env: KalpUpstreamEnvironmentConfig,
  reqOptions: OutboundKalpRequestOptions
): Record<string, string> {
  const rawHeaders: Record<string, string> = {
    Accept: 'application/json',
    'X-Correlation-Id': reqOptions.correlationId,
    'X-Tenant-DB': env.tenantDb,
  };

  if (env.serverApiCredential?.trim()) {
    rawHeaders.Authorization = `Bearer ${env.serverApiCredential.trim()}`;
  }

  if (reqOptions.body !== undefined) {
    rawHeaders['Content-Type'] = 'application/json';
  }

  if (reqOptions.idempotencyKey) {
    rawHeaders['Idempotency-Key'] = reqOptions.idempotencyKey;
  }

  if (reqOptions.orderAccessProofToken) {
    rawHeaders['X-Order-Access-Proof'] = reqOptions.orderAccessProofToken;
  }

  // Enforce strict outbound allowlist check
  const verifiedHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawHeaders)) {
    if (ALLOWED_OUTBOUND_HEADERS.has(key.toLowerCase()) && typeof value === 'string' && value.length > 0) {
      verifiedHeaders[key] = value;
    }
  }
  return verifiedHeaders;
}

function unwrapKalpDataEnvelope(payload: unknown, correlationId: string): unknown {
  if (!isRecord(payload) || !('data' in payload) || payload.data === undefined || payload.data === null) {
    throw new StorefrontError({
      code: 'BAD_GATEWAY',
      message: 'Upstream Kalp Business API returned a malformed response (missing { data } envelope).',
      statusCode: 502,
      correlationId,
      recoverable: true,
    });
  }
  return payload.data;
}

function parseKalpMoney(raw: unknown, fieldLabel: string, correlationId: string): Money {
  if (!isRecord(raw)) {
    throw new StorefrontError({
      code: 'BAD_GATEWAY',
      message: `Upstream Kalp payload contains invalid Money object at ${fieldLabel}.`,
      statusCode: 502,
      correlationId,
      recoverable: true,
    });
  }
  const amountMinor = Number(raw.amountMinor);
  const currency = typeof raw.currency === 'string' ? raw.currency : 'INR';
  const minorUnitDigits = typeof raw.minorUnitDigits === 'number' ? raw.minorUnitDigits : 2;
  try {
    const money = createMoney(amountMinor, currency, minorUnitDigits);
    assertValidMoney(money, fieldLabel);
    return money;
  } catch {
    throw new StorefrontError({
      code: 'BAD_GATEWAY',
      message: `Upstream Kalp payload failed integer minor-unit Money validation at ${fieldLabel}.`,
      statusCode: 502,
      correlationId,
      recoverable: true,
    });
  }
}

function parseKalpMediaAsset(raw: unknown, correlationId: string): MediaAsset {
  if (!isRecord(raw) || typeof raw.url !== 'string' || !raw.url.trim()) {
    throw new StorefrontError({
      code: 'BAD_GATEWAY',
      message: 'Upstream Kalp media asset is missing a valid url.',
      statusCode: 502,
      correlationId,
      recoverable: true,
    });
  }
  const validRatios = ['3:4', '16:9', '1:1', '4:3'] as const;
  const aspectRatio = validRatios.includes(raw.aspectRatio as (typeof validRatios)[number])
    ? (raw.aspectRatio as (typeof validRatios)[number])
    : '3:4';

  return {
    id: typeof raw.id === 'string' ? raw.id : 'kalp-media',
    url: raw.url,
    srcSet: typeof raw.srcSet === 'string' ? raw.srcSet : undefined,
    sizes: typeof raw.sizes === 'string' ? raw.sizes : undefined,
    alt: typeof raw.alt === 'string' ? raw.alt : 'Product image',
    width: typeof raw.width === 'number' ? raw.width : 900,
    height: typeof raw.height === 'number' ? raw.height : 1200,
    aspectRatio,
    isDemoFixture: false,
  };
}

function parseAvailability(raw: unknown): AvailabilityStatus {
  if (raw === 'IN_STOCK' || raw === 'LOW_STOCK' || raw === 'OUT_OF_STOCK') {
    return raw;
  }
  return 'OUT_OF_STOCK';
}

function parseKalpProductSummary(raw: unknown, correlationId: string): ProductSummary {
  if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.slug !== 'string' || typeof raw.title !== 'string') {
    throw new StorefrontError({
      code: 'BAD_GATEWAY',
      message: 'Upstream Kalp product summary is missing required id, slug, or title.',
      statusCode: 502,
      correlationId,
      recoverable: true,
    });
  }
  return {
    id: raw.id,
    slug: raw.slug,
    title: raw.title,
    categorySlug: typeof raw.categorySlug === 'string' ? raw.categorySlug : 'all',
    categoryName: typeof raw.categoryName === 'string' ? raw.categoryName : 'Collection',
    fabricTag: typeof raw.fabricTag === 'string' ? raw.fabricTag : '',
    setSummary: typeof raw.setSummary === 'string' ? raw.setSummary : '',
    startingPrice: parseKalpMoney(raw.startingPrice, 'ProductSummary.startingPrice', correlationId),
    compareAtPrice: raw.compareAtPrice
      ? parseKalpMoney(raw.compareAtPrice, 'ProductSummary.compareAtPrice', correlationId)
      : undefined,
    availability: parseAvailability(raw.availability),
    availableSizes: Array.isArray(raw.availableSizes)
      ? raw.availableSizes.filter((s): s is string => typeof s === 'string')
      : [],
    primaryImage: parseKalpMediaAsset(raw.primaryImage, correlationId),
    secondaryImage: raw.secondaryImage
      ? parseKalpMediaAsset(raw.secondaryImage, correlationId)
      : undefined,
    occasions: Array.isArray(raw.occasions)
      ? raw.occasions.filter((o): o is string => typeof o === 'string')
      : [],
    isNewArrival: Boolean(raw.isNewArrival),
    isBestSeller: Boolean(raw.isBestSeller),
    isDemoFixture: false,
  };
}

export function translateKalpHomePageEnvelope(
  envelope: unknown,
  correlationId: string
): PageManifest {
  const data = unwrapKalpDataEnvelope(envelope, correlationId);
  if (!isRecord(data) || !Array.isArray(data.sections)) {
    throw new StorefrontError({
      code: 'BAD_GATEWAY',
      message: 'Upstream Kalp homepage manifest is missing sections array.',
      statusCode: 502,
      correlationId,
      recoverable: true,
    });
  }
  return {
    schemaVersion: '1.0',
    pageId: typeof data.pageId === 'string' ? data.pageId : 'home',
    title: typeof data.title === 'string' ? data.title : 'Storefront Home',
    isDemoManifest: false,
    sections: data.sections as PageManifest['sections'],
  };
}

export function translateKalpCollectionsEnvelope(
  envelope: unknown,
  correlationId: string
): CollectionMetadata[] {
  const data = unwrapKalpDataEnvelope(envelope, correlationId);
  if (!Array.isArray(data)) {
    throw new StorefrontError({
      code: 'BAD_GATEWAY',
      message: 'Upstream Kalp collections response data must be an array.',
      statusCode: 502,
      correlationId,
      recoverable: true,
    });
  }
  return data.map((item) => {
    if (!isRecord(item) || typeof item.id !== 'string' || typeof item.slug !== 'string' || typeof item.title !== 'string') {
      throw new StorefrontError({
        code: 'BAD_GATEWAY',
        message: 'Upstream Kalp collection metadata is missing id, slug, or title.',
        statusCode: 502,
        correlationId,
        recoverable: true,
      });
    }
    return {
      id: item.id,
      slug: item.slug,
      title: item.title,
      description: typeof item.description === 'string' ? item.description : '',
      kind:
        item.kind === 'ALL' || item.kind === 'MERCHANDISING' || item.kind === 'OCCASION'
          ? item.kind
          : 'CATEGORY',
      editorialImage: item.editorialImage
        ? parseKalpMediaAsset(item.editorialImage, correlationId)
        : undefined,
      isDemoFixture: false,
    };
  });
}

export function translateKalpCollectionResultEnvelope(
  envelope: unknown,
  fallbackSlug: string,
  correlationId: string
): CollectionResult {
  const data = unwrapKalpDataEnvelope(envelope, correlationId);
  if (!isRecord(data) || !Array.isArray(data.products)) {
    throw new StorefrontError({
      code: 'BAD_GATEWAY',
      message: 'Upstream Kalp collection result is missing products array.',
      statusCode: 502,
      correlationId,
      recoverable: true,
    });
  }

  const colRaw = isRecord(data.collection)
    ? data.collection
    : { id: fallbackSlug, slug: fallbackSlug, title: fallbackSlug, description: '' };

  const products = data.products.map((p) => parseKalpProductSummary(p, correlationId));
  const facetsRaw = isRecord(data.facets) ? data.facets : {};

  return {
    collection: {
      id: typeof colRaw.id === 'string' ? colRaw.id : fallbackSlug,
      slug: typeof colRaw.slug === 'string' ? colRaw.slug : fallbackSlug,
      title: typeof colRaw.title === 'string' ? colRaw.title : fallbackSlug,
      description: typeof colRaw.description === 'string' ? colRaw.description : '',
      kind:
        colRaw.kind === 'ALL' || colRaw.kind === 'MERCHANDISING' || colRaw.kind === 'OCCASION'
          ? colRaw.kind
          : 'CATEGORY',
      isDemoFixture: false,
    },
    products,
    totalCount: typeof data.totalCount === 'number' ? data.totalCount : products.length,
    page: typeof data.page === 'number' ? data.page : 1,
    pageSize: typeof data.pageSize === 'number' ? data.pageSize : 12,
    totalPages: typeof data.totalPages === 'number' ? data.totalPages : 1,
    facets: {
      sizes: Array.isArray(facetsRaw.sizes) ? (facetsRaw.sizes as CollectionResult['facets']['sizes']) : [],
      fabrics: Array.isArray(facetsRaw.fabrics)
        ? (facetsRaw.fabrics as CollectionResult['facets']['fabrics'])
        : [],
      priceRanges: Array.isArray(facetsRaw.priceRanges)
        ? (facetsRaw.priceRanges as CollectionResult['facets']['priceRanges'])
        : [],
    },
    appliedQuery: isRecord(data.appliedQuery)
      ? (data.appliedQuery as CollectionResult['appliedQuery'])
      : {
          sizes: [],
          fabrics: [],
          inStockOnly: false,
          sort: 'FEATURED',
        },
  };
}

export function translateKalpProductDetailEnvelope(
  envelope: unknown,
  correlationId: string
): ProductDetail {
  const data = unwrapKalpDataEnvelope(envelope, correlationId);
  if (!isRecord(data) || !Array.isArray(data.variants) || data.variants.length === 0) {
    throw new StorefrontError({
      code: 'BAD_GATEWAY',
      message: 'Upstream Kalp product detail is missing authoritative variants.',
      statusCode: 502,
      correlationId,
      recoverable: true,
    });
  }

  const summary = parseKalpProductSummary(data, correlationId);
  const variants: ProductVariant[] = data.variants.map((v, idx) => {
    if (!isRecord(v) || typeof v.id !== 'string' || typeof v.sku !== 'string') {
      throw new StorefrontError({
        code: 'BAD_GATEWAY',
        message: `Upstream Kalp variant at index ${idx} is missing id or sku.`,
        statusCode: 502,
        correlationId,
        recoverable: true,
      });
    }
    return {
      id: v.id,
      sku: v.sku,
      title: typeof v.title === 'string' ? v.title : v.sku,
      selectedOptions: isRecord(v.selectedOptions)
        ? (v.selectedOptions as Record<string, string>)
        : {},
      price: parseKalpMoney(v.price, `ProductDetail.variants[${idx}].price`, correlationId),
      compareAtPrice: v.compareAtPrice
        ? parseKalpMoney(v.compareAtPrice, `ProductDetail.variants[${idx}].compareAtPrice`, correlationId)
        : undefined,
      availability: parseAvailability(v.availability),
      unavailableReason: typeof v.unavailableReason === 'string' ? v.unavailableReason : undefined,
    };
  });

  const specsRaw = isRecord(data.specifications) ? data.specifications : {};

  return {
    ...summary,
    description: typeof data.description === 'string' ? data.description : '',
    gallery: Array.isArray(data.gallery)
      ? data.gallery.map((m) => parseKalpMediaAsset(m, correlationId))
      : [summary.primaryImage],
    optionDefinitions: Array.isArray(data.optionDefinitions)
      ? (data.optionDefinitions as ProductDetail['optionDefinitions'])
      : [],
    variants,
    measurements: Array.isArray(data.measurements)
      ? (data.measurements as ProductDetail['measurements'])
      : [],
    specifications: {
      fabric: typeof specsRaw.fabric === 'string' ? specsRaw.fabric : summary.fabricTag,
      craftTechnique: typeof specsRaw.craftTechnique === 'string' ? specsRaw.craftTechnique : '',
      setInclusions: Array.isArray(specsRaw.setInclusions)
        ? specsRaw.setInclusions.filter((s): s is string => typeof s === 'string')
        : [],
      silhouetteNote: typeof specsRaw.silhouetteNote === 'string' ? specsRaw.silhouetteNote : '',
      washCare: typeof specsRaw.washCare === 'string' ? specsRaw.washCare : '',
      origin: typeof specsRaw.origin === 'string' ? specsRaw.origin : 'India',
    },
    relatedProductIds: Array.isArray(data.relatedProductIds)
      ? data.relatedProductIds.filter((id): id is string => typeof id === 'string')
      : [],
    relatedProducts: Array.isArray(data.relatedProducts)
      ? data.relatedProducts.map((rp) => parseKalpProductSummary(rp, correlationId))
      : [],
    demoFixtureNotice: '',
  };
}

export function translateKalpGuestChallengeEnvelope(
  envelope: unknown,
  requestedOrderReference: string,
  requestedEmail: string,
  correlationId: string
): GuestOrderChallengeResult {
  const data = unwrapKalpDataEnvelope(envelope, correlationId);
  if (!isRecord(data) || typeof data.challengeId !== 'string' || !data.challengeId.trim()) {
    throw new StorefrontError({
      code: 'BAD_GATEWAY',
      message: 'Upstream Kalp guest order challenge response is missing challengeId.',
      statusCode: 502,
      correlationId,
      recoverable: true,
    });
  }

  // Strictly return only safe public challenge fields—never forward any OTP, code, or proofToken
  return {
    challengeId: data.challengeId,
    orderReference: requestedOrderReference.trim().toUpperCase(),
    maskedEmail:
      typeof data.maskedEmail === 'string' && data.maskedEmail.includes('*')
        ? data.maskedEmail
        : maskEmail(requestedEmail),
    expiresAt:
      typeof data.expiresAt === 'string'
        ? data.expiresAt
        : new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    verificationStep: 'EMAIL_CODE_REQUIRED',
    isDemoChallenge: false,
  };
}

export function translateKalpGuestVerifyEnvelope(
  envelope: unknown,
  requestedOrderReference: string,
  correlationId: string
): {
  publicResult: GuestOrderVerifyResult;
  serverOnlyProofToken: string;
  expiresAtMs: number;
} {
  const data = unwrapKalpDataEnvelope(envelope, correlationId);
  if (!isRecord(data) || typeof data.proofToken !== 'string' || !data.proofToken.trim()) {
    throw new StorefrontError({
      code: 'BAD_GATEWAY',
      message: 'Upstream Kalp guest verification response did not provide a valid server proof token.',
      statusCode: 502,
      correlationId,
      recoverable: true,
    });
  }

  const expiresAtIso =
    typeof data.proofExpiresAt === 'string'
      ? data.proofExpiresAt
      : new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const parsedMs = Date.parse(expiresAtIso);
  const expiresAtMs = Number.isFinite(parsedMs) ? parsedMs : Date.now() + 10 * 60 * 1000;

  return {
    serverOnlyProofToken: data.proofToken.trim(),
    expiresAtMs,
    publicResult: {
      verified: true,
      orderReference: requestedOrderReference.trim().toUpperCase(),
      proofExpiresAt: new Date(expiresAtMs).toISOString(),
      allowedScopes: ['ORDER_DETAIL', 'EXCHANGE_ELIGIBILITY', 'EXCHANGE_REQUEST'],
      isDemoVerification: false,
    },
  };
}

export function translateKalpOrderDetailEnvelope(
  envelope: unknown,
  correlationId: string
): OrderResult {
  const data = unwrapKalpDataEnvelope(envelope, correlationId);
  if (
    !isRecord(data) ||
    typeof data.orderId !== 'string' ||
    typeof data.orderReference !== 'string' ||
    !isRecord(data.totals)
  ) {
    throw new StorefrontError({
      code: 'BAD_GATEWAY',
      message: 'Upstream Kalp order detail response is missing required order fields.',
      statusCode: 502,
      correlationId,
      recoverable: true,
    });
  }

  const payableTotal = parseKalpMoney(
    data.totals.payableTotal,
    'OrderResult.totals.payableTotal',
    correlationId
  );

  return {
    ...(data as unknown as OrderResult),
    totals: {
      itemsSubtotal: data.totals.itemsSubtotal
        ? parseKalpMoney(data.totals.itemsSubtotal, 'OrderResult.totals.itemsSubtotal', correlationId)
        : payableTotal,
      discountTotal: data.totals.discountTotal
        ? parseKalpMoney(data.totals.discountTotal, 'OrderResult.totals.discountTotal', correlationId)
        : createMoney(0, payableTotal.currency, payableTotal.minorUnitDigits),
      shippingFee: data.totals.shippingFee
        ? parseKalpMoney(data.totals.shippingFee, 'OrderResult.totals.shippingFee', correlationId)
        : createMoney(0, payableTotal.currency, payableTotal.minorUnitDigits),
      taxTotal: data.totals.taxTotal
        ? parseKalpMoney(data.totals.taxTotal, 'OrderResult.totals.taxTotal', correlationId)
        : createMoney(0, payableTotal.currency, payableTotal.minorUnitDigits),
      payableTotal,
    },
    isDemoOrder: false,
    demoDisclaimer: '',
  };
}

export class KalpUpstreamClient {
  private readonly env: KalpUpstreamEnvironmentConfig;
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;

  constructor(env: KalpUpstreamEnvironmentConfig) {
    this.env = env;
    this.fetchFn = env.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.timeoutMs = env.timeoutMs ?? 6000;
  }

  async requestEnvelope(reqOptions: OutboundKalpRequestOptions): Promise<unknown> {
    const isIdempotentRead = reqOptions.method === 'GET';
    const maxRetries = isIdempotentRead ? 1 : 0; // Never retry POST, PATCH, PUT, DELETE
    let attempt = 0;

    while (true) {
      try {
        return await this.executeSingleUpstreamCall(reqOptions);
      } catch (err) {
        const sfErr = err instanceof StorefrontError ? err : null;
        const isTransient =
          sfErr &&
          (sfErr.code === 'NETWORK_FAILURE' ||
            sfErr.code === 'TIMEOUT_ERROR' ||
            sfErr.code === 'RATE_LIMITED' ||
            sfErr.code === 'SERVER_ERROR');

        if (isIdempotentRead && attempt < maxRetries && isTransient) {
          attempt += 1;
          await new Promise((r) => setTimeout(r, 80));
          continue;
        }
        throw err;
      }
    }
  }

  private async executeSingleUpstreamCall(reqOptions: OutboundKalpRequestOptions): Promise<unknown> {
    const baseUrl = this.env.upstreamBaseUrl.replace(/\/$/, '');
    const url = `${baseUrl}${reqOptions.path}`;
    const headers = buildStrictOutboundHeaders(this.env, reqOptions);

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeoutMs);

    try {
      const response = await this.fetchFn(url, {
        method: reqOptions.method,
        headers,
        body: reqOptions.body !== undefined ? JSON.stringify(reqOptions.body) : undefined,
        signal: controller.signal,
      });

      const contentType = response.headers.get('content-type') || '';
      let payload: unknown = null;
      if (contentType.includes('application/json')) {
        try {
          payload = await response.json();
        } catch {
          throw new StorefrontError({
            code: 'BAD_GATEWAY',
            message: 'Upstream Kalp service returned unreadable JSON.',
            statusCode: 502,
            correlationId: reqOptions.correlationId,
            recoverable: true,
          });
        }
      }

      if (!response.ok) {
        const status = response.status;
        const code: StorefrontErrorCode =
          status === 401
            ? 'UNAUTHORIZED'
            : status === 403
              ? 'FORBIDDEN'
              : status === 404
                ? 'NOT_FOUND'
                : status === 409
                  ? 'IDEMPOTENCY_CONFLICT'
                  : status === 422 || status === 400
                    ? 'VALIDATION_ERROR'
                    : status === 429
                      ? 'RATE_LIMITED'
                      : status === 503
                        ? 'UPSTREAM_UNAVAILABLE'
                        : 'SERVER_ERROR';

        // Sanitize error message so upstream URLs, tenant DB names, and secrets never leak
        const safeMessage =
          status === 404
            ? 'Requested resource was not found in Kalp catalog or order records.'
            : status === 401 || status === 403
              ? 'Order verification failed or access is not permitted.'
              : status === 422 || status === 400
                ? 'Upstream Kalp validation rejected the request parameters.'
                : status === 429
                  ? 'Upstream service rate limit reached. Please retry shortly.'
                  : 'Upstream Kalp Business API returned an error response.';

        throw new StorefrontError({
          code,
          message: safeMessage,
          statusCode: status >= 500 && status !== 503 ? 502 : status,
          correlationId: reqOptions.correlationId,
          recoverable: true,
        });
      }

      if (payload === null || !isRecord(payload)) {
        throw new StorefrontError({
          code: 'BAD_GATEWAY',
          message: 'Upstream Kalp Business API returned a non-object JSON payload.',
          statusCode: 502,
          correlationId: reqOptions.correlationId,
          recoverable: true,
        });
      }

      return payload;
    } catch (err) {
      if (err instanceof StorefrontError) {
        throw err;
      }
      if (timedOut) {
        throw new StorefrontError({
          code: 'TIMEOUT_ERROR',
          message: 'Upstream Kalp Business API request timed out.',
          statusCode: 504,
          correlationId: reqOptions.correlationId,
          recoverable: true,
        });
      }
      throw new StorefrontError({
        code: 'UPSTREAM_UNAVAILABLE',
        message: 'Unable to reach Kalp Business API upstream service.',
        statusCode: 503,
        correlationId: reqOptions.correlationId,
        recoverable: true,
      });
    } finally {
      clearTimeout(timer);
    }
  }
}
