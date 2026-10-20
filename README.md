# GAYRAA — Jaipur Ethnic & Fusion Storefront (Stage A Prototype)

> **Delivery Milestone Status**:
> - **Frontend prototype implemented** (Stage A)
> - **Live Kalp integration pending** (Stages B & C)

A responsive, editorial women's ethnic and fusion fashion storefront designed for **GAYRAA** (`https://www.gayraa.com/`), inspired by the editorial layout composition of the supplied visual reference while keeping presentation strictly decoupled from commerce data through a typed connector boundary.

---

## 1. Tech Stack & Runtime Environment

- **Framework**: React 19 + TypeScript (Single-Page Application with History API routing)
- **Build Tool & Dev Server**: Vite 8 (`@vitejs/plugin-react`, `@tailwindcss/vite`, Tailwind CSS v4)
- **Runtime**: Node.js (v22+)
- **Package Manager**: `npm`

### Commands

```bash
# Install dependencies
npm install

# Start development server on port 3000
npm run dev

# Type-check / lint codebase
npm run lint

# Run automated journey & transaction verification suite
npx tsx src/tests/storefront-journey.test.ts

# Build production bundle
npm run build
```

---

## 2. Scope & Reusable Template Architecture

The storefront implements **four reusable page templates** plus **global slide-over drawers**:

| Destination | Route Pattern | Reusable Template | Notes |
| :--- | :--- | :--- | :--- |
| **Homepage** | `/` | `src/pages/HomePage.tsx` | Renders 8 ordered typed sections from `PageManifest` (`hero`, `category-spotlight`, `product-collection` [New Arrivals], `seasonal-campaign`, `product-collection` [Best Sellers], `service-policy-strip`, plus shell AnnouncementBar/Header/Footer). |
| **All Collections** | `/collections/all` | `src/pages/CollectionPage.tsx` | Complete demo catalog with server-simulated facets (`sizes`, `fabrics`, `maxPrice`, `inStockOnly`), sorting, and pagination synced to URL query parameters. |
| **Merchandising Edits** | `/collections/new-arrivals`, `/collections/best-sellers` | `src/pages/CollectionPage.tsx` | Merchandising collections separated from category taxonomy. |
| **Product Categories** | `/collections/anarkali-suit-sets`, `/collections/kurta-sets`, `/collections/co-ord-sets`, `/collections/indo-western`, `/collections/sarees`, `/collections/dresses` | `src/pages/CollectionPage.tsx` | Core GAYRAA category hierarchy. |
| **Shop by Occasion** | `/collections/wedding`, `/collections/festive`, `/collections/casual`, `/collections/office`, `/collections/vacation` | `src/pages/CollectionPage.tsx` | Occasion-based catalog queries. |
| **Catalog Search** | `/search?q=anarkali` | `src/pages/CollectionPage.tsx` | Full-text search + facet filtering. |
| **Product Detail (PDP)** | `/products/:slug` | `src/pages/ProductPage.tsx` | Explicit option selection (no arbitrary size pre-selection), product-specific variant resolution, garment measurement table, set inclusions, and policy summaries. |
| **Shopping Bag** | Global Drawer (or `/cart`) | `src/components/commerce/CartDrawer.tsx` | Visiting `/cart` renders the storefront shell with the global `CartDrawer` open. |
| **Checkout** | `/checkout` | `src/pages/CheckoutPage.tsx` | Live `CheckoutQuote` evaluation, `cartRevision` sync, quote expiry checks, idempotent submission, and demo order-result view separating `orderStatus` and `paymentStatus`. |

### Single-Page App Hosting Note

Because routes use the browser History API (`/collections/...`, `/products/...`, `/checkout`), production static hosts or reverse proxies must rewrite non-asset paths to `/index.html`. (Vite's dev server handles this automatically).

---

## 3. Replacing the Mock Connector in Stage B

All pages and presentation components consume data exclusively through the `StorefrontConnector` contract (`src/connector/storefront-connector.ts`) provided by `StorefrontProvider` (`src/integration/StorefrontProvider.tsx`).

To connect to Kalp Business Core in Stage B:
1. Implement a server-backed adapter conforming to `StorefrontConnector` (see [`docs/KALP_INTEGRATION_CHECKLIST.md`](./docs/KALP_INTEGRATION_CHECKLIST.md)).
2. Pass the real connector instance into `<StorefrontProvider connector={kalpConnector}>` in `src/App.tsx`.
3. Do not fall back to `LocalMockStorefrontConnector` in production.

### Developer Simulation Mode (`?dev=1`)

Customer-facing screens never display internal diagnostics, cart revisions, or simulation controls. During local development (`import.meta.env.DEV`), appending `?dev=1` to any URL reveals a bottom developer bar allowing you to:
- Toggle the Homepage Hero between `layered-typographic` and `split-editorial`.
- Force a simulated `NETWORK_FAILURE` on the next connector call.
- Bump the server `cartRevision` externally to test `CART_CONFLICT` recovery.
- Expire all active checkout quotes immediately to test `QUOTE_EXPIRED` recovery.

---

## 4. Known Limitations & Actual Verification Results

### Known Limitations (Stage A Prototype)
- **No Live Kalp Backend**: `@kalp/storefront-connector` and `pnpm kalp:setup` / `pnpm kalp:verify` are planned Stage B dependencies and do not exist in this repository. All catalog items, SKUs, prices, stock states, and studio SVG lookbooks are labelled demo fixtures (`isDemoFixture: true`).
- **In-Memory Session State**: Cart revisions, checkout quotes, and idempotency keys are stored in browser memory inside `LocalMockStorefrontConnector` and reset on full page reload.
- **Pinterest Reference Inspection**: Pinterest pin `37154765672278382` could not be crawled directly due to unauthenticated crawler blocks; the supplied `image_c5d8459e.png` screenshot was used as the visual composition reference.

### Verification Executed
- **TypeScript & Lint Check (`npm run lint`)**: Verified zero TypeScript or syntax errors.
- **Automated Storefront Journey & Transaction Suite (`npx tsx src/tests/storefront-journey.test.ts`)**: Verified minor-unit `Money` validation, collection/search facets, product-specific variant resolution, `OUT_OF_STOCK` and `LOW_STOCK` enforcement, `CART_CONFLICT` handling, `QUOTE_EXPIRED` handling, idempotent retry vs. `IDEMPOTENCY_CONFLICT` on modified payload, and separated `orderStatus` / `paymentStatus`.
- **Production Bundle Compilation (`npm run build` / `compile_applet`)**: Verified clean production build.
- **Skipped Checks**: Live Kalp Admin CMS propagation, server-side multi-tenant database isolation, and real payment gateway sandbox capture (deferred to Stage B/C).
