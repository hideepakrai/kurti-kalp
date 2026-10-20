/**
 * PolicyDrawer — Reusable content panel for GAYRAA Shipping, Exchange, Privacy, and Terms policies.
 */

import React from 'react';
import { ExternalLink, ShieldAlert } from 'lucide-react';
import { useStorefront } from '../../integration/StorefrontProvider';
import { Drawer } from '../ui/Drawer';

export function PolicyDrawer() {
  const { config, activePolicy, closePolicyDrawer, openPolicyDrawer } = useStorefront();

  if (!activePolicy || !config) return null;

  const policyTabs: Array<{ id: 'shipping' | 'exchange' | 'privacy' | 'terms'; label: string }> = [
    { id: 'shipping', label: 'Shipping' },
    { id: 'exchange', label: 'Exchanges' },
    { id: 'privacy', label: 'Privacy' },
    { id: 'terms', label: 'Terms' },
  ];

  return (
    <Drawer
      isOpen={Boolean(activePolicy)}
      onClose={closePolicyDrawer}
      title={activePolicy.title}
      subtitle="GAYRAA Configurable Policy Baseline (Stage A)"
    >
      {/* Switcher tabs across policy topics */}
      <div className="mb-5 flex flex-wrap gap-1.5 border-b border-[#D6CFC2] pb-3">
        {policyTabs.map((tab) => {
          const isCurrent = activePolicy.id === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => openPolicyDrawer(tab.id)}
              className={`px-3 py-1.5 text-xs font-semibold tracking-wider uppercase transition-colors duration-150 ${
                isCurrent
                  ? 'bg-[#161311] text-[#F4F1EA]'
                  : 'border border-[#D6CFC2] bg-[#F4F1EA] text-[#524B44] hover:text-[#161311]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-4 text-sm leading-relaxed text-[#161311]">
        <p className="font-semibold">{activePolicy.shortSummary}</p>

        <ul className="space-y-2.5 border-y border-[#D6CFC2] py-4 text-xs text-[#524B44]">
          {activePolicy.bulletPoints.map((bullet, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-[#7A1C1D]" aria-hidden="true" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>

        <div className="border border-[#E8C79B] bg-[#FDF3E7] p-3.5 text-xs text-[#7C4700]">
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-semibold">Important Policy Notice</p>
              <p className="mt-1">{activePolicy.importantNotice}</p>
            </div>
          </div>
        </div>

        <div className="space-y-1 border-t border-[#D6CFC2] pt-3 text-xs text-[#524B44]">
          <p>{activePolicy.lastInspectedNote}</p>
          <p className="flex items-center gap-1.5">
            <span>Reference URL:</span>
            <span className="font-mono text-[11px] text-[#161311]">{activePolicy.sourceUrl}</span>
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </p>
          <p className="pt-2">
            <strong>Direct Support:</strong> {config.contact.email} · {config.contact.phone} (
            {config.contact.hours})
          </p>
        </div>
      </div>
    </Drawer>
  );
}
