/**
 * QuantityStepper — Accessible quantity control with explicit pending state
 * that never shifts layout geometry during updates.
 */

import React from 'react';
import { Loader2, Minus, Plus } from 'lucide-react';

interface QuantityStepperProps {
  quantity: number;
  maxQuantity?: number;
  minQuantity?: number;
  pending?: boolean;
  disabled?: boolean;
  onChange: (nextQuantity: number) => void;
  label?: string;
}

export function QuantityStepper({
  quantity,
  maxQuantity = 5,
  minQuantity = 1,
  pending = false,
  disabled = false,
  onChange,
  label = 'Quantity',
}: QuantityStepperProps) {
  const canDecrement = !disabled && !pending && quantity > minQuantity;
  const canIncrement = !disabled && !pending && quantity < maxQuantity;

  return (
    <div
      className="inline-flex h-10 items-center border border-[#D6CFC2] bg-[#FAF8F5]"
      role="group"
      aria-label={label}
      aria-busy={pending}
    >
      <button
        type="button"
        onClick={() => canDecrement && onChange(quantity - 1)}
        disabled={!canDecrement}
        aria-label={`Decrease ${label}`}
        className="flex h-full w-10 items-center justify-center text-[#161311] transition-colors duration-150 hover:bg-[#EAE4D8] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>

      <div className="flex h-full w-11 items-center justify-center border-x border-[#D6CFC2] text-sm font-semibold tabular-nums text-[#161311]">
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[#7A1C1D]" aria-label="Updating quantity" />
        ) : (
          quantity
        )}
      </div>

      <button
        type="button"
        onClick={() => canIncrement && onChange(quantity + 1)}
        disabled={!canIncrement}
        aria-label={`Increase ${label}`}
        className="flex h-full w-10 items-center justify-center text-[#161311] transition-colors duration-150 hover:bg-[#EAE4D8] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
