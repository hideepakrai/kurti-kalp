# GAYRAA — Jaipur Ethnic & Fusion Storefront

A shopping-first, editorial ethnic and fusion fashion storefront for **GAYRAA** (`gayraa.com` · `ROHIT SHARMA SHREE NARAYAN MANUFACTURER`, Sanganer, Jaipur), engineered with a strict **StorefrontConnector** boundary and same-origin **Storefront BFF** (`/api/storefront/v1/*`) for Stage B **Kalp Business API** integration.

## Runtime Modes

1. **`demo` (Development & Test Only)**:
   - Visibly labelled in the announcement bar, footer, checkout, and document title (`[Demo Mode]`).
   - Emits `<meta name="robots" content="noindex, nofollow">`.
   - Dynamically loads `src/testing/mock-connector.ts` and `src/testing/fixtures/*` only when `import.meta.env.DEV` is true. Production builds (`vite build`) dead-code-eliminate the demo branch so zero mock fixtures enter production bundles.
2. **`connected` (Production Default)**:
   - Uses `HttpStorefrontConnector` (`src/connector/http-connector.ts`) calling **only** same-origin `/api/storefront/v1/*` endpoints with `credentials: 'same-origin'` (HttpOnly session cookies), request timeouts, `AbortSignal` support, and normalized `StorefrontError` mapping.
   - Zero secrets, tenant database names, API tokens, or Kalp URLs exist in browser code.
3. **`unavailable` (Honest Missing-Backend State)**:
   - Activated explicitly (`?mode=unavailable`) or whenever `/api/storefront/v1/*` returns `503 UPSTREAM_UNAVAILABLE` because the upstream Kalp Business Core is not configured yet.
   - Displays `<UnavailableModePanel />` with direct Jaipur Atelier contact info and **never** silently serves fake live data.

## Architecture & Routes

### Core Reusable Templates
- `/` — `HomePage` (`PageManifest` renderer supporting `layered-typographic` and `split-editorial` hero variants, `category-spotlight`, `product-collection` resolving live pricing/stock from connector, `seasonal-campaign`, `editorial-story-block`, `campaign-banner-slot`, and `service-policy-strip`).
- `/collections/:slug` & `/search?q=...` — `CollectionPage` with hardened URL query sanitization (`sanitizeCollectionSearchParams`), request sequencing, size/fabric/price/in-stock facets, and accessible mobile filter drawer.
- `/products/:slug` — `ProductPage` with product-specific option definitions, explicit user size selection (no auto-selection), garment measurement tables, set inclusions, and inline Add-to-Bag feedback.
- `/checkout` — `CheckoutPage` with integer minor-unit `Money` totals, `cartRevision` concurrency checks, `expiresAt` quote expiration handling, PIN-format validation notice, idempotent order submission (`Idempotency-Key`), and separated `orderStatus` vs. `paymentStatus`.

### Lean Customer-Facing Route Shells (Capability-Gated)
- `/order-lookup` — Guest Order Reference Lookup (gated behind `capabilities.orderLookupEnabled`).
- `/account/orders` & `/account/orders/:id` — Lean customer orders shell (gated behind `capabilities.customerAccountsEnabled`; no fake login or heavy dashboard).
- `/support` — Jaipur Atelier Client Care, contact details, and prepaid 3-day express shipping inquiry instructions.
- `/faq` — Frequently Asked Questions & Garment Care Guide.
- `/exchange/request` — Guided 3-Day Size & Defect Exchange Request shell enforcing GAYRAA's policy (size/defect only within 3 days of delivery with Order ID, 1 exchange per product, customer-arranged return shipping to Jaipur, no general refunds).
- `/saved` — Saved Styles / Wishlist capability notice (gated behind `capabilities.wishlistEnabled`).

## Verification & CI Commands

```bash
npm run lint     # TypeScript strict check (tsc --noEmit)
npm run test     # Unit, HttpStorefrontConnector, Express BFF, Journey & WCAG contrast suite
npm run build    # Code-split production build (excludes src/testing/* fixtures)
npm run ci       # Full lint + test + build pipeline
```
