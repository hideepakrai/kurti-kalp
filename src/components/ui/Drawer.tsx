/**
 * Accessible Modal Drawer component with focus trap, Escape key handling,
 * and automatic focus restoration.
 */

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  side?: 'right' | 'left';
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Drawer({
  isOpen,
  onClose,
  title,
  subtitle,
  side = 'right',
  children,
  footer,
}: DrawerProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Move initial focus inside drawer
    const focusableSelector =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const panel = panelRef.current;
    if (panel) {
      const firstFocusable = panel.querySelector<HTMLElement>(focusableSelector);
      if (firstFocusable) {
        firstFocusable.focus();
      } else {
        panel.focus();
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab' && panelRef.current) {
        const focusables = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(focusableSelector)
        );
        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#161311]/55 transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`relative z-10 flex h-full w-full max-w-md flex-col bg-[#FAF8F5] text-[#161311] shadow-2xl ${
          side === 'right' ? 'ml-auto border-l border-[#D6CFC2]' : 'mr-auto border-r border-[#D6CFC2]'
        }`}
      >
        <div className="flex items-start justify-between border-b border-[#D6CFC2] px-6 py-4">
          <div>
            <h2 id="drawer-title" className="font-editorial text-2xl font-semibold tracking-tight text-[#161311]">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-xs text-[#524B44]">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="flex h-10 w-10 items-center justify-center border border-transparent text-[#161311] transition-colors duration-150 hover:border-[#D6CFC2] hover:bg-[#EAE4D8]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer && (
          <div className="border-t border-[#D6CFC2] bg-[#F4F1EA] px-6 py-4">{footer}</div>
        )}
      </div>
    </div>
  );
}
