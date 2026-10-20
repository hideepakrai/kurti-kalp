/**
 * Automated Verification Suite for Stage A Storefront & Connector Contracts.
 * Run with: npx tsx src/tests/storefront-journey.test.ts
 *
 * Tests:
 * 1. Minor-unit Money validation & formatting
 * 2. Navigation & Collection/Search connector queries (categories, merchandising, occasions, facets, pagination)
 * 3. Product-specific variant resolution, out-of-stock rejection, and low-stock caps
 * 4. Cart revision tracking & CART_CONFLICT detection
 * 5. Quote generation, expiry (QUOTE_EXPIRED), and cart-revision sync
 * 6. Idempotent order submission (retry returns same order; changed payload returns IDEMPOTENCY_CONFLICT)
 * 7. Separation of orderStatus and paymentStatus & demo mode disclaimers
 */

import assert from 'node:assert/strict';
import { LocalMockStorefrontConnector } from '../connector/mock-connector';
import { StorefrontError } from '../domain/errors';
import { assertValidMoney, createMoney, formatMoney } from '../domain/money';

async function runTests() {
  console.log('Starting GAYRAA Stage A Storefront & Connector Verification Suite...\n');

  // 1. Money validation
  {
    const m = createMoney(279900, 'INR', 2);
    assertValidMoney(m);
    assert.equal(m.amountMinor, 279900);
    assert.ok(formatMoney(m).includes('2,799'));

    assert.throws(
      () => createMoney(2799.5, 'INR', 2),
      /amountMinor must be a safe integer/,
      'Floating point minor unit must be rejected'
    );
    console.log('✓ [1/7] Minor-unit Money contract validated');
  }

  const connector = new LocalMockStorefrontConnector({ latencyMs: 0 });

  // 2. Navigation, Collections, Occasions & Search
  {
    const nav = await connector.getNavigation();
    assert.equal(nav.primary.length, 4, 'Primary navigation has 4 top-level groups');

    const newArrivals = await connector.getCollection({ slug: 'new-arrivals' });
    assert.ok(newArrivals.totalCount > 0, 'New Arrivals merchandising collection resolves products');

    const festive = await connector.getCollection({ slug: 'festive' });
    assert.ok(festive.totalCount > 0, 'Festive occasion edit resolves products');

    const filteredBySize = await connector.getCollection({
      slug: 'all',
      sizes: ['XXL'],
      sort: 'PRICE_ASC',
    });
    assert.equal(
      filteredBySize.totalCount,
      1,
      'Only Aarohi Co-ord Set offers XXL in product-specific variants'
    );

    const searchRes = await connector.searchProducts({ q: 'Chanderi' });
    assert.ok(searchRes.totalCount >= 2, 'Search query for Chanderi returns matching styles');
    console.log('✓ [2/7] Navigation, collection filters, occasions, and search verified');
  }

  // 3. Product-specific variants & stock enforcement
  {
    const gulnaar = await connector.getProduct({ slug: 'gulnaar-printed-anarkali-set' });
    assert.equal(gulnaar.isDemoFixture, true);
    assert.deepEqual(gulnaar.optionDefinitions[0].values, ['XXS', 'XS', 'S', 'M', 'L', 'XL']);

    // Out-of-stock variant (XL on Gulnaar) must be rejected
    await assert.rejects(
      async () => {
        await connector.addCartItem({
          productId: gulnaar.id,
          variantId: 'var-gulnaar-xl',
          quantity: 1,
        });
      },
      (err: unknown) => err instanceof StorefrontError && err.code === 'UNAVAILABLE_VARIANT',
      'Adding an out-of-stock variant must throw UNAVAILABLE_VARIANT'
    );

    // Low-stock variant (M on Gulnaar) caps at 2 units
    await assert.rejects(
      async () => {
        await connector.addCartItem({
          productId: gulnaar.id,
          variantId: 'var-gulnaar-m',
          quantity: 3,
        });
      },
      (err: unknown) => err instanceof StorefrontError && err.code === 'INSUFFICIENT_STOCK',
      'Exceeding low-stock limit must throw INSUFFICIENT_STOCK'
    );
    console.log('✓ [3/7] Product-specific variants, out-of-stock, and low-stock rules verified');
  }

  // 4. Cart revisions & conflict handling
  {
    const initialCart = await connector.getCart();
    const updatedCart = await connector.addCartItem({
      productId: 'prod-zariya-chanderi-kurta',
      variantId: 'var-zariya-m-emerald',
      quantity: 1,
      expectedRevision: initialCart.revision,
    });
    assert.notEqual(updatedCart.revision, initialCart.revision, 'Cart revision increments on mutation');

    // Passing stale expectedRevision must throw CART_CONFLICT
    await assert.rejects(
      async () => {
        await connector.updateCartItem({
          lineItemId: updatedCart.items[0].lineItemId,
          quantity: 2,
          expectedRevision: initialCart.revision, // stale
        });
      },
      (err: unknown) => err instanceof StorefrontError && err.code === 'CART_CONFLICT',
      'Stale expectedRevision must throw CART_CONFLICT'
    );
    console.log('✓ [4/7] Cart revision tracking and conflict rejection verified');
  }

  // 5. Checkout quote generation, eligibility & quote expiration
  {
    const cart = await connector.getCart();
    const quote = await connector.getCheckoutQuote({
      cartRevision: cart.revision,
      shippingAddress: { postalCode: '302029', city: 'Jaipur', state: 'Rajasthan' },
    });
    assert.equal(quote.cartRevision, cart.revision);
    assert.equal(quote.totals.shippingFee.amountMinor, 0, 'Standard Pan-India shipping is free');

    const expressOption = quote.shippingMethods.find((m) => m.id === 'ship-express-inquiry');
    assert.equal(
      expressOption?.eligible,
      false,
      'Express shipping is not auto-enabled without inquiry'
    );

    // Expire active quotes and verify createOrder rejects with QUOTE_EXPIRED
    connector.expireActiveQuotesNow();
    await assert.rejects(
      async () => {
        await connector.createOrder({
          idempotencyKey: 'idem_expired_test_01',
          quoteId: quote.quoteId,
          cartRevision: cart.revision,
          contact: {
            fullName: 'Ananya Sharma',
            email: 'ananya@example.com',
            phone: '9876543210',
          },
          shippingAddress: {
            recipientName: 'Ananya Sharma',
            line1: '14 Civil Lines',
            city: 'Jaipur',
            state: 'Rajasthan',
            postalCode: '302006',
            countryCode: 'IN',
          },
          billingSameAsShipping: true,
          shippingMethodId: 'ship-standard-free',
          paymentMethodCode: 'PREPAID_INTENT',
        });
      },
      (err: unknown) => err instanceof StorefrontError && err.code === 'QUOTE_EXPIRED',
      'Submitting an expired quote must throw QUOTE_EXPIRED'
    );
    console.log('✓ [5/7] Checkout quote eligibility and quote expiration handling verified');
  }

  // 6 & 7. Idempotent Order Submission & Separated Order/Payment Statuses
  {
    const cart = await connector.getCart();
    const freshQuote = await connector.getCheckoutQuote({
      cartRevision: cart.revision,
      shippingAddress: { postalCode: '302006', city: 'Jaipur', state: 'Rajasthan' },
    });

    const orderPayload = {
      idempotencyKey: 'idem_journey_test_key_1001',
      quoteId: freshQuote.quoteId,
      cartRevision: cart.revision,
      contact: {
        fullName: 'Ananya Sharma',
        email: 'ananya@example.com',
        phone: '9876543210',
      },
      shippingAddress: {
        recipientName: 'Ananya Sharma',
        line1: '14 Civil Lines',
        city: 'Jaipur',
        state: 'Rajasthan',
        postalCode: '302006',
        countryCode: 'IN',
      },
      billingSameAsShipping: true,
      shippingMethodId: 'ship-standard-free',
      paymentMethodCode: 'PREPAID_INTENT' as const,
    };

    const firstOrder = await connector.createOrder(orderPayload);
    assert.equal(firstOrder.isDemoOrder, true);
    assert.equal(firstOrder.orderStatus, 'CREATED_DEMO_HOLD');
    assert.equal(firstOrder.paymentStatus, 'PENDING_PAYMENT_INTENT_HANDOFF');

    // Retry with identical key and identical payload => must return exact same order
    const retryOrder = await connector.createOrder(orderPayload);
    assert.equal(retryOrder.orderId, firstOrder.orderId);
    assert.equal(retryOrder.orderReference, firstOrder.orderReference);

    // Reuse same key with modified payload => must throw IDEMPOTENCY_CONFLICT
    await assert.rejects(
      async () => {
        await connector.createOrder({
          ...orderPayload,
          paymentMethodCode: 'CASH_ON_DELIVERY',
        });
      },
      (err: unknown) => err instanceof StorefrontError && err.code === 'IDEMPOTENCY_CONFLICT',
      'Reusing an idempotencyKey with a modified payload must throw IDEMPOTENCY_CONFLICT'
    );
    console.log('✓ [6/7] Idempotent order retry and changed-payload conflict verified');
    console.log('✓ [7/7] Separated orderStatus vs. paymentStatus & demo disclaimers verified\n');
  }

  console.log('All 7 verification suites passed.');
}

runTests().catch((err) => {
  console.error('Verification suite failed:', err);
  process.exit(1);
});
