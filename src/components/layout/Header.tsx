/**
 * Header — Complete config-driven navigation for GAYRAA.
 * Includes:
 * - Brand logo linking home
 * - Primary nav: New Arrivals, Best Sellers, All Collections (expandable), Shop by Occasion (expandable)
 * - Working search input submitting to /search?q=...
 * - Shopping bag button with live item count
 * - Expandable mobile navigation drawer
 * Excludes unwired account, wishlist, or app-download buttons.
 */

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Menu, Search, ShoppingBag, X } from 'lucide-react';
import { NavigationGroup } from '../../domain/content';
import { useStorefront } from '../../integration/StorefrontProvider';
import { navigateTo, useRouter } from '../../integration/hooks/useRouter';
import { Drawer } from '../ui/Drawer';

export function Header() {
  const { config, navigation, cart, openCartDrawer } = useStorefront();
  const { pathname, searchParams } = useRouter();

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [searchInput, setSearchInput] = useState<string>(() => searchParams.get('q') || '');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [expandedMobileGroups, setExpandedMobileGroups] = useState<Record<string, boolean>>({
    'nav-all-collections': true,
    'nav-occasions': false,
  });

  const navContainerRef = useRef<HTMLElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setSearchInput(searchParams.get('q') || '');
  }, [searchParams]);

  // Close desktop dropdowns when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (navContainerRef.current && !navContainerRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenuId(null);
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    setOpenMenuId(null);
    setIsMobileMenuOpen(false);
    navigateTo(href);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchInput.trim();
    setIsSearchOpen(false);
    setIsMobileMenuOpen(false);
    navigateTo(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : '/collections/all');
  };

  const isGroupActive = (group: NavigationGroup): boolean => {
    if (group.href && pathname === group.href) return true;
    if (group.children?.some((child) => pathname === child.href)) return true;
    return false;
  };

  const itemCount = cart?.itemCount ?? 0;

  return (
    <header className="sticky top-0 z-40 border-b border-[#D6CFC2] bg-[#F4F1EA]/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-[1360px] items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
        {/* Left: Mobile Menu Trigger + Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={isMobileMenuOpen}
            className="flex h-10 w-10 items-center justify-center border border-transparent text-[#161311] transition-colors duration-150 hover:border-[#D6CFC2] hover:bg-[#EAE4D8] lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <a
            href="/"
            onClick={(e) => handleLinkClick(e, '/')}
            className="font-editorial text-2xl font-semibold tracking-[0.2em] text-[#161311] whitespace-nowrap shrink-0 sm:text-3xl"
          >
            {config?.businessName || 'GAYRAA'}
          </a>
        </div>

        {/* Center: Primary Navigation (Config-Driven) */}
        <nav
          ref={navContainerRef}
          aria-label="Primary navigation"
          className="hidden lg:flex lg:items-center lg:gap-7"
        >
          {navigation?.primary.map((group) => {
            const hasChildren = Boolean(group.children && group.children.length > 0);
            const isOpen = openMenuId === group.id;
            const active = isGroupActive(group);

            if (!hasChildren && group.href) {
              return (
                <a
                  key={group.id}
                  href={group.href}
                  onClick={(e) => handleLinkClick(e, group.href!)}
                  aria-current={pathname === group.href ? 'page' : undefined}
                  className={`relative py-2 text-xs font-semibold tracking-[0.14em] uppercase whitespace-nowrap shrink-0 transition-colors duration-150 ${
                    active
                      ? 'text-[#7A1C1D] underline decoration-[#7A1C1D] decoration-2 underline-offset-8'
                      : 'text-[#161311] hover:text-[#7A1C1D] hover:underline hover:decoration-[#7A1C1D]/60 hover:underline-offset-8'
                  }`}
                >
                  {group.label}
                </a>
              );
            }

            return (
              <div
                key={group.id}
                className="relative"
                onMouseEnter={() => setOpenMenuId(group.id)}
                onMouseLeave={() => setOpenMenuId(null)}
              >
                <button
                  type="button"
                  onClick={() => setOpenMenuId(isOpen ? null : group.id)}
                  aria-expanded={isOpen}
                  aria-haspopup="true"
                  className={`inline-flex items-center gap-1.5 py-2 text-xs font-semibold tracking-[0.14em] uppercase whitespace-nowrap shrink-0 transition-colors duration-150 ${
                    active || isOpen
                      ? 'text-[#7A1C1D] underline decoration-[#7A1C1D] decoration-2 underline-offset-8'
                      : 'text-[#161311] hover:text-[#7A1C1D]'
                  }`}
                >
                  <span>{group.label}</span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform duration-150 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>

                {isOpen && group.children && (
                  <div className="absolute left-0 top-full w-72 border border-[#D6CFC2] bg-[#FAF8F5] p-3 shadow-lg">
                    <ul className="divide-y divide-[#EAE4D8]">
                      {group.children.map((child) => {
                        const childActive = pathname === child.href;
                        return (
                          <li key={child.id}>
                            <a
                              href={child.href}
                              onClick={(e) => handleLinkClick(e, child.href)}
                              aria-current={childActive ? 'page' : undefined}
                              className={`block px-3 py-2.5 transition-colors duration-150 ${
                                childActive
                                  ? 'bg-[#EAE4D8] text-[#7A1C1D]'
                                  : 'text-[#161311] hover:bg-[#F4F1EA]'
                              }`}
                            >
                              <span className="block text-xs font-semibold tracking-wider uppercase">
                                {child.label}
                              </span>
                              {child.description && (
                                <span className="mt-0.5 block text-[11px] text-[#524B44]">
                                  {child.description}
                                </span>
                              )}
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Right: Header Utilities (Search & Shopping Bag only) */}
        <div className="flex items-center gap-2 shrink-0 sm:gap-3">
          <button
            type="button"
            onClick={() => setIsSearchOpen((prev) => !prev)}
            aria-expanded={isSearchOpen}
            aria-controls="header-search-bar"
            className="inline-flex h-10 items-center gap-2 border border-transparent px-3 text-xs font-semibold tracking-wider text-[#161311] uppercase whitespace-nowrap shrink-0 transition-colors duration-150 hover:border-[#D6CFC2] hover:bg-[#FAF8F5]"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Search</span>
          </button>

          <button
            type="button"
            onClick={(e) => openCartDrawer(e.currentTarget)}
            aria-label={`Shopping bag with ${itemCount} items`}
            className="inline-flex h-10 items-center gap-2 border border-[#161311] bg-[#161311] px-3.5 text-xs font-semibold tracking-wider text-[#F4F1EA] uppercase whitespace-nowrap shrink-0 transition-colors duration-150 hover:border-[#7A1C1D] hover:bg-[#7A1C1D]"
          >
            <ShoppingBag className="h-4 w-4" aria-hidden="true" />
            <span>Bag ({itemCount})</span>
          </button>
        </div>
      </div>

      {/* Expandable Search Panel */}
      {isSearchOpen && (
        <div
          id="header-search-bar"
          className="border-t border-[#D6CFC2] bg-[#FAF8F5] px-4 py-3.5 sm:px-6 lg:px-8"
        >
          <form
            onSubmit={handleSearchSubmit}
            role="search"
            className="mx-auto flex max-w-3xl items-center gap-2"
          >
            <label htmlFor="storefront-search-input" className="sr-only">
              Search GAYRAA collections, fabrics, or silhouettes
            </label>
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#524B44]"
                aria-hidden="true"
              />
              <input
                ref={searchInputRef}
                id="storefront-search-input"
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search Anarkali, Chanderi, Co-ord, Mulmul, Wedding..."
                className="h-11 w-full border border-[#D6CFC2] bg-[#F4F1EA] pl-10 pr-4 text-sm text-[#161311] placeholder:text-[#6B6259]"
              />
            </div>
            <button
              type="submit"
              className="h-11 bg-[#161311] px-5 text-xs font-semibold tracking-wider text-[#F4F1EA] uppercase whitespace-nowrap shrink-0 transition-colors duration-150 hover:bg-[#7A1C1D]"
            >
              Search
            </button>
            <button
              type="button"
              onClick={() => setIsSearchOpen(false)}
              aria-label="Close search bar"
              className="flex h-11 w-11 items-center justify-center border border-[#D6CFC2] text-[#161311] hover:bg-[#EAE4D8]"
            >
              <X className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}

      {/* Mobile Navigation Drawer */}
      <Drawer
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        title="GAYRAA Navigation"
        subtitle="Jaipur Ethnic & Fusion Collections"
        side="left"
      >
        <form onSubmit={handleSearchSubmit} role="search" className="mb-6">
          <label htmlFor="mobile-search-input" className="sr-only">
            Search catalog
          </label>
          <div className="flex gap-2">
            <input
              id="mobile-search-input"
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search Anarkali, Kurta, Co-ord..."
              className="h-11 flex-1 border border-[#D6CFC2] bg-[#F4F1EA] px-3 text-sm text-[#161311]"
            />
            <button
              type="submit"
              className="h-11 bg-[#161311] px-4 text-xs font-semibold tracking-wider text-[#F4F1EA] uppercase"
            >
              Go
            </button>
          </div>
        </form>

        <nav aria-label="Mobile navigation" className="divide-y divide-[#D6CFC2]">
          {navigation?.primary.map((group) => {
            const hasChildren = Boolean(group.children && group.children.length > 0);
            const isExpanded = Boolean(expandedMobileGroups[group.id]);

            if (!hasChildren && group.href) {
              return (
                <div key={group.id} className="py-3">
                  <a
                    href={group.href}
                    onClick={(e) => handleLinkClick(e, group.href!)}
                    className="block text-sm font-semibold tracking-wider text-[#161311] uppercase hover:text-[#7A1C1D]"
                  >
                    {group.label}
                  </a>
                </div>
              );
            }

            return (
              <div key={group.id} className="py-3">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedMobileGroups((prev) => ({
                      ...prev,
                      [group.id]: !prev[group.id],
                    }))
                  }
                  aria-expanded={isExpanded}
                  className="flex w-full items-center justify-between py-1 text-left text-sm font-semibold tracking-wider text-[#161311] uppercase"
                >
                  <span>{group.label}</span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform duration-150 ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {isExpanded && group.children && (
                  <ul className="mt-2 space-y-1 border-l border-[#D6CFC2] pl-4">
                    {group.children.map((child) => (
                      <li key={child.id}>
                        <a
                          href={child.href}
                          onClick={(e) => handleLinkClick(e, child.href)}
                          className="block py-2 text-xs font-semibold tracking-wide text-[#524B44] hover:text-[#7A1C1D]"
                        >
                          {child.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>
      </Drawer>
    </header>
  );
}
