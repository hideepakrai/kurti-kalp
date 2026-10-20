/**
 * Replaceable Local Mock Connector (Stage A Prototype).
 *
 * Implements the proposed StorefrontConnector interface against labelled demo fixtures.
 * Enforces:
 * - Minor-unit integer Money representation
 * - Product-specific option/variant resolution
 * - Cart revision tracking & conflict detection
 * - Server-authoritative CheckoutQuote with expiry & eligibility rules
 * - Idempotent createOrder (same key + same payload = original result; same key + changed payload = conflict)
 * - Strict separation of orderStatus and paymentStatus
 */

import { GAYRAA_NAVIGATION } from '../config/navigation';
import { GAYRAA_CAPABILITIES, GAYRAA_STOREFRONT_CONFIG } from '../config/storefront';
import {
  AddCartItemInput,
  Cart,
  CartLineItem,
  RemoveCartItemInput,
  UpdateCartItemInput,
} from '../domain/cart';
import {
  CollectionFacets,
  CollectionMetadata,
  CollectionQuery,
  CollectionResult,
  ProductDetail,
  ProductQuery,
  ProductSummary,
  SearchQuery,
  SortOption,
} from '../domain/catalog';
import {
  CheckoutQuote,
  CheckoutQuoteInput,
  CreateOrderInput,
  OrderResult,
  PaymentMethodOption,
  ShippingMethodOption,
} from '../domain/checkout';
import {
  HeroVariant,
  Navigation,
  PageManifest,
  StorefrontCapabilities,
  StorefrontConfig,
} from '../domain/content';
import { FieldValidationIssue, StorefrontError } from '../domain/errors';
import { createMoney } from '../domain/money';
import { DEMO_COLLECTIONS, DEMO_PRODUCTS, toProductSummary } from './fixtures/catalog-fixtures';
import { DEMO_HOMEPAGE_MANIFEST } from './fixtures/content-fixtures';
import { StorefrontConnector } from './storefront-connector';

interface InternalCartEntry {
  lineItemId: string;
  productId: string;
  variantId: string;
  quantity: number;
}

interface StoredIdempotentOrder {
  payloadFingerprint: string;
  result: OrderResult;
}

export interface MockConnectorSimulationOptions {
  latencyMs?: number;
  quoteTtlMs?: number;
  forceNextError?: 'NETWORK_FAILURE' | 'CART_CONFLICT' | 'QUOTE_EXPIRED' | null;
  heroVariantOverride?: HeroVariant | null;
}

export class LocalMockStorefrontConnector implements StorefrontConnector {
  private cartId = 'demo-cart-gayraa-01';
  private revisionCounter = 1;
  private cartEntries: InternalCartEntry[] = [
    {
      lineItemId: 'line-1',
      productId: 'prod-gulnaar-anarkali',
      variantId: 'var-gulnaar-s',
      quantity: 1,
    },
  ];
  private quotes = new Map<string, CheckoutQuote>();
  private idempotencyStore = new Map<string, StoredIdempotentOrder>();
  private orderCounter = 1040;
  private simOptions: Required<MockConnectorSimulationOptions>;

  constructor(options?: MockConnectorSimulationOptions) {
    this.simOptions = {
      latencyMs: options?.latencyMs ?? 120,
      quoteTtlMs: options?.quoteTtlMs ?? 5 * 60 * 1000, // 5 minutes default
      forceNextError: options?.forceNextError ?? null,
      heroVariantOverride: options?.heroVariantOverride ?? null,
    };
  }

  public setSimulationOptions(partial: Partial<MockConnectorSimulationOptions>): void {
    this.simOptions = { ...this.simOptions, ...partial };
  }

  public getSimulationOptions(): Readonly<Required<MockConnectorSimulationOptions>> {
    return this.simOptions;
  }

  public expireActiveQuotesNow(): void {
    const pastIso = new Date(Date.now() - 10_000).toISOString();
    for (const [id, quote] of this.quotes.entries()) {
      this.quotes.set(id, { ...quote, expiresAt: pastIso });
    }
  }

  public bumpCartRevisionExternally(): string {
    this.revisionCounter += 1;
    return this.getCurrentRevision();
  }

  private getCurrentRevision(): string {
    return `rev_${this.revisionCounter}`;
  }

  private async delayAndCheckForcedError(): Promise<void> {
    if (this.simOptions.latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.simOptions.latencyMs));
    }
    if (this.simOptions.forceNextError === 'NETWORK_FAILURE') {
      this.simOptions.forceNextError = null;
      throw new StorefrontError({
        code: 'NETWORK_FAILURE',
        message: 'Unable to reach storefront service. Please check your connection and retry.',
        recoverable: true,
      });
    }
  }

  async getCapabilities(): Promise<StorefrontCapabilities> {
    await this.delayAndCheckForcedError();
    return structuredClone(GAYRAA_CAPABILITIES);
  }

  async getStorefrontConfig(): Promise<StorefrontConfig> {
    await this.delayAndCheckForcedError();
    return structuredClone(GAYRAA_STOREFRONT_CONFIG);
  }

  async getNavigation(): Promise<Navigation> {
    await this.delayAndCheckForcedError();
    return structuredClone(GAYRAA_NAVIGATION);
  }

  async getHomePage(): Promise<PageManifest> {
    await this.delayAndCheckForcedError();
    const manifest = structuredClone(DEMO_HOMEPAGE_MANIFEST);
    if (this.simOptions.heroVariantOverride) {
      manifest.sections = manifest.sections.map((section) =>
        section.type === 'hero'
          ? { ...section, variant: this.simOptions.heroVariantOverride! }
          : section
      );
    }
    return manifest;
  }

  async getCollections(): Promise<CollectionMetadata[]> {
    await this.delayAndCheckForcedError();
    return structuredClone(DEMO_COLLECTIONS);
  }

  async getCollection(query: CollectionQuery): Promise<CollectionResult> {
    await this.delayAndCheckForcedError();
    const collection = DEMO_COLLECTIONS.find((c) => c.slug === query.slug);
    if (!collection) {
      throw new StorefrontError({
        code: 'NOT_FOUND',
        message: `Collection "${query.slug}" was not found in the catalog.`,
        recoverable: true,
      });
    }

    const baseProducts = DEMO_PRODUCTS.filter((p) => {
      if (collection.kind === 'ALL') return true;
      if (collection.kind === 'MERCHANDISING') {
        if (collection.slug === 'new-arrivals') return p.isNewArrival;
        if (collection.slug === 'best-sellers') return p.isBestSeller;
      }
      if (collection.kind === 'OCCASION') {
        return p.occasions.includes(collection.slug);
      }
      return p.categorySlug === collection.slug;
    });

    return this.buildFilteredCollectionResult(collection, baseProducts, {
      sizes: query.sizes,
      fabrics: query.fabrics,
      maxPriceMinor: query.maxPriceMinor,
      inStockOnly: query.inStockOnly,
      sort: query.sort,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  async searchProducts(query: SearchQuery): Promise<CollectionResult> {
    await this.delayAndCheckForcedError();
    const normalizedQ = (query.q || '').trim().toLowerCase();

    const searchMetadata: CollectionMetadata = {
      id: 'search-results',
      slug: 'search',
      title: normalizedQ ? `Search Results for "${query.q.trim()}"` : 'Search Catalog',
      description: normalizedQ
        ? `Showing demo catalog matches for "${query.q.trim()}" across categories, fabrics, and occasions.`
        : 'Browse or filter our complete Jaipur ethnic and fusion demo catalog.',
      kind: 'MERCHANDISING',
      isDemoFixture: true,
    };

    const matchedProducts = DEMO_PRODUCTS.filter((p) => {
      if (!normalizedQ) return true;
      const haystack = [
        p.title,
        p.categoryName,
        p.fabricTag,
        p.setSummary,
        p.description,
        ...p.occasions,
        ...p.specifications.setInclusions,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedQ);
    });

    return this.buildFilteredCollectionResult(searchMetadata, matchedProducts, {
      searchText: query.q.trim(),
      sizes: query.sizes,
      fabrics: query.fabrics,
      maxPriceMinor: query.maxPriceMinor,
      inStockOnly: query.inStockOnly,
      sort: query.sort,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  private buildFilteredCollectionResult(
    collection: CollectionMetadata,
    baseProducts: ProductDetail[],
    params: {
      searchText?: string;
      sizes?: string[];
      fabrics?: string[];
      maxPriceMinor?: number;
      inStockOnly?: boolean;
      sort?: SortOption;
      page?: number;
      pageSize?: number;
    }
  ): CollectionResult {
    const facets = this.computeFacets(baseProducts);

    const activeSizes = params.sizes?.filter(Boolean) ?? [];
    const activeFabrics = params.fabrics?.filter(Boolean) ?? [];
    const maxPriceMinor = params.maxPriceMinor;
    const inStockOnly = Boolean(params.inStockOnly);
    const sort: SortOption = params.sort ?? 'FEATURED';

    let filtered = baseProducts.filter((product) => {
      if (activeSizes.length > 0) {
        const hasMatchingPurchasableSize = product.variants.some(
          (v) =>
            activeSizes.includes(v.selectedOptions.Size || v.selectedOptions['Saree Length & Finish'] || '') &&
            v.availability !== 'OUT_OF_STOCK'
        );
        if (!hasMatchingPurchasableSize) return false;
      }
      if (activeFabrics.length > 0 && !activeFabrics.includes(product.fabricTag)) {
        return false;
      }
      if (typeof maxPriceMinor === 'number' && product.startingPrice.amountMinor > maxPriceMinor) {
        return false;
      }
      if (inStockOnly && product.availability === 'OUT_OF_STOCK') {
        return false;
      }
      return true;
    });

    filtered = [...filtered].sort((a, b) => {
      if (sort === 'PRICE_ASC') {
        return a.startingPrice.amountMinor - b.startingPrice.amountMinor;
      }
      if (sort === 'PRICE_DESC') {
        return b.startingPrice.amountMinor - a.startingPrice.amountMinor;
      }
      if (sort === 'NEWEST') {
        return Number(b.isNewArrival) - Number(a.isNewArrival);
      }
      return Number(b.isBestSeller) - Number(a.isBestSeller);
    });

    const pageSize = params.pageSize ?? 6;
    const totalCount = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const page = Math.min(Math.max(1, params.page ?? 1), totalPages);
    const startIdx = (page - 1) * pageSize;
    const pagedSummaries: ProductSummary[] = filtered
      .slice(startIdx, startIdx + pageSize)
      .map(toProductSummary);

    return {
      collection: structuredClone(collection),
      products: structuredClone(pagedSummaries),
      totalCount,
      page,
      pageSize,
      totalPages,
      facets,
      appliedQuery: {
        searchText: params.searchText,
        sizes: activeSizes,
        fabrics: activeFabrics,
        maxPriceMinor,
        inStockOnly,
        sort,
      },
    };
  }

  private computeFacets(products: ProductDetail[]): CollectionFacets {
    const sizeOrder = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free Size (5.5m)'];
    const sizeCounts = new Map<string, number>();
    const fabricCounts = new Map<string, number>();

    for (const p of products) {
      for (const size of p.availableSizes) {
        sizeCounts.set(size, (sizeCounts.get(size) ?? 0) + 1);
      }
      fabricCounts.set(p.fabricTag, (fabricCounts.get(p.fabricTag) ?? 0) + 1);
    }

    const sizes = sizeOrder
      .filter((s) => sizeCounts.has(s))
      .map((s) => ({ value: s, label: s, count: sizeCounts.get(s)! }));

    const fabrics = Array.from(fabricCounts.entries()).map(([value, count]) => ({
      value,
      label: value,
      count,
    }));

    const priceThresholds = [
      { maxPriceMinor: 200000, label: 'Under ₹2,000' },
      { maxPriceMinor: 300000, label: 'Under ₹3,000' },
      { maxPriceMinor: 450000, label: 'Under ₹4,500' },
    ];

    const priceRanges = priceThresholds.map((tier) => ({
      maxPriceMinor: tier.maxPriceMinor,
      label: tier.label,
      count: products.filter((p) => p.startingPrice.amountMinor <= tier.maxPriceMinor).length,
    }));

    return { sizes, fabrics, priceRanges };
  }

  async getProduct(query: ProductQuery): Promise<ProductDetail> {
    await this.delayAndCheckForcedError();
    const product = DEMO_PRODUCTS.find((p) => p.slug === query.slug || p.id === query.slug);
    if (!product) {
      throw new StorefrontError({
        code: 'NOT_FOUND',
        message: `Product "${query.slug}" could not be found in the demo catalog.`,
        recoverable: true,
      });
    }

    const clone = structuredClone(product);
    clone.relatedProducts = clone.relatedProductIds
      .map((id) => DEMO_PRODUCTS.find((p) => p.id === id))
      .filter((p): p is ProductDetail => Boolean(p))
      .map(toProductSummary);

    return clone;
  }

  async getCart(): Promise<Cart> {
    await this.delayAndCheckForcedError();
    return this.buildCartResponse();
  }

  async addCartItem(input: AddCartItemInput): Promise<Cart> {
    await this.delayAndCheckForcedError();
    this.verifyCartRevision(input.expectedRevision);

    if (!Number.isInteger(input.quantity) || input.quantity < 1) {
      throw new StorefrontError({
        code: 'VALIDATION_ERROR',
        message: 'Quantity must be at least 1.',
        recoverable: true,
      });
    }

    const product = DEMO_PRODUCTS.find((p) => p.id === input.productId);
    if (!product) {
      throw new StorefrontError({
        code: 'NOT_FOUND',
        message: 'Selected product was not found.',
        recoverable: true,
      });
    }

    const variant = product.variants.find((v) => v.id === input.variantId);
    if (!variant) {
      throw new StorefrontError({
        code: 'UNAVAILABLE_VARIANT',
        message: 'Please select a valid purchasable size/option combination before adding to bag.',
        recoverable: true,
      });
    }

    if (variant.availability === 'OUT_OF_STOCK') {
      throw new StorefrontError({
        code: 'UNAVAILABLE_VARIANT',
        message: variant.unavailableReason || `${variant.title} is currently out of stock.`,
        recoverable: true,
      });
    }

    const maxAllowed = variant.availability === 'LOW_STOCK' ? 2 : 5;
    const existing = this.cartEntries.find(
      (e) => e.productId === input.productId && e.variantId === input.variantId
    );
    const nextQty = (existing ? existing.quantity : 0) + input.quantity;

    if (nextQty > maxAllowed) {
      throw new StorefrontError({
        code: 'INSUFFICIENT_STOCK',
        message:
          variant.availability === 'LOW_STOCK'
            ? `Only ${maxAllowed} units of ${product.title} (${variant.title}) are available in this batch.`
            : `Maximum ${maxAllowed} units per style allowed per order.`,
        recoverable: true,
      });
    }

    if (existing) {
      existing.quantity = nextQty;
    } else {
      this.cartEntries.push({
        lineItemId: `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        productId: product.id,
        variantId: variant.id,
        quantity: input.quantity,
      });
    }

    this.revisionCounter += 1;
    return this.buildCartResponse();
  }

  async updateCartItem(input: UpdateCartItemInput): Promise<Cart> {
    await this.delayAndCheckForcedError();
    this.verifyCartRevision(input.expectedRevision);

    const index = this.cartEntries.findIndex((e) => e.lineItemId === input.lineItemId);
    if (index === -1) {
      throw new StorefrontError({
        code: 'NOT_FOUND',
        message: 'Cart line item no longer exists.',
        recoverable: true,
        latestCartRevision: this.getCurrentRevision(),
      });
    }

    if (input.quantity <= 0) {
      this.cartEntries.splice(index, 1);
      this.revisionCounter += 1;
      return this.buildCartResponse();
    }

    const entry = this.cartEntries[index];
    const product = DEMO_PRODUCTS.find((p) => p.id === entry.productId);
    const variant = product?.variants.find((v) => v.id === entry.variantId);
    const maxAllowed = variant?.availability === 'LOW_STOCK' ? 2 : 5;

    if (input.quantity > maxAllowed) {
      throw new StorefrontError({
        code: 'INSUFFICIENT_STOCK',
        message: `Only ${maxAllowed} units available for ${product?.title ?? 'this item'} (${variant?.title ?? ''}).`,
        recoverable: true,
        latestCartRevision: this.getCurrentRevision(),
      });
    }

    entry.quantity = input.quantity;
    this.revisionCounter += 1;
    return this.buildCartResponse();
  }

  async removeCartItem(input: RemoveCartItemInput): Promise<Cart> {
    await this.delayAndCheckForcedError();
    this.verifyCartRevision(input.expectedRevision);

    this.cartEntries = this.cartEntries.filter((e) => e.lineItemId !== input.lineItemId);
    this.revisionCounter += 1;
    return this.buildCartResponse();
  }

  private verifyCartRevision(expectedRevision?: string): void {
    if (this.simOptions.forceNextError === 'CART_CONFLICT') {
      this.simOptions.forceNextError = null;
      this.revisionCounter += 1;
      throw new StorefrontError({
        code: 'CART_CONFLICT',
        message:
          'Your shopping bag was updated in another session or stock changed. We refreshed your bag with the latest quantities.',
        recoverable: true,
        latestCartRevision: this.getCurrentRevision(),
      });
    }

    if (expectedRevision && expectedRevision !== this.getCurrentRevision()) {
      throw new StorefrontError({
        code: 'CART_CONFLICT',
        message: `Shopping bag revision mismatch (expected ${expectedRevision}, current is ${this.getCurrentRevision()}). Bag state has been refreshed.`,
        recoverable: true,
        latestCartRevision: this.getCurrentRevision(),
      });
    }
  }

  private buildCartResponse(adjustmentNotice?: string): Cart {
    let subtotalMinor = 0;
    let compareAtTotalMinor = 0;
    let totalItemCount = 0;

    const items: CartLineItem[] = [];

    for (const entry of this.cartEntries) {
      const product = DEMO_PRODUCTS.find((p) => p.id === entry.productId);
      const variant = product?.variants.find((v) => v.id === entry.variantId);
      if (!product || !variant) continue;

      const lineSubtotalMinor = variant.price.amountMinor * entry.quantity;
      const lineCompareAtMinor = (variant.compareAtPrice?.amountMinor ?? variant.price.amountMinor) * entry.quantity;

      subtotalMinor += lineSubtotalMinor;
      compareAtTotalMinor += lineCompareAtMinor;
      totalItemCount += entry.quantity;

      items.push({
        lineItemId: entry.lineItemId,
        productId: product.id,
        productSlug: product.slug,
        productTitle: product.title,
        variantId: variant.id,
        sku: variant.sku,
        selectedOptions: { ...variant.selectedOptions },
        quantity: entry.quantity,
        maxAllowedQuantity: variant.availability === 'LOW_STOCK' ? 2 : 5,
        unitPrice: structuredClone(variant.price),
        compareAtUnitPrice: variant.compareAtPrice ? structuredClone(variant.compareAtPrice) : undefined,
        lineSubtotal: createMoney(lineSubtotalMinor, 'INR', 2),
        image: structuredClone(product.primaryImage),
        availability: variant.availability,
        setSummary: product.setSummary,
        isDemoFixture: true,
      });
    }

    const savingsMinor = Math.max(0, compareAtTotalMinor - subtotalMinor);

    return {
      id: this.cartId,
      revision: this.getCurrentRevision(),
      currency: 'INR',
      itemCount: totalItemCount,
      items,
      totals: {
        subtotal: createMoney(compareAtTotalMinor, 'INR', 2),
        discountTotal: createMoney(savingsMinor, 'INR', 2),
        payableSubtotal: createMoney(subtotalMinor, 'INR', 2),
        estimatedShippingNote: 'Free Standard Shipping across India (Dispatched within 48h from Jaipur)',
        taxIncludedNote: 'Inclusive of applicable GST · Final quote calculated at checkout',
      },
      adjustmentNotice,
      updatedAt: new Date().toISOString(),
    };
  }

  async getCheckoutQuote(input: CheckoutQuoteInput): Promise<CheckoutQuote> {
    await this.delayAndCheckForcedError();

    const currentCart = this.buildCartResponse();
    if (currentCart.items.length === 0) {
      throw new StorefrontError({
        code: 'VALIDATION_ERROR',
        message: 'Cannot generate a checkout quote for an empty shopping bag.',
        recoverable: true,
      });
    }

    if (input.cartRevision !== currentCart.revision) {
      throw new StorefrontError({
        code: 'CART_CONFLICT',
        message: 'Your shopping bag changed since checkout opened. Refreshing quote for the updated bag.',
        recoverable: true,
        latestCartRevision: currentCart.revision,
      });
    }

    const pin = (input.shippingAddress?.postalCode || '').trim();
    const isValidIndianPin = /^[1-9][0-9]{5}$/.test(pin);

    // Connector-determined shipping options (never invent ₹250 express fee; express is inquiry-assisted per policy)
    const shippingMethods: ShippingMethodOption[] = [
      {
        id: 'ship-standard-free',
        title: 'Standard Pan-India Delivery (Free)',
        dispatchEstimate: 'Dispatched within 48 hours from Jaipur warehouse',
        transitEstimate: 'Approx. 5–7 working days after dispatch',
        fee: createMoney(0, 'INR', 2),
        eligible: true,
      },
      {
        id: 'ship-express-inquiry',
        title: 'Prepaid Express Delivery (3 Business Days — Direct Confirmation Required)',
        dispatchEstimate: 'Priority Jaipur dispatch upon direct confirmation',
        transitEstimate: 'Approx. 3 business days after dispatch',
        fee: createMoney(0, 'INR', 2),
        eligible: false,
        requiresInquiry: true,
        ineligibilityReason:
          'Per GAYRAA policy, prepaid express charges and PIN serviceability are not auto-quoted online. Please contact +91 7300006707 or gayraabysnm@gmail.com between 11 AM and 6 PM IST.',
      },
    ];

    const selectedShippingMethodId =
      input.shippingMethodId && shippingMethods.some((m) => m.id === input.shippingMethodId && m.eligible)
        ? input.shippingMethodId
        : 'ship-standard-free';

    const payableSubtotalMinor = currentCart.totals.payableSubtotal.amountMinor;
    // Included GST breakdown (12% apparel tax representation for quote transparency, already included in MRP/Selling price)
    const includedTaxMinor = Math.round((payableSubtotalMinor * 12) / 112);

    // Connector-determined payment method eligibility:
    // E.g. COD is only eligible when a valid 6-digit PIN is entered, order is <= ₹10,000, and PIN does not start with '9' (demo non-COD zone)
    const codEligibleByAmount = payableSubtotalMinor <= 1000000;
    const codEligibleByZone = !pin.startsWith('9');
    const codEligible = codEligibleByAmount && codEligibleByZone;

    let codIneligibleReason: string | undefined;
    if (!codEligibleByAmount) {
      codIneligibleReason = 'Cash on Delivery is unavailable for orders above ₹10,000. Please use Prepaid Payment Intent.';
    } else if (!codEligibleByZone) {
      codIneligibleReason = 'Cash on Delivery is not serviceable for PIN codes starting with 9 in demo rules.';
    }

    const paymentMethods: PaymentMethodOption[] = [
      {
        code: 'PREPAID_INTENT',
        title: 'Prepaid Online Payment (Kalp Payment Intent Placeholder)',
        description:
          'Handoff to authorised payment provider (UPI, Cards, NetBanking) in Stage B. No raw credentials collected here.',
        eligible: true,
      },
      {
        code: 'CASH_ON_DELIVERY',
        title: 'Cash on Delivery (COD)',
        description: isValidIndianPin
          ? 'Pay in cash at the time of delivery. Subject to order verification.'
          : 'Enter a 6-digit Indian PIN code above to verify COD eligibility for your region.',
        eligible: codEligible,
        ineligibilityReason: codIneligibleReason,
      },
    ];

    const now = Date.now();
    const quoteId = `qt_${now}_${this.revisionCounter}`;
    const issuedAt = new Date(now).toISOString();
    const expiresAt = new Date(now + this.simOptions.quoteTtlMs).toISOString();

    const quote: CheckoutQuote = {
      quoteId,
      cartRevision: currentCart.revision,
      issuedAt,
      expiresAt,
      currency: 'INR',
      items: currentCart.items,
      selectedShippingMethodId,
      shippingMethods,
      paymentMethods,
      totals: {
        itemsSubtotal: currentCart.totals.subtotal,
        discountTotal: currentCart.totals.discountTotal,
        shippingFee: createMoney(0, 'INR', 2),
        taxTotal: createMoney(includedTaxMinor, 'INR', 2),
        payableTotal: createMoney(payableSubtotalMinor, 'INR', 2),
      },
      serviceabilityNote: isValidIndianPin
        ? `PIN ${pin} format verified for Standard Pan-India dispatch (note: format validation does not guarantee express courier serviceability).`
        : 'Enter your 6-digit delivery PIN code to confirm regional payment options.',
      isDemoQuote: true,
    };

    this.quotes.set(quoteId, structuredClone(quote));
    return structuredClone(quote);
  }

  async createOrder(input: CreateOrderInput): Promise<OrderResult> {
    await this.delayAndCheckForcedError();

    if (!input.idempotencyKey || input.idempotencyKey.trim().length < 6) {
      throw new StorefrontError({
        code: 'VALIDATION_ERROR',
        message: 'A valid idempotencyKey is required for order submission.',
        recoverable: true,
      });
    }

    const payloadFingerprint = JSON.stringify({
      quoteId: input.quoteId,
      cartRevision: input.cartRevision,
      contact: input.contact,
      shippingAddress: input.shippingAddress,
      billingSameAsShipping: input.billingSameAsShipping,
      billingAddress: input.billingSameAsShipping ? undefined : input.billingAddress,
      shippingMethodId: input.shippingMethodId,
      paymentMethodCode: input.paymentMethodCode,
    });

    // 1. Check Idempotency Store first
    const existingIdempotentRecord = this.idempotencyStore.get(input.idempotencyKey);
    if (existingIdempotentRecord) {
      if (existingIdempotentRecord.payloadFingerprint === payloadFingerprint) {
        // Same key + same payload => return original result deterministically
        return structuredClone(existingIdempotentRecord.result);
      }
      // Same key + modified payload => throw IDEMPOTENCY_CONFLICT
      throw new StorefrontError({
        code: 'IDEMPOTENCY_CONFLICT',
        message:
          'Idempotency conflict: This submission key was already used with different checkout details. A new submission key has been prepared—please review and submit again.',
        recoverable: true,
      });
    }

    // 2. Validate Fields
    const fieldIssues = this.validateOrderInput(input);
    if (fieldIssues.length > 0) {
      throw new StorefrontError({
        code: 'VALIDATION_ERROR',
        message: 'Please correct the highlighted checkout fields before submitting.',
        recoverable: true,
        fieldIssues,
      });
    }

    // 3. Validate Cart Revision
    const currentRevision = this.getCurrentRevision();
    if (input.cartRevision !== currentRevision) {
      throw new StorefrontError({
        code: 'CART_CONFLICT',
        message:
          'Your shopping bag changed before this order was finalized. Please review the updated quote and submit again.',
        recoverable: true,
        latestCartRevision: currentRevision,
      });
    }

    // 4. Validate Quote Existence & Expiration
    const quote = this.quotes.get(input.quoteId);
    if (
      !quote ||
      this.simOptions.forceNextError === 'QUOTE_EXPIRED' ||
      Date.now() > Date.parse(quote.expiresAt)
    ) {
      if (this.simOptions.forceNextError === 'QUOTE_EXPIRED') {
        this.simOptions.forceNextError = null;
      }
      throw new StorefrontError({
        code: 'QUOTE_EXPIRED',
        message:
          'Your checkout quote has expired. Please refresh the quote to confirm current pricing and availability.',
        recoverable: true,
      });
    }

    // 5. Validate Shipping & Payment Eligibility against Quote
    const shippingMethod = quote.shippingMethods.find((m) => m.id === input.shippingMethodId);
    if (!shippingMethod || !shippingMethod.eligible) {
      throw new StorefrontError({
        code: 'UNSUPPORTED_CAPABILITY',
        message: shippingMethod?.ineligibilityReason || 'Selected shipping method is not eligible.',
        recoverable: true,
      });
    }

    const paymentMethod = quote.paymentMethods.find((p) => p.code === input.paymentMethodCode);
    if (!paymentMethod || !paymentMethod.eligible) {
      throw new StorefrontError({
        code: 'UNSUPPORTED_CAPABILITY',
        message: paymentMethod?.ineligibilityReason || 'Selected payment method is not eligible for this quote.',
        recoverable: true,
      });
    }

    // 6. Revalidate Variant Availability at Checkout
    for (const item of quote.items) {
      const product = DEMO_PRODUCTS.find((p) => p.id === item.productId);
      const variant = product?.variants.find((v) => v.id === item.variantId);
      if (!product || !variant || variant.availability === 'OUT_OF_STOCK') {
        throw new StorefrontError({
          code: 'INSUFFICIENT_STOCK',
          message: `${item.productTitle} (${variant?.title ?? ''}) is no longer available in stock.`,
          recoverable: true,
        });
      }
    }

    this.orderCounter += 1;
    const orderNumber = this.orderCounter;
    const isPrepaid = input.paymentMethodCode === 'PREPAID_INTENT';

    const orderResult: OrderResult = {
      orderId: `demo_ord_${orderNumber}`,
      orderReference: `GAY-DEMO-${orderNumber}`,
      createdAt: new Date().toISOString(),
      idempotencyKey: input.idempotencyKey,
      quoteId: quote.quoteId,
      // Keep orderStatus strictly separate from paymentStatus
      orderStatus: isPrepaid ? 'CREATED_DEMO_HOLD' : 'PENDING_MERCHANT_VERIFICATION',
      paymentStatus: isPrepaid
        ? 'PENDING_PAYMENT_INTENT_HANDOFF'
        : 'COD_PENDING_COLLECTION_AT_DELIVERY',
      paymentMethodCode: input.paymentMethodCode,
      paymentAction: isPrepaid
        ? {
            type: 'PROVIDER_INTENT_PLACEHOLDER',
            summary: 'Prepaid Payment Intent Pending (Stage A Placeholder)',
            nextStepInstruction:
              'In Stage B connected mode, Kalp Business Core returns a provider payment intent here. No payment has been charged or simulated.',
            intentReference: `pi_demo_kalp_${orderNumber}`,
          }
        : {
            type: 'COD_VERIFICATION_PLACEHOLDER',
            summary: 'Cash on Delivery Pending Verification (Stage A Placeholder)',
            nextStepInstruction:
              'Order recorded in demo memory with unpaid COD status. No real shipment or financial transaction has been created.',
            intentReference: `cod_demo_kalp_${orderNumber}`,
          },
      contact: structuredClone(input.contact),
      shippingAddress: structuredClone(input.shippingAddress),
      shippingMethod: structuredClone(shippingMethod),
      items: structuredClone(quote.items),
      totals: structuredClone(quote.totals),
      isDemoOrder: true,
      demoDisclaimer:
        'DEMO MODE NOTICE: No real order, shipment, or payment was created. Order status and payment status are shown separately to validate the Stage A Kalp connector workflow.',
    };

    this.idempotencyStore.set(input.idempotencyKey, {
      payloadFingerprint,
      result: structuredClone(orderResult),
    });

    // Clear cart items after successful demo order creation and advance revision
    this.cartEntries = [];
    this.revisionCounter += 1;

    return structuredClone(orderResult);
  }

  private validateOrderInput(input: CreateOrderInput): FieldValidationIssue[] {
    const issues: FieldValidationIssue[] = [];

    if (!input.contact.fullName || input.contact.fullName.trim().length < 2) {
      issues.push({ field: 'contact.fullName', message: 'Enter your full name.' });
    }
    if (!input.contact.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.contact.email.trim())) {
      issues.push({ field: 'contact.email', message: 'Enter a valid email address for order updates.' });
    }
    const cleanPhone = (input.contact.phone || '').replace(/[\s\-+]/g, '');
    if (!/^(91)?[6-9][0-9]{9}$/.test(cleanPhone)) {
      issues.push({
        field: 'contact.phone',
        message: 'Enter a valid 10-digit Indian mobile number.',
      });
    }

    if (!input.shippingAddress.recipientName || input.shippingAddress.recipientName.trim().length < 2) {
      issues.push({
        field: 'shippingAddress.recipientName',
        message: 'Enter the recipient name for delivery.',
      });
    }
    if (!input.shippingAddress.line1 || input.shippingAddress.line1.trim().length < 5) {
      issues.push({
        field: 'shippingAddress.line1',
        message: 'Enter a complete street/house address.',
      });
    }
    if (!input.shippingAddress.city || input.shippingAddress.city.trim().length < 2) {
      issues.push({ field: 'shippingAddress.city', message: 'Enter your city or town.' });
    }
    if (!input.shippingAddress.state || input.shippingAddress.state.trim().length < 2) {
      issues.push({ field: 'shippingAddress.state', message: 'Select or enter your state.' });
    }
    if (!/^[1-9][0-9]{5}$/.test((input.shippingAddress.postalCode || '').trim())) {
      issues.push({
        field: 'shippingAddress.postalCode',
        message: 'Enter a valid 6-digit Indian PIN code (note: format check does not guarantee courier serviceability).',
      });
    }

    if (!input.billingSameAsShipping) {
      if (!input.billingAddress?.line1 || input.billingAddress.line1.trim().length < 5) {
        issues.push({
          field: 'billingAddress.line1',
          message: 'Enter a complete billing street address.',
        });
      }
      if (!input.billingAddress?.city || input.billingAddress.city.trim().length < 2) {
        issues.push({
          field: 'billingAddress.city',
          message: 'Enter your billing city.',
        });
      }
      if (!/^[1-9][0-9]{5}$/.test((input.billingAddress?.postalCode || '').trim())) {
        issues.push({
          field: 'billingAddress.postalCode',
          message: 'Enter a valid 6-digit billing PIN code.',
        });
      }
    }

    return issues;
  }
}

export const defaultMockConnector = new LocalMockStorefrontConnector();
