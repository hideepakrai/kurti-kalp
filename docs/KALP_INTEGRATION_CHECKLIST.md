# GAYRAA — Kalp Stage B Integration & Acceptance Checklist

**Current Milestone Status:**
- **Stage A Frontend Prototype & Production-Ready Shell:** Implemented
- **Same-Origin Storefront BFF (`/api/storefront/v1/*`):** Implemented (upstream Kalp stub returns honest `503 UPSTREAM_UNAVAILABLE`)
- **Live Kalp Integration:** Pending Stage B upstream contract

---

## 1. Security & Boundary Rules Enforced in This Repository

- [x] Browser code calls **only** same-origin `/api/storefront/v1/*` in `connected` mode via `HttpStorefrontConnector`.
- [x] Zero privileged Kalp Admin (`/api/admin/*`), Commerce, Mongo, or `X-Tenant-DB` headers exist in browser code.
- [x] Zero secrets, API keys, or bearer tokens are placed in `VITE_*`, `localStorage`, or client bundles.
- [x] Session continuity uses `HttpOnly; SameSite=Lax` cookies (`gayraa_sf_sid`) managed by `/server/storefront-bff.ts`.
- [x] Mock fixtures (`src/testing/fixtures/*`) and `LocalMockStorefrontConnector` (`src/testing/mock-connector.ts`) are isolated to development/test modules and stripped from `vite build`.
- [x] Missing backend configuration renders `<UnavailableModePanel />` and never silently falls back to fake live data.

## 2. Stage B Upstream Wiring Steps (When Official Kalp Contract Is Ready)

1. Configure server-only environment variables (`KALP_UPSTREAM_BASE_URL`, `KALP_TENANT_ID`, `KALP_SERVER_API_CREDENTIAL`) on the BFF host.
2. Replace `respondUpstreamUnavailable` in `server/storefront-bff.ts` with authenticated server-to-server calls to Kalp Business Core.
3. Map Kalp catalog, cart, checkout quote, and order payloads to the domain contracts in `src/domain/*.ts`.
4. Flip `liveKalpConnected: true` in `server/storefront-bff.ts` only after live upstream health checks pass.
