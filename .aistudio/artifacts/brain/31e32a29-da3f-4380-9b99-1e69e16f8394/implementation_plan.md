# GAYRAA — Complete Frontend and Kalp Integration Plan

## 1. Objective & Source Synthesis

Build a responsive, editorial **GAYRAA** ethnic and fusion fashion storefront (`gayraa.com`) combining GAYRAA's Jaipur business context with the editorial layout inspiration of the supplied reference (`image_c5d8459e.png` / Pinterest pin `37154765672278382`). Presentation remains strictly decoupled from commerce authority through a typed connector boundary.

> [!IMPORTANT]
> **Delivery Boundary & Handoff Status**
> - **Stage A (Delivered in this milestone)**: Complete frontend prototype with 4 reusable templates, global cart drawer, full navigation and search, semantic tokens, typed domain contracts, replaceable mock connector with labelled demo fixtures, and automated journey/transaction tests.
> - **Stages B & C (Explicit remaining work)**: Shared `@kalp/storefront-connector` package mapping, server-side tenant resolution, live Kalp Business & Admin API integration, and sandbox payment verification.
> - **Final Handoff Labels**: **Frontend prototype implemented** · **Live Kalp integration pending**.

### Source Classification

| Source | Classification | Usage & Boundaries |
| :--- | :--- | :--- |
| **`https://www.gayraa.com/`** | **Observed Business Context** | Legal identity (*Rohit Sharma Shree Narayan Manufacturer*, Jaipur), women's ethnic & fusion categories, contact details (`gayraabysnm@gmail.com`, `+91 7300006707`), shipping policy (`/pages/shipping-policy`), and refund/exchange policy (`/pages/refund-policy`). |
| **Supplied GAZU Screenshot (`image_c5d8459e.png`)** | **Visual Composition Reference** | Used because Pinterest pin `37154765672278382` blocks unauthenticated crawlers. Inspires light/dark section alternation, layered/split hero options, 3-category dark spotlight band, seasonal campaign split, and crisp 0–2px button/card geometry. GAZU branding, men's/kids' categories, `₹999` shipping threshold, and 15-day return claims are excluded. |
| **Products, Prices, SKUs & Generated Studio Imagery** | **Labelled Demo Fixtures** | Marked explicitly as demo fixtures (`isDemoFixture: true`). No fabricated verified reviews, certifications, purchase counts, or fake urgency timers. |

---

## 2. Scope: Four Reusable Templates, Global Cart Drawer & Complete Navigation

### Four Reusable Page Templates + Global Overlays

1. **Homepage Template (`HomePage`)**: Renders ordered, typed sections from a `PageManifest` (`/`).
2. **Collection / Catalog / Search Template (`CollectionPage`)**: Powers all category routes (`/collections/:slug`), merchandising edits (`new-arrivals`, `best-sellers`), occasion edits (`wedding`, `festive`, `casual`, `office`, `vacation`), and search results (`/search?q=...`).
3. **Product-Detail Template (`ProductPage`)**: Powers `/products/:slug` with product-specific option resolution, size measurements, set inclusions, and policy summaries.
4. **Checkout Template (`CheckoutPage`)**: Powers `/checkout`, including live quote evaluation and a clearly labelled demo order-result state.
5. **Global Cart Drawer & Policy Drawer**: Shared slide-over cart drawer accessible from any route (visiting `/cart` renders the storefront shell with the global cart drawer open). Reusable policy content panel displays Shipping, Exchange, and Privacy terms without requiring separate static page templates.

### Complete Navigation & Route Mapping

- **Primary Navigation (Config-Driven)**:
  - **New Arrivals** (`/collections/new-arrivals` — merchandising collection)
  - **Best Sellers** (`/collections/best-sellers` — merchandising collection)
  - **All Collections** (Expandable menu: *View All*, *Anarkali Suit Sets*, *Kurta Sets*, *Co-ord Sets*, *Indo-Western*, *Sarees*, *Dresses*)
  - **Shop by Occasion** (Expandable menu: *Wedding*, *Festive*, *Casual*, *Office*, *Vacation* — occasion queries)
- **Header Utilities**:
  - Brand wordmark (`GAYRAA`) linking to `/`.
  - Expandable/accessible **Search** bar submitting to `/search?q=...` with live query handling.
  - **Shopping Bag** trigger with live item count badge.
  - *(Account, Wishlist, and App-Download buttons are omitted until backed by real capabilities).*

---

## 3. Visual System, Surface-Aware Accessibility & Interaction Design

### Proposed Semantic Tokens (`src/theme/tokens.css`)

- **Surfaces**: Canvas `#F4F1EA` (warm stone), Elevated Surface `#FAF8F5` (soft ivory), Muted Band `#EAE4D8` (sandstone), Contrast Surface `#161311` (deep espresso).
- **Text Hierarchy**: Primary `#161311` (`15.9:1` on canvas), Secondary `#524B44` (`7.1:1` on canvas), Text on Contrast `#F4F1EA` (`15.9:1` on espresso), Muted on Contrast `#C8C0B4` (`9.8:1` on espresso).
- **Accents & Status**: Primary Accent `#7A1C1D` (festive maroon), Decorative Brass `#9E6B2B` (restrained detail only), Semantic Success `#165B38`, Warning `#7C4700`, Error `#961B1E`.
- **Typography & Geometry**: Maximum 2 font families (`Cormorant Garamond` for editorial headings + `Plus Jakarta Sans` for UI/body/tabular numerals), minimal weights (`400`, `600`), restrained `1px solid #D6CFC2` hairline borders, and `0px–2px` corner radius.

### Surface-Aware Focus & Context-Specific Interactions

- **Surface-Aware Focus Rings**: Light surfaces use `2px solid #7A1C1D` (`outline-offset: 2px`), while dark `#161311` contrast bands override `--focus-ring-color` to `#F4F1EA` so keyboard focus is unmistakably visible everywhere.
- **Hero Variants**: Configurable per `PageManifest` between `layered-typographic` (reference-inspired display composition with `aria-hidden="true"` on decorative background lettering and a semantic `<h1>`) and `split-editorial` (balanced two-column fallback).
- **Micro-Interactions (150–250ms, `prefers-reduced-motion` compliant)**:
  - *Nav links*: Underline reveal and active route indicator.
  - *Buttons*: Color/border shift without layout shift.
  - *Product cards*: Subtle image zoom within fixed `3:4` container.
  - *Size/variant chips*: Distinct hover, selected, unavailable (strikethrough + text explanation), and focus-visible states; **no size is auto-selected on PDP load**.
  - *Cart controls*: Inline pending state on line items without shifting drawer geometry; focus trapped inside modal drawers and restored to trigger on close.

---

## 4. Technical Architecture, Connector Contracts & Transactional Rules

### System & Data-Flow Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                   PRESENTATION & PAGE LAYER (React 19)                     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌───────────────────┐  │
│  │  HomePage    │ │CollectionPage│ │ ProductPage  │ │   CheckoutPage    │  │
│  │(8 Manifest   │ │(Collections, │ │(Explicit Size│ │(Quote, Revision & │  │
│  │ Sections)    │ │Occasions,Qry)│ │ Selection)   │ │ Idempotent Submit)│  │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └─────────┬─────────┘  │
│         └────────────────┴────────┬───────┴───────────────────┘            │
│                                   ▼                                        │
│         Global Cart Drawer · Search Bar · Reusable Policy Drawer           │
└───────────────────────────────────┬────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│               UI INTEGRATION LAYER (StorefrontProvider & Hooks)            │
│   Manages request cancellation, optimistic/rollback guards & modal focus   │
└───────────────────────────────────┬────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│            DOMAIN & CONNECTOR CONTRACT (Framework-Independent)             │
│  getCapabilities · getStorefrontConfig · getNavigation · getHomePage       │
│  getCollection · searchProducts · getProduct                               │
│  getCart · addCartItem · updateCartItem · removeCartItem                   │
│  getCheckoutQuote · createOrder                                            │
└───────────────────────────────────┬────────────────────────────────────────┘
                                    │
                  ┌─────────────────┴─────────────────┐
                  ▼ (Stage A — Implemented Now)       ▼ (Stage B — Planned)
┌─────────────────────────────────────┐ ┌────────────────────────────────────┐
│  LOCAL MOCK ADAPTER & DEMO FIXTURES │ │   SERVER-SIDE KALP ADAPTER         │
│  Labelled fixtures, revision checks,│ │   Tenant resolution, Business API, │
│  quote expiry & idempotency engine  │ │   CMS bindings & payment intents   │
└─────────────────────────────────────┘ └────────────────────────────────────┘
```

### Key Domain & Transactional Guarantees

1. **Currency & Minor Units**: `Money { amountMinor: number; currency: string; minorUnitDigits: number }` validates safe integers. GAYRAA is configured for `INR` (`minorUnitDigits: 2`). All line totals, discounts, shipping, tax, and payable amounts come from the connector.
2. **Homepage Manifest Resolution**: `getHomePage()` returns the 8 ordered sections (Announcement/Nav context, Hero, 3-Category Spotlight, New Arrivals, Seasonal/Occasion Campaign, Best Sellers, Service & Policy Strip, Footer). Product sections store collection queries or product IDs whose live price and stock are resolved from catalog data.
3. **Explicit Variant Resolution**: `ProductDetail` separates `optionDefinitions` and purchasable `variants`. No size is pre-selected on load; clicking *Add to Bag* before choosing required options prompts the user inline. Unavailable combinations are clearly explained.
4. **Cart Revisions & Conflict Recovery**: `Cart` carries `id` and `revision`. Mutations pass `expectedRevision`. On conflict or failure, the UI preserves/restores the last confirmed cart and explains any stock or quantity adjustment.
5. **Checkout Quotes & Eligibility**:
   - `getCheckoutQuote` supports initial shipping discovery (when `shippingMethodId` is not yet chosen) and returns `quoteId`, `cartRevision`, `issuedAt`, `expiresAt`, `currency`, `totals`, `shippingMethods`, and `paymentMethods`.
   - Eligibility for COD or express shipping is determined by the connector response (not universally enabled). In accordance with GAYRAA's verified policy, standard shipping across India is free (`0` paise), while express prepaid delivery is noted as an inquiry-assisted service rather than an invented `₹250` fee.
6. **Idempotent Order Submission & Separated Statuses**:
   - `createOrder` requires an `idempotencyKey`. Reusing the same key with an identical payload returns the original `OrderResult`; reusing the same key with a modified payload throws `IDEMPOTENCY_CONFLICT`. Changing checkout inputs generates a fresh key for the new logical submission.
   - `OrderResult` separates `orderStatus` (`'CREATED' | 'PENDING_VERIFICATION' | 'CONFIRMED' | 'CANCELLED'`) from `paymentStatus` (`'PENDING_PAYMENT_INTENT' | 'COD_PENDING_COLLECTION' | 'UNPAID' | 'FAILED'`) and explicitly badges demo mode so no fake payment success is ever shown.
7. **Accurate GAYRAA Policy Baseline**:
   - **Shipping**: Free standard shipping across India; dispatch within 48 hours; standard transit ~5–7 working days after dispatch. Paid prepaid express delivery (3 business days) requires contacting GAYRAA between 11 AM and 6 PM.
   - **Exchanges & Refunds**: Limited exchanges only for size issues or defective items; request within **3 days of delivery** with a valid Order ID (`gayraabysnm@gmail.com` or `+91 7300006707`); **one exchange per product**; item must be unused and unwashed with tags; **customer-arranged and customer-paid return shipping (no reverse pickup)**; **no general refunds**.
8. **Clean Customer UI (Dev-Only Diagnostics)**: Simulation controls (forcing network errors, quote expiry, or revision conflicts) are gated strictly behind development mode (`?dev=1` toggle in dev environment) and never clutter customer-facing checkout or product views.
