/**
 * Footer — Surface-contrast footer with GAYRAA Jaipur contact information,
 * navigation columns gated by capability flags, policy triggers, and explicit mode status.
 */

import React from 'react';
import { useStorefront } from '../../integration/StorefrontProvider';
import { navigateTo } from '../../integration/hooks/useRouter';

export function Footer() {
  const { config, navigation, capabilities, runtimeMode, openPolicyDrawer } = useStorefront();

  if (!config || !navigation) return null;

  return (
    <footer className="surface-contrast border-t border-[#38312C] bg-[#161311] text-[#F4F1EA]">
      <div className="mx-auto max-w-[1360px] px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          {/* Brand & Jaipur Studio Contact */}
          <div className="lg:col-span-5">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                navigateTo('/');
              }}
              className="font-editorial text-3xl font-semibold tracking-[0.22em] text-[#F4F1EA]"
            >
              {config.businessName}
            </a>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-[#C8C0B4]">
              {config.tagline}
            </p>

            <dl className="mt-6 space-y-1.5 text-xs text-[#C8C0B4]">
              <div>
                <dt className="inline font-semibold text-[#F4F1EA]">Manufacturer: </dt>
                <dd className="inline">{config.legalEntityName}</dd>
              </div>
              <div>
                <dt className="inline font-semibold text-[#F4F1EA]">Jaipur Atelier: </dt>
                <dd className="inline">{config.contact.address}</dd>
              </div>
              <div>
                <dt className="inline font-semibold text-[#F4F1EA]">Customer Support: </dt>
                <dd className="inline">
                  {config.contact.email} · {config.contact.phone}
                </dd>
              </div>
              <div>
                <dt className="inline font-semibold text-[#F4F1EA]">Support Hours: </dt>
                <dd className="inline">{config.contact.hours}</dd>
              </div>
            </dl>
          </div>

          {/* Navigation & Policy Columns */}
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 lg:col-span-7">
            {navigation.footerColumns.map((col) => {
              // Filter out links whose required capability is disabled so unavailable features stay hidden in primary/footer nav
              const visibleLinks = col.links.filter((link) => {
                if (!link.requiresCapability) return true;
                return Boolean(capabilities?.[link.requiresCapability]);
              });

              return (
                <div key={col.id}>
                  <h2 className="text-xs font-semibold tracking-[0.16em] text-[#F4F1EA] uppercase">
                    {col.title}
                  </h2>
                  <ul className="mt-4 space-y-2.5 text-xs text-[#C8C0B4]">
                    {visibleLinks.map((link) => (
                      <li key={link.label}>
                        {link.policyId ? (
                          <button
                            type="button"
                            onClick={(e) => openPolicyDrawer(link.policyId!, e.currentTarget)}
                            className="text-left transition-colors duration-150 hover:text-[#F4F1EA] hover:underline hover:underline-offset-4"
                          >
                            {link.label}
                          </button>
                        ) : (
                          <a
                            href={link.href || '/'}
                            onClick={(e) => {
                              e.preventDefault();
                              navigateTo(link.href || '/');
                            }}
                            className="transition-colors duration-150 hover:text-[#F4F1EA] hover:underline hover:underline-offset-4"
                          >
                            {link.label}
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Legal & Milestone Notice */}
        <div className="mt-12 border-t border-[#38312C] pt-6 text-xs text-[#C8C0B4]">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <p>
              © {new Date().getFullYear()} {config.businessName} ({config.legalEntityName}).
            </p>
            <p className="text-[11px] text-[#C8C0B4]">
              Runtime Mode: <strong className="uppercase text-[#F4F1EA]">{runtimeMode}</strong> ·
              Status: <strong className="text-[#F4F1EA]">Frontend prototype implemented</strong> ·{' '}
              <strong className="text-[#F4F1EA]">Live Kalp integration pending</strong>
            </p>
          </div>
          {runtimeMode === 'demo' && (
            <p className="mt-2 text-[11px] text-[#C8C0B4]/80">{config.demoModeNotice}</p>
          )}
        </div>
      </div>
    </footer>
  );
}
