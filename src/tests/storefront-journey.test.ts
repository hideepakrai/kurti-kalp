/**
 * Comprehensive Automated Verification Suite for GAYRAA Storefront:
 * 1. Domain & Money minor-unit unit tests
 * 2. Hardened URL query parameter sanitization unit tests
 * 3. Explicit Runtime Modes (demo, connected, unavailable) & UnavailableStorefrontConnector tests
 * 4. HttpStorefrontConnector contract tests (same-origin enforcement, cookie credentials, timeout, abort, 503 mapping)
 * 5. Express Storefront BFF (/api/storefront/v1/*) live HTTP integration tests
 * 6. End-to-End Customer Journeys (Catalog, Search, Variant Matrix, Cart Revision, Checkout Quote Expiry & Idempotency)
 * 7. Dynamic Merchandising Slots & WCAG Contrast / Security Boundary audit
 */

import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { createStorefrontBffRouter } from '../../server/storefront-bff';
import { buildStorefrontCapabilities } from '../config/storefront';
import {
  composeStorefrontConnector,
  HttpStorefrontConnector,
  UnavailableStorefrontConnector,
} from '../connector';
import { StorefrontError } from '../domain/errors';
import { assertValidMoney, createMoney, formatMoney } from '../domain/money';
import { sanitizeCollectionSearchParams } from '../pages/CollectionPage';
import { LocalMockStorefrontConnector } from '../testing/mock-connector';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

function relativeLuminance(hex: string): number {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

async function runTests() {
  console.log('Running GAYRAA Storefront Unit, BFF, Journey & Accessibility Verification...');

  // ---------------------------------------------------------------------------
  // 1. Unit Tests: Money Minor-Unit Domain & URL Query Sanitization
  // ---------------------------------------------------------------------------
  const validMoney = createMoney(349000, 'INR', 2);
  assertValidMoney(validMoney);
  assert(formatMoney(validMoney).includes('3,490'), 'Money formats minor units accurately');

  let floatRejected = false;
  try {
    createMoney(3490.5, 'INR', 2);
  } catch {
    floatRejected = true;
  }
  assert(floatRejected, 'createMoney rejects non-integer float amounts');

  const dirtyParams = new URLSearchParams(
    'q=' +
      'a'.repeat(160) +
      '&page=-12&maxPrice=notanumber&sort=INVALID_SORT&inStock=invalid&sizes=S,M'
  );
  const sanitized = sanitizeCollectionSearchParams(dirtyParams);
  assert(sanitized.hadInvalidParams === true, 'Detects malformed URL query parameters');
  assert(sanitized.page === 1, 'Negative page falls back safely to page 1');
  assert(sanitized.maxPriceMinor === undefined, 'Non-numeric maxPrice is safely ignored');
  assert(sanitized.sort === 'FEATURED', 'Unknown sort option falls back to FEATURED');
  assert(sanitized.q.length === 120, 'Overly long search query is clamped to 120 chars');
  assert(sanitized.sizes.join(',') === 'S,M', 'Valid size filters are preserved');
  console.log('✓ 1. Domain Money & URL query sanitization unit tests passed');

  // ---------------------------------------------------------------------------
  // 2. Explicit Modes & UnavailableStorefrontConnector Honesty Tests
  // ---------------------------------------------------------------------------
  const demoCaps = buildStorefrontCapabilities('demo');
  const connectedCaps = buildStorefrontCapabilities('connected');
  const unavailableCaps = buildStorefrontCapabilities('unavailable');

  assert(demoCaps.mode === 'demo' && demoCaps.liveKalpConnected === false, 'Demo mode capabilities honest');
  assert(
    connectedCaps.mode === 'connected' && connectedCaps.liveKalpConnected === false,
    'Connected mode does not claim live Kalp connection prematurely'
  );
  assert(
    unavailableCaps.mode === 'unavailable' &&
      !unavailableCaps.cartEnabled &&
      !unavailableCaps.searchEnabled,
    'Unavailable mode disables commerce capabilities cleanly'
  );

  const composedUnavailable = await composeStorefrontConnector('unavailable');
  assert(
    composedUnavailable.effectiveMode === 'unavailable' &&
      composedUnavailable.connector instanceof UnavailableStorefrontConnector,
    'composeStorefrontConnector returns UnavailableStorefrontConnector for unavailable mode'
  );

  let unavailableThrew = false;
  try {
    await composedUnavailable.connector.getHomePage();
  } catch (err) {
    unavailableThrew = err instanceof StorefrontError && err.code === 'UPSTREAM_UNAVAILABLE';
  }
  assert(
    unavailableThrew,
    'UnavailableStorefrontConnector throws UPSTREAM_UNAVAILABLE instead of fake data'
  );
  console.log('✓ 2. Explicit modes & UnavailableStorefrontConnector honesty tests passed');

  // ---------------------------------------------------------------------------
  // 3. HttpStorefrontConnector Contract Tests (Same-Origin, Cookies, Abort, Timeout)
  // ---------------------------------------------------------------------------
  let externalOriginRejected = false;
  try {
    new HttpStorefrontConnector({ basePath: 'https://external-kalp.example.com/api' });
  } catch {
    externalOriginRejected = true;
  }
  assert(
    externalOriginRejected,
    'HttpStorefrontConnector rejects non-same-origin base paths'
  );

  // Verify credentials: 'same-origin' and timeout handling via mock fetch
  let capturedInit: RequestInit | undefined;
  const mockFetchConnector = new HttpStorefrontConnector({
    basePath: '/api/storefront/v1',
    defaultTimeoutMs: 50,
    fetchImpl: async (_input, init) => {
      capturedInit = init;
      return new Response(JSON.stringify(buildStorefrontCapabilities('connected')), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });

  const fetchedCaps = await mockFetchConnector.getCapabilities();
  assert(fetchedCaps.mode === 'connected', 'HttpStorefrontConnector parses typed capabilities');
  assert(
    capturedInit?.credentials === 'same-origin',
    'HttpStorefrontConnector always sends credentials: same-origin'
  );

  // Verify AbortController cancellation
  const abortController = new AbortController();
  abortController.abort();
  let abortCaught = false;
  try {
    await mockFetchConnector.getCapabilities({ signal: abortController.signal });
  } catch (err) {
    abortCaught = err instanceof StorefrontError && err.code === 'REQUEST_ABORTED';
  }
  assert(abortCaught, 'HttpStorefrontConnector handles pre-aborted AbortSignal');

  // Verify Timeout handling
  const slowFetchConnector = new HttpStorefrontConnector({
    basePath: '/api/storefront/v1',
    defaultTimeoutMs: 30,
    fetchImpl: (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const abortErr = new Error('Aborted');
          abortErr.name = 'AbortError';
          reject(abortErr);
        });
      }),
  });
  let timeoutCaught = false;
  try {
    await slowFetchConnector.getHomePage();
  } catch (err) {
    timeoutCaught = err instanceof StorefrontError && err.code === 'TIMEOUT_ERROR';
  }
  assert(timeoutCaught, 'HttpStorefrontConnector normalizes request timeouts to TIMEOUT_ERROR');
  console.log('✓ 3. HttpStorefrontConnector unit tests (same-origin, cookies, abort, timeout) passed');

  // ---------------------------------------------------------------------------
  // 4. Express Storefront BFF (/api/storefront/v1/*) Live Integration Tests
  // ---------------------------------------------------------------------------
  const app = express();
  app.use('/api/storefront/v1', createStorefrontBffRouter());
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const bffOrigin = `http://127.0.0.1:${port}`;

  try {
    const healthRes = await fetch(`${bffOrigin}/api/storefront/v1/health`);
    assert(healthRes.status === 200, 'BFF /health returns 200');
    const setCookieHeader = healthRes.headers.get('set-cookie') || '';
    assert(
      setCookieHeader.includes('gayraa_sf_sid=') && setCookieHeader.includes('HttpOnly'),
      'BFF sets HttpOnly session cookie gayraa_sf_sid'
    );
    const healthJson = (await healthRes.json()) as { liveKalpConnected: boolean };
    assert(
      healthJson.liveKalpConnected === false,
      'BFF /health honestly reports liveKalpConnected: false'
    );

    // Connect HttpStorefrontConnector to live BFF via custom fetch forwarding to ephemeral port
    const bffHttpConnector = new HttpStorefrontConnector({
      basePath: '/api/storefront/v1',
      fetchImpl: (input, init) => fetch(`${bffOrigin}${String(input)}`, init),
    });

    const bffConfig = await bffHttpConnector.getStorefrontConfig();
    assert(
      bffConfig.businessName === 'GAYRAA' &&
        bffConfig.legalEntityName === 'ROHIT SHARMA SHREE NARAYAN MANUFACTURER',
      'BFF /config returns verified GAYRAA storefront config'
    );

    const bffNav = await bffHttpConnector.getNavigation();
    assert(bffNav.primary.length === 4, 'BFF /navigation returns primary navigation');

    // Catalog, Cart, and Checkout endpoints on BFF must return 503 UPSTREAM_UNAVAILABLE
    let bffHomeUnavailable = false;
    try {
      await bffHttpConnector.getHomePage();
    } catch (err) {
      bffHomeUnavailable =
        err instanceof StorefrontError &&
        err.code === 'UPSTREAM_UNAVAILABLE' &&
        err.statusCode === 503;
    }
    assert(
      bffHomeUnavailable,
      'BFF /home returns 503 UPSTREAM_UNAVAILABLE stub and never serves fake catalog data'
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  console.log('✓ 4. Express Storefront BFF (/api/storefront/v1/*) integration tests passed');

  // ---------------------------------------------------------------------------
  // 5. End-to-End Customer Journeys & Dynamic Merchandising Slots (Demo Mode)
  // ---------------------------------------------------------------------------
  const connector = new LocalMockStorefrontConnector({ latencyMs: 0, quoteTtlMs: 60_000 });

  const manifest = await connector.getHomePage();
  const sectionTypes = manifest.sections.map((s) => s.type);
  assert(
    sectionTypes.includes('hero') &&
      sectionTypes.includes('editorial-story-block') &&
      sectionTypes.includes('campaign-banner-slot') &&
      sectionTypes.includes('product-collection') &&
      sectionTypes.includes('service-policy-strip'),
    'Homepage manifest includes all dynamic merchandising slots'
  );

  const allCollection = await connector.getCollection({ slug: 'all', pageSize: 20 });
  assert(
    allCollection.totalCount >= 6 && allCollection.products.length === allCollection.totalCount,
    `Catalog has ${allCollection.totalCount} product-specific Jaipur demo fixtures`
  );

  const searchRes = await connector.searchProducts({ q: 'Chanderi' });
  assert(searchRes.totalCount >= 1, 'Search query for Chanderi returns matching products');

  // Variant matrix & Add to Bag
  const sareeProduct = await connector.getProduct({ slug: 'vaani-ivory-zari-tissue-organza-saree' });
  const inStockVariant = sareeProduct.variants.find((v) => v.availability === 'IN_STOCK')!;
  const updatedCart = await connector.addCartItem({
    productId: sareeProduct.id,
    variantId: inStockVariant.id,
    quantity: 1,
  });
  assert(updatedCart.items.length === 2, 'Cart contains 2 line items after adding saree');

  // Revision conflict detection
  let conflictDetected = false;
  try {
    await connector.updateCartItem({
      lineItemId: updatedCart.items[0].lineItemId,
      quantity: 2,
      expectedRevision: 'rev_stale_0',
    });
  } catch (err) {
    conflictDetected = err instanceof StorefrontError && err.code === 'CART_CONFLICT';
  }
  assert(conflictDetected, 'Stale cart revision triggers CART_CONFLICT');

  // Checkout quote expiry & idempotent order creation
  const currentCart = await connector.getCart();
  const quote = await connector.getCheckoutQuote({
    cartRevision: currentCart.revision,
    shippingAddress: {
      postalCode: '302029',
      city: 'Jaipur',
      state: 'Rajasthan',
      countryCode: 'IN',
    },
  });
  assert(quote.totals.shippingFee.amountMinor === 0, 'Standard Pan-India shipping is free');

  connector.expireActiveQuotesNow();
  let expiredQuoteRejected = false;
  try {
    await connector.createOrder({
      idempotencyKey: 'idem_test_expired_01',
      quoteId: quote.quoteId,
      cartRevision: currentCart.revision,
      contact: { fullName: 'Test User', email: 'test@example.com', phone: '9876543210' },
      shippingAddress: {
        recipientName: 'Test User',
        line1: '12 Jaipur Gate, Sanganer',
        city: 'Jaipur',
        state: 'Rajasthan',
        postalCode: '302029',
        countryCode: 'IN',
      },
      billingSameAsShipping: true,
      shippingMethodId: 'ship-standard-free',
      paymentMethodCode: 'PREPAID_INTENT',
    });
  } catch (err) {
    expiredQuoteRejected = err instanceof StorefrontError && err.code === 'QUOTE_EXPIRED';
  }
  assert(expiredQuoteRejected, 'Expired checkout quote is rejected with QUOTE_EXPIRED');

  const freshQuote = await connector.getCheckoutQuote({
    cartRevision: currentCart.revision,
    shippingAddress: {
      postalCode: '302029',
      city: 'Jaipur',
      state: 'Rajasthan',
      countryCode: 'IN',
    },
  });

  const orderInput = {
    idempotencyKey: 'idem_test_valid_order_99',
    quoteId: freshQuote.quoteId,
    cartRevision: currentCart.revision,
    contact: { fullName: 'Test User', email: 'test@example.com', phone: '9876543210' },
    shippingAddress: {
      recipientName: 'Test User',
      line1: '12 Jaipur Gate, Sanganer',
      city: 'Jaipur',
      state: 'Rajasthan',
      postalCode: '302029',
      countryCode: 'IN',
    },
    billingSameAsShipping: true,
    shippingMethodId: 'ship-standard-free',
    paymentMethodCode: 'PREPAID_INTENT' as const,
  };

  const order1 = await connector.createOrder(orderInput);
  const order2 = await connector.createOrder(orderInput);
  assert(
    order1.orderId === order2.orderId &&
      order1.orderStatus === 'CREATED_DEMO_HOLD' &&
      order1.paymentStatus === 'PENDING_PAYMENT_INTENT_HANDOFF',
    'Idempotent order submission returns identical OrderResult with separated orderStatus and paymentStatus'
  );

  const lookedUp = connector.getOrderByReference(order1.orderReference);
  assert(
    lookedUp?.orderReference === order1.orderReference,
    'Guest order lookup finds demo order by reference'
  );
  console.log('✓ 5. End-to-End customer journeys & dynamic merchandising tests passed');

  // ---------------------------------------------------------------------------
  // 6. Accessibility Contrast & Browser Security Boundary Audit
  // ---------------------------------------------------------------------------
  assert(
    contrastRatio('#161311', '#F4F1EA') >= 12,
    'Primary ink on warm stone canvas exceeds WCAG AAA contrast'
  );
  assert(
    contrastRatio('#524B44', '#F4F1EA') >= 4.5,
    'Secondary ink on warm stone canvas exceeds WCAG AA contrast'
  );
  assert(
    contrastRatio('#F4F1EA', '#7A1C1D') >= 4.5,
    'Sindoor maroon CTA contrast exceeds WCAG AA'
  );
  assert(
    contrastRatio('#F4F1EA', '#161311') >= 12,
    'Surface-contrast focus ring (#F4F1EA on #161311) exceeds 3:1 non-text contrast'
  );

  // Verify UI files in src/components, src/pages, and src/integration never import src/testing/*
  const uiDirs = ['components', 'pages', 'integration'];
  for (const dir of uiDirs) {
    const fullDir = path.resolve(__dirname, '..', dir);
    const checkDir = (d: string) => {
      for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, entry.name);
        if (entry.isDirectory()) checkDir(p);
        else if (p.endsWith('.ts') || p.endsWith('.tsx')) {
          const content = fs.readFileSync(p, 'utf8');
          assert(
            !content.includes('testing/mock-connector') && !content.includes('testing/fixtures'),
            `UI module ${p} must not directly import src/testing/*`
          );
          assert(
            !content.includes('X-Tenant-DB') && !content.includes('KALP_SERVER_API_CREDENTIAL'),
            `Browser module ${p} must not contain privileged headers or server secrets`
          );
        }
      }
    };
    checkDir(fullDir);
  }
  console.log('✓ 6. WCAG contrast & browser security boundary audit passed');

  console.log('\nALL GAYRAA STOREFRONT & BFF VERIFICATION CHECKS PASSED.');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
