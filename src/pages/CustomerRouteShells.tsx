/**
 * CustomerRouteShells — Lean customer-facing route shells gated behind capability flags:
 * - /order-lookup
 * - /account/orders
 * - /account/orders/:id
 * - /support
 * - /faq
 * - /exchange/request
 * - /saved
 *
 * Keeps unavailable features clearly unavailable (no fake login, no heavy dashboard).
 */

import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  HelpCircle,
  Lock,
  Mail,
  MapPin,
  PackageSearch,
  Phone,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Truck,
} from 'lucide-react';
import { OrderResult } from '../domain/checkout';
import { createMoney, formatMoney } from '../domain/money';
import { useStorefront } from '../integration/StorefrontProvider';
import { navigateTo } from '../integration/hooks/useRouter';
import { Breadcrumbs } from '../components/layout/Breadcrumbs';
import { EmptyStatePanel } from '../components/ui/StateFeedback';

const SAMPLE_DEMO_ORDER: OrderResult = {
  orderId: 'demo_ord_1041',
  orderReference: 'GAY-DEMO-1041',
  createdAt: '2026-10-20T10:30:00.000Z',
  idempotencyKey: 'idem_sample_demo_1041',
  quoteId: 'qt_sample_1041',
  orderStatus: 'CREATED_DEMO_HOLD',
  paymentStatus: 'PENDING_PAYMENT_INTENT_HANDOFF',
  paymentMethodCode: 'PREPAID_INTENT',
  paymentAction: {
    type: 'PROVIDER_INTENT_PLACEHOLDER',
    summary: 'Prepaid Payment Intent Pending (Stage A Demo Record)',
    nextStepInstruction:
      'In Connected Mode, Kalp Business Core links this order to a live payment provider intent. No payment has been captured.',
    intentReference: 'pi_demo_kalp_1041',
  },
  contact: {
    fullName: 'Ananya Sharma',
    email: 'ananya.demo@example.com',
    phone: '9876543210',
  },
  shippingAddress: {
    recipientName: 'Ananya Sharma',
    line1: '14 C-Scheme, Ashok Nagar',
    city: 'Jaipur',
    state: 'Rajasthan',
    postalCode: '302001',
    countryCode: 'IN',
  },
  shippingMethod: {
    id: 'ship-standard-free',
    title: 'Standard Pan-India Delivery (Free)',
    dispatchEstimate: 'Dispatched within 48 hours from Jaipur warehouse',
    transitEstimate: 'Approx. 5–7 working days after dispatch',
    fee: createMoney(0, 'INR', 2),
    eligible: true,
  },
  items: [
    {
      lineItemId: 'line-demo-1',
      productId: 'prod-gulnaar-anarkali',
      productSlug: 'gulnaar-handblock-anarkali-set',
      productTitle: 'Gulnaar Sindoor Mulmul Handblock Anarkali Set',
      variantId: 'var-gulnaar-m',
      sku: 'GAY-ANK-001-M',
      selectedOptions: { Size: 'M' },
      quantity: 1,
      maxAllowedQuantity: 5,
      unitPrice: createMoney(349000, 'INR', 2),
      lineSubtotal: createMoney(349000, 'INR', 2),
      image: {
        id: 'img-sample',
        url: '/assets/demo/lookbook-anarkali-maroon.svg',
        alt: 'Gulnaar Anarkali Set',
        width: 900,
        height: 1200,
        aspectRatio: '3:4',
        isDemoFixture: true,
      },
      availability: 'IN_STOCK',
      setSummary: '3-Piece Set: Kalidar Anarkali Kurta, Cambric Palazzos & Kota Doria Dupatta',
      isDemoFixture: true,
    },
  ],
  totals: {
    itemsSubtotal: createMoney(429000, 'INR', 2),
    discountTotal: createMoney(80000, 'INR', 2),
    shippingFee: createMoney(0, 'INR', 2),
    taxTotal: createMoney(37393, 'INR', 2),
    payableTotal: createMoney(349000, 'INR', 2),
  },
  isDemoOrder: true,
  demoDisclaimer:
    'DEMO MODE RECORD: This order reference exists only in local demo memory to demonstrate separated orderStatus and paymentStatus.',
};

export function OrderLookupRouteShell() {
  const { capabilities, config, devController, runtimeMode } = useStorefront();
  const [referenceInput, setReferenceInput] = useState('');
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [foundOrder, setFoundOrder] = useState<OrderResult | null>(null);

  if (!capabilities?.orderLookupEnabled) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Order Lookup' }]} />
        <div className="mt-6 border border-[#D6CFC2] bg-[#FAF8F5] p-8">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-[#7A1C1D] uppercase">
            CAPABILITY GATED · LIVE ORDER LOOKUP UNAVAILABLE
          </p>
          <h1 className="mt-1 font-editorial text-3xl font-semibold text-[#161311]">
            Online Order Lookup Is Not Yet Connected
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[#524B44]">
            Self-service order tracking will activate once the Kalp Business API order lookup
            endpoint is connected. For immediate status updates on an existing GAYRAA order, please
            contact our Jaipur studio with your Order ID:
          </p>
          {config && (
            <div className="mt-4 border border-[#D6CFC2] bg-[#F4F1EA] p-4 text-xs text-[#161311]">
              <p>
                <strong>Email:</strong> {config.contact.email}
              </p>
              <p className="mt-1">
                <strong>Phone / WhatsApp:</strong> {config.contact.phone} ({config.contact.hours})
              </p>
            </div>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigateTo('/support')}
              className="h-11 bg-[#161311] px-5 text-xs font-semibold tracking-wider text-[#F4F1EA] uppercase hover:bg-[#7A1C1D]"
            >
              Contact Jaipur Support
            </button>
            <button
              type="button"
              onClick={() => navigateTo('/collections/all')}
              className="h-11 border border-[#D6CFC2] bg-[#FAF8F5] px-5 text-xs font-semibold tracking-wider text-[#161311] uppercase hover:border-[#161311]"
            >
              Browse Collections
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError(null);
    const trimmed = referenceInput.trim().toUpperCase();
    if (!trimmed) {
      setLookupError('Please enter a Demo Order Reference (for example, GAY-DEMO-1041).');
      return;
    }

    const sessionMatch = devController?.getOrderByReference(trimmed) ?? null;
    if (sessionMatch) {
      setFoundOrder(sessionMatch);
      return;
    }
    if (trimmed === SAMPLE_DEMO_ORDER.orderReference) {
      setFoundOrder(SAMPLE_DEMO_ORDER);
      return;
    }

    setFoundOrder(null);
    setLookupError(
      `No demo order found in memory for "${trimmed}". Place a demo order in Checkout or click "Inspect Sample Demo Order (GAY-DEMO-1041)" below.`
    );
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Order Status Lookup' }]} />

      <div className="mt-4 border border-[#D6CFC2] bg-[#FAF8F5] p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <PackageSearch className="mt-1 h-6 w-6 shrink-0 text-[#7A1C1D]" aria-hidden="true" />
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] text-[#7A1C1D] uppercase">
              {runtimeMode === 'demo'
                ? 'DEMO MODE · GUEST ORDER REFERENCE LOOKUP'
                : 'GUEST ORDER REFERENCE LOOKUP'}
            </p>
            <h1 className="mt-1 font-editorial text-3xl font-semibold text-[#161311]">
              Check Order &amp; Payment Status
            </h1>
            <p className="mt-1.5 text-xs leading-relaxed text-[#524B44]">
              Enter a Demo Order Reference created during this session (e.g.,{' '}
              <code className="font-mono font-semibold text-[#161311]">GAY-DEMO-1041</code>) to
              inspect separated order and payment lifecycle states.
            </p>
          </div>
        </div>

        <form onSubmit={handleLookup} className="mt-6 flex flex-col gap-3 sm:flex-row">
          <label htmlFor="order-ref-input" className="sr-only">
            Order Reference Number
          </label>
          <input
            id="order-ref-input"
            type="text"
            value={referenceInput}
            onChange={(e) => setReferenceInput(e.target.value)}
            placeholder="e.g. GAY-DEMO-1041"
            className="h-11 flex-1 border border-[#D6CFC2] bg-[#F4F1EA] px-3.5 font-mono text-sm text-[#161311] uppercase"
          />
          <button
            type="submit"
            className="h-11 bg-[#161311] px-6 text-xs font-semibold tracking-wider text-[#F4F1EA] uppercase hover:bg-[#7A1C1D]"
          >
            Lookup Order
          </button>
          <button
            type="button"
            onClick={() => {
              setReferenceInput(SAMPLE_DEMO_ORDER.orderReference);
              setLookupError(null);
              setFoundOrder(SAMPLE_DEMO_ORDER);
            }}
            className="h-11 border border-[#D6CFC2] bg-[#F4F1EA] px-4 text-xs font-semibold tracking-wider text-[#161311] uppercase hover:border-[#161311]"
          >
            Inspect Sample (GAY-DEMO-1041)
          </button>
        </form>

        {lookupError && (
          <p role="alert" className="mt-3 text-xs font-semibold text-[#961B1E]">
            {lookupError}
          </p>
        )}

        {foundOrder && (
          <div className="mt-8 space-y-5 border-t border-[#D6CFC2] pt-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-editorial text-2xl font-semibold text-[#161311]">
                Reference: {foundOrder.orderReference}
              </h2>
              <span className="text-xs font-semibold text-[#7A1C1D] uppercase">
                Demo Fixture Record (Not a Real Order)
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="border border-[#D6CFC2] bg-[#F4F1EA] p-4">
                <span className="block text-[11px] font-semibold tracking-wider text-[#524B44] uppercase">
                  Order Status
                </span>
                <div className="mt-1 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#165B38]" aria-hidden="true" />
                  <span className="font-mono text-xs font-semibold text-[#161311]">
                    {foundOrder.orderStatus}
                  </span>
                </div>
              </div>

              <div className="border border-[#E8C79B] bg-[#FDF3E7] p-4">
                <span className="block text-[11px] font-semibold tracking-wider text-[#7C4700] uppercase">
                  Payment Status (Separate from Order)
                </span>
                <div className="mt-1 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[#7C4700]" aria-hidden="true" />
                  <span className="font-mono text-xs font-semibold text-[#7C4700]">
                    {foundOrder.paymentStatus}
                  </span>
                </div>
              </div>
            </div>

            <div className="border border-[#D6CFC2] bg-[#F4F1EA] p-4 text-xs">
              <p className="font-semibold text-[#161311]">
                Recipient: {foundOrder.shippingAddress.recipientName} ({foundOrder.shippingAddress.city},{' '}
                {foundOrder.shippingAddress.postalCode})
              </p>
              <p className="mt-1 text-[#524B44]">
                Total: <strong>{formatMoney(foundOrder.totals.payableTotal)}</strong> ·{' '}
                {foundOrder.shippingMethod.title}
              </p>
              <p className="mt-2 text-[11px] text-[#6B6259]">{foundOrder.demoDisclaimer}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function AccountOrdersRouteShell({ orderId }: { orderId?: string }) {
  const { capabilities } = useStorefront();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Account Orders', href: '/account/orders' },
          ...(orderId ? [{ label: `Order ${orderId}` }] : []),
        ]}
      />

      <div className="mt-6 border border-[#D6CFC2] bg-[#FAF8F5] p-8">
        <div className="flex items-start gap-3.5">
          <Lock className="mt-1 h-6 w-6 shrink-0 text-[#7A1C1D]" aria-hidden="true" />
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] text-[#7A1C1D] uppercase">
              CAPABILITY GATED ({capabilities?.customerAccountsEnabled ? 'ENABLED' : 'DISABLED'})
            </p>
            <h1 className="mt-1 font-editorial text-3xl font-semibold text-[#161311]">
              {orderId
                ? `Customer Account Order #${orderId} Unavailable`
                : 'Customer Account Portal Is Not Enabled'}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-[#524B44]">
              GAYRAA is a shopping-first storefront and does not require customer login to browse or
              place orders. Authenticated account history (<code>/account/orders</code>) remains
              disabled until Kalp Customer Auth is provisioned in Stage B.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigateTo('/order-lookup')}
                className="h-11 bg-[#161311] px-5 text-xs font-semibold tracking-wider text-[#F4F1EA] uppercase hover:bg-[#7A1C1D]"
              >
                Use Guest Order Reference Lookup
              </button>
              <button
                type="button"
                onClick={() => navigateTo('/support')}
                className="h-11 border border-[#D6CFC2] bg-[#F4F1EA] px-5 text-xs font-semibold tracking-wider text-[#161311] uppercase hover:border-[#161311]"
              >
                Contact Jaipur Client Care
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SupportRouteShell() {
  const { config, openPolicyDrawer } = useStorefront();

  if (!config) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Atelier Client Care & Support' }]} />

      <div className="mt-4 border border-[#D6CFC2] bg-[#FAF8F5] p-6 sm:p-10">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-[#7A1C1D] uppercase">
          JAIPUR ATELIER DIRECT ASSISTANCE
        </p>
        <h1 className="mt-1 font-editorial text-3xl font-semibold text-[#161311] sm:text-4xl">
          Client Care &amp; Dispatch Support
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#524B44]">
          Our team at Sanganer, Jaipur assists with garment sizing measurements, prepaid 3-day
          express shipping inquiries, and eligible 3-day size/defect exchange requests.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="border border-[#D6CFC2] bg-[#F4F1EA] p-5">
            <Phone className="h-5 w-5 text-[#7A1C1D]" aria-hidden="true" />
            <h2 className="mt-3 text-xs font-semibold tracking-wider text-[#161311] uppercase">
              Phone &amp; WhatsApp
            </h2>
            <p className="mt-1 font-mono text-sm font-semibold text-[#161311]">
              {config.contact.phone}
            </p>
            <p className="mt-1 text-xs text-[#524B44]">{config.contact.hours}</p>
          </div>

          <div className="border border-[#D6CFC2] bg-[#F4F1EA] p-5">
            <Mail className="h-5 w-5 text-[#7A1C1D]" aria-hidden="true" />
            <h2 className="mt-3 text-xs font-semibold tracking-wider text-[#161311] uppercase">
              Email Support
            </h2>
            <p className="mt-1 font-mono text-sm font-semibold text-[#161311]">
              {config.contact.email}
            </p>
            <p className="mt-1 text-xs text-[#524B44]">
              Include your Order ID for size/defect exchanges or express shipping confirmation.
            </p>
          </div>

          <div className="border border-[#D6CFC2] bg-[#F4F1EA] p-5">
            <MapPin className="h-5 w-5 text-[#7A1C1D]" aria-hidden="true" />
            <h2 className="mt-3 text-xs font-semibold tracking-wider text-[#161311] uppercase">
              Manufacturing Facility
            </h2>
            <p className="mt-1 text-xs font-semibold text-[#161311]">{config.legalEntityName}</p>
            <p className="mt-1 text-xs text-[#524B44]">{config.contact.address}</p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 border-t border-[#D6CFC2] pt-6 sm:grid-cols-2">
          <div>
            <h2 className="flex items-center gap-2 text-xs font-semibold tracking-wider text-[#161311] uppercase">
              <Truck className="h-4 w-4 text-[#7A1C1D]" aria-hidden="true" />
              <span>Prepaid 3-Day Express Delivery Inquiry</span>
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-[#524B44]">
              Standard shipping across India is complimentary (dispatched within 48 hours; 5–7
              working days transit). Paid prepaid express delivery (approx. 3 business days) is
              available upon direct PIN-code and charge confirmation with our team between 11:00 AM
              and 6:00 PM IST.
            </p>
            <button
              type="button"
              onClick={(e) => openPolicyDrawer('shipping', e.currentTarget)}
              className="mt-2 text-xs font-semibold text-[#7A1C1D] underline underline-offset-4"
            >
              Read Full Shipping Policy
            </button>
          </div>

          <div>
            <h2 className="flex items-center gap-2 text-xs font-semibold tracking-wider text-[#161311] uppercase">
              <RefreshCw className="h-4 w-4 text-[#7A1C1D]" aria-hidden="true" />
              <span>3-Day Size &amp; Defect Exchange Assistance</span>
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-[#524B44]">
              Exchanges are accepted strictly for size fit issues or defective/damaged items within 3
              days of delivery with a valid Order ID. Return shipping back to Jaipur is arranged and
              paid by the customer (no reverse pickup; no general monetary refunds).
            </p>
            <div className="mt-2 flex flex-wrap gap-4">
              <button
                type="button"
                onClick={(e) => openPolicyDrawer('exchange', e.currentTarget)}
                className="text-xs font-semibold text-[#7A1C1D] underline underline-offset-4"
              >
                Read Exchange Terms
              </button>
              <button
                type="button"
                onClick={() => navigateTo('/exchange/request')}
                className="text-xs font-semibold text-[#161311] underline underline-offset-4"
              >
                Open 3-Day Exchange Request Guide
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FaqRouteShell() {
  const { openPolicyDrawer } = useStorefront();

  const faqs = [
    {
      q: 'What are GAYRAA’s shipping charges and delivery timelines across India?',
      a: 'Standard shipping is free across India on all orders with no minimum threshold. Orders are dispatched from our Sanganer, Jaipur facility within 48 hours of placement, and standard transit takes approximately 5–7 working days after dispatch.',
    },
    {
      q: 'How can I request 3-day prepaid express delivery?',
      a: 'Paid prepaid express delivery (approximately 3 business days) is not auto-quoted in the checkout form because courier serviceability and charges depend on your destination PIN code. Please call +91 7300006707 or email gayraabysnm@gmail.com between 11:00 AM and 6:00 PM IST (Monday–Saturday) to confirm express availability.',
    },
    {
      q: 'What is GAYRAA’s exchange and refund policy?',
      a: 'GAYRAA does not offer monetary refunds. Exchanges are permitted strictly for size issues or defective/damaged items within 3 days of delivery with a valid Order ID. Only one exchange is allowed per product. Items must be unused, unwashed, unworn, and returned with original tags intact. Customers arrange and pay for return shipping back to Jaipur (no reverse pickup).',
    },
    {
      q: 'How do I choose the right garment size and check what pieces are included?',
      a: 'Every product detail page displays a product-specific garment measurement table (Bust, Waist, Hip, and Garment Length in inches) alongside an explicit Set Inclusions list (e.g., 3-Piece Anarkali Set vs. 2-Piece Co-ord Set vs. Saree with unstitched blouse piece).',
    },
    {
      q: 'How should I care for Jaipur handblock mulmul cotton and Chanderi silk garments?',
      a: 'Handblock mulmul and cambric cotton sets should be gently hand-washed separately in cold water with mild liquid detergent and dried in shade. Zari-embroidered Chanderi silk, tissue, and organza ensembles should be dry-cleaned only.',
    },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'FAQ & Garment Care' }]} />

      <div className="mt-4 border border-[#D6CFC2] bg-[#FAF8F5] p-6 sm:p-10">
        <div className="flex items-start gap-3">
          <HelpCircle className="mt-1 h-6 w-6 shrink-0 text-[#7A1C1D]" aria-hidden="true" />
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] text-[#7A1C1D] uppercase">
              JAIPUR ATELIER GUIDE
            </p>
            <h1 className="mt-1 font-editorial text-3xl font-semibold text-[#161311] sm:text-4xl">
              Frequently Asked Questions
            </h1>
          </div>
        </div>

        <div className="mt-8 divide-y divide-[#D6CFC2] border-y border-[#D6CFC2]">
          {faqs.map((item, idx) => (
            <details key={idx} className="group py-4" open={idx === 0}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-[#161311]">
                <span>{item.q}</span>
                <span className="font-mono text-xs text-[#7A1C1D] group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2.5 text-xs leading-relaxed text-[#524B44]">{item.a}</p>
            </details>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap gap-4">
            <button
              type="button"
              onClick={(e) => openPolicyDrawer('shipping', e.currentTarget)}
              className="font-semibold text-[#7A1C1D] underline underline-offset-4"
            >
              View Shipping Policy Drawer
            </button>
            <button
              type="button"
              onClick={(e) => openPolicyDrawer('exchange', e.currentTarget)}
              className="font-semibold text-[#7A1C1D] underline underline-offset-4"
            >
              View Exchange Policy Drawer
            </button>
          </div>
          <button
            type="button"
            onClick={() => navigateTo('/collections/all')}
            className="h-10 bg-[#161311] px-4 text-xs font-semibold tracking-wider text-[#F4F1EA] uppercase hover:bg-[#7A1C1D]"
          >
            Explore Catalog
          </button>
        </div>
      </div>
    </div>
  );
}

export function ExchangeRequestRouteShell() {
  const { capabilities, config } = useStorefront();
  const [orderId, setOrderId] = useState('');
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState<'SIZE_FIT_ISSUE' | 'DEFECTIVE_DAMAGED_ITEM'>(
    'SIZE_FIT_ISSUE'
  );
  const [requestedSize, setRequestedSize] = useState('M');
  const [confirmedWithin3Days, setConfirmedWithin3Days] = useState(false);
  const [confirmedCustomerReturnShipping, setConfirmedCustomerReturnShipping] = useState(false);
  const [submittedSummary, setSubmittedSummary] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  if (!capabilities?.selfServeExchangeEnabled) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: '3-Day Exchange Request' }]} />
        <div className="mt-6 border border-[#D6CFC2] bg-[#FAF8F5] p-8">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-[#7A1C1D] uppercase">
            CAPABILITY GATED · DIRECT ATELIER EXCHANGE ONLY
          </p>
          <h1 className="mt-1 font-editorial text-3xl font-semibold text-[#161311]">
            Initiate Your 3-Day Exchange via Email or Phone
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[#524B44]">
            Online exchange ticket submission is disabled in this environment. Per GAYRAA policy,
            please contact <strong>{config?.contact.email}</strong> or{' '}
            <strong>{config?.contact.phone}</strong> within <strong>3 days of delivery</strong> with
            your valid Order ID for size issues or defective items.
          </p>
        </div>
      </div>
    );
  }

  const handlePrepareRequest = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!orderId.trim() || !email.trim()) {
      setFormError('Please provide both your valid Order ID and email address.');
      return;
    }
    if (!confirmedWithin3Days || !confirmedCustomerReturnShipping) {
      setFormError(
        'Please confirm the 3-day delivery window, original tag condition, and customer-arranged return shipping terms.'
      );
      return;
    }

    setSubmittedSummary(
      `DEMO EXCHANGE SUMMARY — Order ID: ${orderId.trim().toUpperCase()} | Reason: ${
        reason === 'SIZE_FIT_ISSUE'
          ? `Size Exchange (Requested Size: ${requestedSize})`
          : 'Defective / Damaged Item Delivered'
      } | Contact: ${email.trim()}. In production, email this reference to ${
        config?.contact.email ?? 'gayraabysnm@gmail.com'
      } within 3 days of delivery.`
    );
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: '3-Day Exchange Request' }]} />

      <div className="mt-4 border border-[#D6CFC2] bg-[#FAF8F5] p-6 sm:p-8">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-[#7A1C1D] uppercase">
          LIMITED 3-DAY SIZE &amp; DEFECT EXCHANGE SHELL (DEMO MODE)
        </p>
        <h1 className="mt-1 font-editorial text-3xl font-semibold text-[#161311]">
          3-Day Exchange Eligibility &amp; Request Builder
        </h1>
        <p className="mt-2 text-xs leading-relaxed text-[#524B44]">
          Per GAYRAA policy: No monetary refunds. Exchanges are accepted strictly for{' '}
          <strong>size issues</strong> or <strong>defective/damaged items</strong> within{' '}
          <strong>3 days of delivery</strong> with a valid Order ID (limit 1 exchange per product;
          customer-arranged and customer-paid return shipping to Jaipur; no reverse pickup).
        </p>

        <form onSubmit={handlePrepareRequest} className="mt-6 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="ex-order-id"
                className="block text-xs font-semibold tracking-wider text-[#161311] uppercase"
              >
                Valid Order ID *
              </label>
              <input
                id="ex-order-id"
                type="text"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                placeholder="e.g. GAY-DEMO-1041"
                className="mt-1.5 h-11 w-full border border-[#D6CFC2] bg-[#F4F1EA] px-3 text-sm text-[#161311]"
              />
            </div>

            <div>
              <label
                htmlFor="ex-email"
                className="block text-xs font-semibold tracking-wider text-[#161311] uppercase"
              >
                Order Email Address *
              </label>
              <input
                id="ex-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="mt-1.5 h-11 w-full border border-[#D6CFC2] bg-[#F4F1EA] px-3 text-sm text-[#161311]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="ex-reason"
                className="block text-xs font-semibold tracking-wider text-[#161311] uppercase"
              >
                Eligible Exchange Reason *
              </label>
              <select
                id="ex-reason"
                value={reason}
                onChange={(e) =>
                  setReason(e.target.value as 'SIZE_FIT_ISSUE' | 'DEFECTIVE_DAMAGED_ITEM')
                }
                className="mt-1.5 h-11 w-full border border-[#D6CFC2] bg-[#F4F1EA] px-3 text-xs font-semibold text-[#161311]"
              >
                <option value="SIZE_FIT_ISSUE">Size Fit Issue (1 Exchange Permitted)</option>
                <option value="DEFECTIVE_DAMAGED_ITEM">Defective or Damaged Item Delivered</option>
              </select>
            </div>

            {reason === 'SIZE_FIT_ISSUE' && (
              <div>
                <label
                  htmlFor="ex-size"
                  className="block text-xs font-semibold tracking-wider text-[#161311] uppercase"
                >
                  Replacement Size Requested
                </label>
                <select
                  id="ex-size"
                  value={requestedSize}
                  onChange={(e) => setRequestedSize(e.target.value)}
                  className="mt-1.5 h-11 w-full border border-[#D6CFC2] bg-[#F4F1EA] px-3 text-xs font-semibold text-[#161311]"
                >
                  {['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'].map((s) => (
                    <option key={s} value={s}>
                      Size {s}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="space-y-2.5 border border-[#D6CFC2] bg-[#F4F1EA] p-4 text-xs text-[#161311]">
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={confirmedWithin3Days}
                onChange={(e) => setConfirmedWithin3Days(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#7A1C1D]"
              />
              <span>
                I confirm my order was delivered within the last <strong>3 days</strong> and the
                garment is unused, unwashed, unworn, with all original tags and packaging intact.
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={confirmedCustomerReturnShipping}
                onChange={(e) => setConfirmedCustomerReturnShipping(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#7A1C1D]"
              />
              <span>
                I understand that reverse pickup is not available and I will arrange and pay for
                return shipping back to the GAYRAA Sanganer, Jaipur facility (one exchange per
                product; no monetary refund).
              </span>
            </label>
          </div>

          {formError && (
            <p role="alert" className="text-xs font-semibold text-[#961B1E]">
              {formError}
            </p>
          )}

          <button
            type="submit"
            className="h-11 bg-[#161311] px-6 text-xs font-semibold tracking-wider text-[#F4F1EA] uppercase hover:bg-[#7A1C1D]"
          >
            Prepare 3-Day Exchange Request (Demo)
          </button>
        </form>

        {submittedSummary && (
          <div
            role="status"
            className="mt-6 border border-[#165B38] bg-[#EBF5EF] p-4 text-xs text-[#165B38]"
          >
            <p className="font-semibold">{submittedSummary}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function SavedStylesRouteShell() {
  const { capabilities } = useStorefront();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Saved Styles' }]} />
      <div className="mt-6">
        <EmptyStatePanel
          title={`Saved Styles / Wishlist (${
            capabilities?.wishlistEnabled ? 'Enabled' : 'Capability Disabled'
          })`}
          description="Persistent wishlists require connected Kalp customer accounts and are intentionally disabled in this storefront configuration so no local data is misrepresented as a cloud account."
          actionLabel="Explore Jaipur Collections"
          onAction={() => navigateTo('/collections/all')}
        />
      </div>
    </div>
  );
}
