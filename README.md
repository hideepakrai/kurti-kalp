# Kurti Kalp / GAYRAA — Jaipur Ethnic & Fusion Storefront

A shopping-first, editorial storefront architecture configured for **GAYRAA** (`gayraa.com` · `ROHIT SHARMA SHREE NARAYAN MANUFACTURER`, Sanganer, Jaipur), engineered with a strict **StorefrontConnector** boundary and same-origin **Express Storefront BFF** (`/api/storefront/v1/*`) for **Kalp Business API** integration.

## Supported Runtime & Clean Install

- **Node.js Version:** `>=22.0.0` (pinned in `.nvmrc` to `22`; verified with Node `v22.23.3` and npm `10.9.9`).
- **Package Manager & Lockfile:** `npm` (`package-lock.json`).
- **Clean Install & CI Verification:**
  ```bash
  npm ci           # Reproducible clean install from package-lock.json
  npm run lint     # Strict TypeScript check (tsc --noEmit with strict: true)
  npm run test     # Automated unit, connector, BFF, Kalp envelope adapter, proof isolation & WCAG suite
  npm run build    # Code-split production Vite build (excludes src/testing/* demo fixtures)
  npm run ci       # Runs lint + test + build in sequence
  ```

## Explicit Runtime Modes

1. **`demo` (Development & Test Only)**:
   - Visibly labelled in the announcement bar, footer, checkout, guest order verification helper, and document title (`[Demo Mode]`).
   - Emits `<meta name="robots" content="noindex, nofollow">`.
   - Dynamically loads `src/testing/mock-connector.ts` and `src/testing/fixtures/*` only when `import.meta.env.DEV` is true. Production builds (`vite build`) dead-code-eliminate the demo branch so zero mock fixtures enter production bundles.
2. **`connected` (Production Default)**:
   - Uses `HttpStorefrontConnector` (`src/connector/http-connector.ts`) calling **only** same-origin `/api/storefront/v1/*` endpoints with `credentials: 'include'` (HttpOnly session cookies), `X-Correlation-Id` tracking, context-aware GET deduplication, GET-only transient retries, mandatory `Idempotency-Key` headers on all mutations, request timeouts, and normalized `StorefrontError` mapping.
   - Zero secrets, tenant database names, OTPs, proof tokens, API tokens, or Kalp URLs exist in browser code.
3. **`unavailable` (Honest Missing-Backend State)**:
   - Activated explicitly (`?mode=unavailable`) or whenever `/api/storefront/v1/*` returns `503 UPSTREAM_UNAVAILABLE` because the upstream Kalp Business Core is unconfigured or a route contract is not yet confirmed.
   - Displays `<UnavailableModePanel />` with direct Jaipur Atelier contact info and **never** silently serves fake live data.

## BFF Security & Real Contract Adapter (`server/`)

- **Forbidden Browser Header Guard (`server/storefront-bff.ts`)**: Rejects any browser request supplying privileged tenant, database, admin, authorization, proof, or routing headers (`X-Tenant-DB`, `X-Kalp-Tenant`, `Authorization`, `X-Order-Access-Proof`, `X-Mongo-Uri`, `X-Kalp-Admin-Key`, etc.) with `400 VALIDATION_ERROR`.
- **Strict Outbound Header Allowlist (`server/kalp-upstream-adapter.ts`)**: Sends only server-owned `X-Tenant-DB` (`KALP_TENANT_DB`), server-owned `Authorization` (`KALP_SERVER_API_CREDENTIAL`), `X-Correlation-Id`, `Idempotency-Key`, and server-held `X-Order-Access-Proof` on protected guest order routes.
- **Kalp `{ data, ... }` Envelope Translation**: Translates verified public catalog/merchandising responses and multi-step guest order verification responses inside the BFF boundary while rejecting malformed upstream payloads with `502 BAD_GATEWAY`.
- **3-Step Guest Order Access & Proof Isolation**:
  1. `POST /api/storefront/v1/orders/lookup/challenge` (`createGuestOrderChallenge`)
  2. `POST /api/storefront/v1/orders/lookup/verify` (`verifyGuestOrderChallenge` — stores short-lived proof strictly server-side bound to `sessionId + tenantDb + orderReference`)
  3. `GET /api/storefront/v1/orders/lookup/:orderReference` (`getVerifiedGuestOrder` — enforces tenant, session, and order proof isolation)

> **Production Readiness Notice:** While the BFF boundary, contract adapters, and automated verification suite pass in this repository, full production readiness still requires real Kalp environment configuration (`KALP_UPSTREAM_BASE_URL`, `KALP_TENANT_DB`, `KALP_SERVER_API_CREDENTIAL`), HTTPS termination, secure cookie/CSRF validation, tenant SMTP setup for live email challenges, and end-to-end staging checkout validation.
