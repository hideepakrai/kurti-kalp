# Stage B & Stage C — Kalp Integration Checklist

> **Current Status**:
> - **Frontend prototype implemented** (Stage A)
> - **Live Kalp integration pending** (Stages B & C)

This document inventories every mock-to-Kalp mapping and verification step required to transition the GAYRAA storefront from the Stage A local mock adapter (`src/connector/mock-connector.ts`) to a verified server-side Kalp Business Core integration.

---

## 1. Stage B — Shared Connector & Server Adapter Mapping

| StorefrontConnector Method | Stage A Mock Source | Stage B Kalp Target & Mapping Requirement |
| :--- | :--- | :--- |
| `getCapabilities()` | `GAYRAA_CAPABILITIES` (`src/config/storefront.ts`) | Resolve tenant feature flags and enabled capabilities from Kalp Business Core tenant configuration. |
| `getStorefrontConfig()` | `GAYRAA_STOREFRONT_CONFIG` (`src/config/storefront.ts`) | Fetch authoritative tenant profile, contact details, currency (`INR`), and verified legal/policy documents from Kalp CMS / Business Core. |
| `getNavigation()` | `GAYRAA_NAVIGATION` (`src/config/navigation.ts`) | Map to Kalp CMS Navigation menus (`primary`, `footerColumns`). |
| `getHomePage()` | `DEMO_HOMEPAGE_MANIFEST` (`src/connector/fixtures/content-fixtures.ts`) | Fetch versioned `PageManifest` from Kalp CMS. Keep product pricing and stock out of static CMS JSON; resolve referenced collection slugs via Catalog APIs. |
| `getCollections()` / `getCollection(query)` | `DEMO_COLLECTIONS` & `DEMO_PRODUCTS` (`src/connector/fixtures/catalog-fixtures.ts`) | Map `CollectionQuery` (`slug`, `sizes`, `fabrics`, `maxPriceMinor`, `inStockOnly`, `sort`, `page`) to Kalp Catalog & Merchandising APIs. Define cache TTL and webhook/tag invalidation so Admin edits appear predictably. |
| `searchProducts(query)` | In-memory substring match in `LocalMockStorefrontConnector` | Connect to Kalp Catalog Search index with facet aggregation (`sizes`, `fabrics`, `priceRanges`). |
| `getProduct(query)` | `DEMO_PRODUCTS` (`isDemoFixture: true`) | Fetch authoritative product, media assets, `optionDefinitions`, purchasable `variants`, and minor-unit `Money` from Kalp Catalog + Price Book APIs. |
| `getCart()` / `addCartItem()` / `updateCartItem()` / `removeCartItem()` | In-memory `cartEntries` & `revisionCounter` | Bind to Kalp Cart API with HttpOnly session/customer cookies and optimistic concurrency (`expectedRevision`). Never fall back to demo data if the Cart API fails. |
| `getCheckoutQuote(input)` | Simulated quote in `LocalMockStorefrontConnector` | Call Kalp Checkout Quote API to evaluate real PIN serviceability, shipping carrier rates, GST calculation, and payment method eligibility. |
| `createOrder(input)` | In-memory `idempotencyStore` & demo `OrderResult` | Forward `idempotencyKey`, `quoteId`, and `cartRevision` to Kalp Order API. Return real provider payment intent handoff (`PREPAID_INTENT`) or verified COD workflow. |

---

## 2. Boundary & Security Requirements for Stage B

1. **Server-Side Tenant Resolution**: Tenant selection, database credentials, and API tokens must live strictly in the server adapter—never in browser code or `VITE_*` client environment variables.
2. **No Silent Demo Fallback**: When replacing `LocalMockStorefrontConnector` in `src/integration/StorefrontProvider.tsx`, remove mock fixture imports so backend failures surface as recoverable `StorefrontError` states rather than silently serving demo products or prices.
3. **Policy Verification**: Before live publication, reconfirm GAYRAA's shipping terms (48h dispatch, 5–7 business days transit, prepaid express charges) and limited 3-day size/defect exchange terms with the merchant.

---

## 3. Stage C — Connected Acceptance & Release Checks

- [ ] Provision tenant and persistent runtime data through authorised Kalp platform workflows.
- [ ] Verify Kalp Admin edits to products, prices, inventory, and homepage sections propagate according to documented cache invalidation rules.
- [ ] Enforce server-side tenant scope and role boundaries.
- [ ] Validate end-to-end sandbox payment intent handoff and webhook confirmation without simulated payment success.
- [ ] Confirm created orders appear in GAYRAA's Kalp Admin view with accurate `orderStatus` and `paymentStatus`.
- [ ] Record source commit version, staging verification results, and rollback procedure prior to production release.
