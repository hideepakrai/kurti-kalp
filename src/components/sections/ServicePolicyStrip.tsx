/**
 * ServicePolicyStrip — 4-column service and policy strip.
 * Reflects GAYRAA's inspected policies (Free pan-India standard shipping, 48h dispatch,
 * and limited 3-day size/defect exchange with Order ID and customer-paid return shipping).
 */

import React from 'react';
import { RefreshCw, ShieldCheck, Sparkles, Truck } from 'lucide-react';
import { ServicePolicyStripSectionConfig } from '../../domain/content';
import { useStorefront } from '../../integration/StorefrontProvider';

export function ServicePolicyStrip({
  config,
}: {
  config: ServicePolicyStripSectionConfig;
}) {
  const { openPolicyDrawer } = useStorefront();

  const renderIcon = (iconName: 'truck' | 'refresh' | 'sparkles' | 'shield') => {
    switch (iconName) {
      case 'truck':
        return <Truck className="h-6 w-6 text-[#7A1C1D]" aria-hidden="true" />;
      case 'refresh':
        return <RefreshCw className="h-6 w-6 text-[#7A1C1D]" aria-hidden="true" />;
      case 'sparkles':
        return <Sparkles className="h-6 w-6 text-[#7A1C1D]" aria-hidden="true" />;
      case 'shield':
        return <ShieldCheck className="h-6 w-6 text-[#7A1C1D]" aria-hidden="true" />;
    }
  };

  return (
    <section
      aria-label="Service and policy commitments"
      className="border-b border-[#D6CFC2] bg-[#EAE4D8] py-10"
    >
      <div className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {config.items.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-4 border border-[#D6CFC2] bg-[#FAF8F5] p-5"
            >
              <div className="mt-0.5 shrink-0">{renderIcon(item.iconName)}</div>
              <div>
                <h3 className="text-xs font-semibold tracking-wider text-[#161311] uppercase">
                  {item.title}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-[#524B44]">{item.subtitle}</p>
                {item.policyId && (
                  <button
                    type="button"
                    onClick={(e) => openPolicyDrawer(item.policyId!, e.currentTarget)}
                    className="mt-2 text-[11px] font-semibold text-[#7A1C1D] underline underline-offset-4 hover:text-[#161311]"
                  >
                    View Policy Details
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
