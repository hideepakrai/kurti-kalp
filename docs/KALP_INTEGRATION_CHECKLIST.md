# GAYRAA — Kalp Stage B Integration & Acceptance Checklist

**Current Milestone Status:**
- **Stage A Frontend Prototype & Production-Ready Shell:** Implemented
- **Same-Origin Storefront BFF (`/api/storefront/v1/*`):** Implemented (upstream Kalp stub returns honest `503 UPSTREAM_UNAVAILABLE`)
- **Live Kalp Integration:** Pending Stage B upstream contract

---

## 1. Security & Boundary Rules Enforced in This Repository

- [x] Browser code calls **only** same-origin `/api/storefront/v1/*` in `connected` mode via `HttpStorefrontConnector`.
- [x] Zero privileged Kalp Admin (`/api/admin/*`), Commerce, Mongo, or `X-Tenant-DB` headers exist in browser code; BFF actively rejects forbidden client headers (`X-Tenant-DB`, `X-Kalp-Tenant`, `X-Kalp-Admin-Key`, `X-Mongo-Uri`) with HTTP 400 `VALIDATION_ERROR`.
- [x] Zero secrets, API keys, or bearer tokens are placed in `VITE_*`, `localStorage`, or client bundles.
- [x] Session continuity uses `HttpOnly; SameSite=Lax` cookies (`gayraa_sf_sid`) managed by `/server/storefront-bff.ts` and sent with `credentials: 'include'`.
- [x] Every request sends and echoes `X-Correlation-Id` across the connector and BFF error envelopes.
- [x] Concurrent identical GET requests are deduplicated in `HttpStorefrontConnector`, and safe retries are restricted strictly to idempotent GET reads on transient network/502/504/429 errors.
- [x] Mock fixtures (`src/testing/fixtures/*`) and `LocalMockStorefrontConnector` (`src/testing/mock-connector.ts`) are isolated to development/test modules and stripped from `vite build`.
- [x] Missing backend configuration renders `<UnavailableModePanel />` and never silently falls back to fake live data.

## 2. StorefrontConnector & BFF Endpoint Matrix

| Domain | Connector Method | Same-Origin BFF Route | Stage A Demo Mode | Connected Mode (Pending Upstream) |
| :--- | :--- | :--- | :--- | :--- |
| Capabilities | `getCapabilities()` | `GET /api/storefront/v1/capabilities` | Enabled (`mode: 'demo'`) | Returns `mode: 'connected'`, `liveKalpConnected: false` |
| Config | `getStorefrontConfig()` | `GET /api/storefront/v1/config` | Verified GAYRAA config | Verified GAYRAA config |
| Navigation | `getNavigation()` | `GET /api/storefront/v1/navigation` | Primary + capability-gated footer | Primary + capability-gated footer |
| CMS Home | `getHomePage()` | `GET /api/storefront/v1/home` | Dynamic `PageManifest` slots | `503 UPSTREAM_UNAVAILABLE` |
| Catalog | `getCollections()` / `getCollection()` / `searchProducts()` / `getProduct()` | `GET /api/storefront/v1/collections*`, `/search`, `/products/:slug` | Jaipur demo fixtures | `503 UPSTREAM_UNAVAILABLE` |
| Cart | `getCart()` / `addCartItem()` / `updateCartItem()` / `removeCartItem()` | `/api/storefront/v1/cart*` | Revision-checked in-memory bag | `503 UPSTREAM_UNAVAILABLE` |
| Checkout | `getCheckoutQuote()` / `createOrder()` | `POST /api/storefront/v1/checkout/quote`, `/orders` | Minor-unit quote, expiry, idempotency | `503 UPSTREAM_UNAVAILABLE` |
| Order Lookup | `lookupOrder()` | `POST /api/storefront/v1/orders/lookup` | Demo order reference lookup | `503 UPSTREAM_UNAVAILABLE` |
| Support | `submitSupportInquiry()` | `POST /api/storefront/v1/support/inquiries` | Labelled demo inquiry record | `503 UPSTREAM_UNAVAILABLE` |
| 3-Day Exchange | `checkExchangeEligibility()` / `submitExchangeRequest()` | `/api/storefront/v1/exchanges*` | Enforces 3-day size/defect policy | `503 UPSTREAM_UNAVAILABLE` |
| Customer Auth | `getCustomerSession()` / `listCustomerOrders()` / `getCustomerOrder()` / `listCustomerAddresses()` / `listSavedItems()` | `/api/storefront/v1/customer/*` | Honest unauthenticated / capability-gated state | `503 UPSTREAM_UNAVAILABLE` |
| Reviews | `listProductReviews()` | `GET /api/storefront/v1/products/:id/reviews` | Labelled demo review fixtures | `503 UPSTREAM_UNAVAILABLE` |

## 3. Stage B Upstream Wiring Steps (When Official Kalp Contract Is Ready)

1. Configure server-only environment variables (`KALP_UPSTREAM_BASE_URL`, `KALP_TENANT_ID`, `KALP_SERVER_API_CREDENTIAL`) on the BFF host.
2. Replace `respondUpstreamUnavailable` in `server/storefront-bff.ts` with authenticated server-to-server calls to Kalp Business Core.
3. Map Kalp catalog, cart, checkout quote, order, and customer-care payloads to the domain contracts in `src/domain/*.ts`.
4. Flip `liveKalpConnected: true` in `server/storefront-bff.ts` only after live upstream health checks pass.
