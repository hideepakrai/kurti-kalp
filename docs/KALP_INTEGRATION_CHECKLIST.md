# Kurti Kalp / GAYRAA — Fourth Revision Integration & Acceptance Checklist

**Current Milestone Status:**
- **Stage A Frontend Prototype & Reusable Shell:** Implemented (`demo`, `connected`, and `unavailable` modes explicit).
- **Same-Origin Storefront BFF (`/api/storefront/v1/*`) & Kalp Contract Adapter (`server/kalp-upstream-adapter.ts`):** Implemented for verified public catalog/merchandising `{ data }` envelopes and 3-step guest order verification (`challenge -> verify -> server-held proof -> protected order detail`).
- **Live Production Readiness:** Not yet claimed. Requires real staging/production environment configuration, HTTPS, secure cookie/CSRF verification, tenant SMTP configuration for live email challenges, and end-to-end live checkout/payment-intent validation.

---

## 1. Reproducible Build & Clean-Install Environment

- **Supported Runtime:** Node.js `>=22.0.0` (`.nvmrc` pinned to `22`; verified on Node `v22.23.3`, npm `10.9.9`).
- **Lockfiles:** `package-lock.json` (npm) and `bun.lock`.
- **Clean Install Command:**
  ```bash
  npm ci
  ```
- **Verification Pipeline (`npm run ci`):**
  ```bash
  npm run lint    # Strict TypeScript check (tsc --noEmit with strict: true)
  npm run test    # Unit, HttpStorefrontConnector, Express BFF, Kalp Adapter, Proof Isolation & WCAG tests
  npm run build   # Code-split production Vite build (strips src/testing/* demo fixtures)
  ```

---

## 2. BFF Security & Boundary Guarantees

- [x] Browser calls **only** same-origin `/api/storefront/v1/*` with `credentials: 'include'` (HttpOnly `SameSite=Lax` cookie `gayraa_sf_sid`).
- [x] BFF rejects browser-supplied privileged headers (`x-tenant-db`, `x-kalp-tenant`, `x-tenant-id`, `x-kalp-admin-key`, `x-admin-key`, `x-mongo-uri`, `authorization`, `x-kalp-service-token`, `x-order-access-proof`, `x-guest-order-proof`, `x-kalp-proof-token`, `x-upstream-host`, `x-forwarded-host`) with HTTP `400 VALIDATION_ERROR`.
- [x] BFF outbound adapter (`server/kalp-upstream-adapter.ts`) enforces a strict outbound allowlist (`Accept`, `Content-Type`, `X-Correlation-Id`, server-owned `X-Tenant-DB`, server-owned `Authorization`, `Idempotency-Key`, and server-held `X-Order-Access-Proof` only on proof-protected guest order endpoints).
- [x] `HttpStorefrontConnector` performs context-aware GET deduplication (never merging requests that have distinct `correlationId`, `timeoutMs`, or `AbortSignal`) and never retries `POST`, `PATCH`, `PUT`, or `DELETE` mutations.
- [x] Every implemented mutation sends and requires an `Idempotency-Key` header.
- [x] Guest order access uses a 3-step challenge → verification → server-held proof flow bound to `(sessionId, tenantDb, orderReference)`. Raw proof tokens and OTP codes are never exposed to browser responses or UI components.

---

## 3. Route Readiness Matrix

| Storefront Route / BFF Endpoint | Demo Mode Status | Connected Mode Status | Upstream Contract & Notes |
| :--- | :--- | :--- | :--- |
| `/` (`GET /api/storefront/v1/home`) | **Demo-Ready** | **Connected-Ready** | Translates Kalp `{ data }` homepage manifest envelope via `translateKalpHomePageEnvelope`; returns honest `503 UPSTREAM_UNAVAILABLE` if unconfigured. |
| `/collections/:slug` (`GET /api/storefront/v1/collections*`) | **Demo-Ready** | **Connected-Ready** | Translates Kalp `{ data }` collection & facet envelopes with authoritative minor-unit `Money` pricing. |
| `/search` (`GET /api/storefront/v1/search`) | **Demo-Ready** | **Connected-Ready** | Translates Kalp `{ data }` catalog search envelope with hardened query sanitization. |
| `/products/:slug` (`GET /api/storefront/v1/products/:slug`) | **Demo-Ready** | **Connected-Ready** | Translates Kalp `{ data }` product detail & variant matrix with authoritative price/stock. |
| `/order-lookup` (`POST /orders/lookup/challenge`, `/verify`, `GET /orders/lookup/:ref`) | **Demo-Ready** | **Connected-Ready** | 3-step guest order verification with server-side proof isolation per `(sessionId, tenantDb, orderReference)`. |
| `/cart` & Cart Drawer (`/api/storefront/v1/cart*`) | **Demo-Ready** | **Intentionally Unavailable (503)** | Awaiting confirmed Kalp server-side cart & revision upstream contract. |
| `/checkout` (`POST /checkout/quote`, `POST /orders`) | **Demo-Ready** | **Intentionally Unavailable (503)** | Awaiting confirmed Kalp quote calculation, COD PIN serviceability, and payment-intent handoff upstream contracts. |
| `/support` (`POST /api/storefront/v1/support/inquiries`) | **Demo-Ready** | **Intentionally Unavailable (503)** | Direct Jaipur atelier contact cards always visible; ticket submission awaits confirmed Kalp support upstream contract. |
| `/exchange/request` (`/api/storefront/v1/exchanges*`) | **Demo-Ready** | **Intentionally Unavailable (503)** | Guided 3-day size/defect exchange shell works in Demo Mode; connected submission awaits confirmed Kalp exchange upstream contract. |
| `/faq` | **Demo-Ready** | **Connected-Ready** | Renders verified GAYRAA shipping, 3-day exchange, and fabric care policies from `/api/storefront/v1/config`. |
| `/account/orders` & `/account/orders/:id` | **Intentionally Unavailable** | **Intentionally Unavailable (503)** | Capability-gated (`customerAccountsEnabled: false`); directs shoppers to 3-step Guest Order Access (`/order-lookup`). |
| `/account/addresses` | **Intentionally Unavailable** | **Intentionally Unavailable (503)** | Capability-gated (`customerAddressesEnabled: false`); guest checkout requires no account. |
| `/saved` (`/api/storefront/v1/customer/saved`) | **Intentionally Unavailable** | **Intentionally Unavailable (503)** | Capability-gated (`wishlistEnabled: false`); domain model stores only product identity references, never copied prices. |
| PDP Reviews (`GET /products/:id/reviews`) | **Demo-Ready (Labelled)** | **Intentionally Unavailable (503)** | Capability-gated (`productReviewsEnabled: false` in connected mode) until Kalp verified-review upstream contract is confirmed. |

---

## 4. Unresolved Upstream Contracts & Staging Requirements Before Production Launch

1. **Unresolved Upstream Kalp Contracts:**
   - Server-side cart persistence and revision concurrency contract (`/cart`, `/cart/items`).
   - Authoritative checkout quote, tax breakdown, PIN serviceability, and payment provider intent handoff contract (`/checkout/quote`, `/orders`).
   - Customer care ticket creation (`/support/inquiries`), 3-day exchange workflow (`/exchanges/eligibility`, `/exchanges`), customer OTP session auth (`/customer/*`), and verified product reviews (`/products/:id/reviews`).
2. **Infrastructure & Staging Requirements:**
   - Provision real `KALP_UPSTREAM_BASE_URL`, `KALP_TENANT_DB`, and `KALP_SERVER_API_CREDENTIAL` in the server environment.
   - Configure HTTPS termination so `HttpOnly; SameSite=Lax; Secure` session cookies and CSRF protections can be validated end-to-end.
   - Configure and test tenant SMTP delivery for live guest order challenge OTP emails.
   - Execute end-to-end staging checkout and payment-intent verification against a live Kalp Business Core instance before flipping `liveKalpConnected: true`.
