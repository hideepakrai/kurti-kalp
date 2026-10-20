/**
 * SizeGuideModal — Drawer/Modal displaying product-specific garment measurements
 * and GAYRAA's 3-day size/defect exchange notice.
 */

import React from 'react';
import { GarmentMeasurementRow } from '../../domain/catalog';
import { Drawer } from '../ui/Drawer';

interface SizeGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  productTitle: string;
  silhouetteNote: string;
  measurements: GarmentMeasurementRow[];
}

export function SizeGuideModal({
  isOpen,
  onClose,
  productTitle,
  silhouetteNote,
  measurements,
}: SizeGuideModalProps) {
  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Garment Measurement Guide"
      subtitle={`${productTitle} (Demo Fixture)`}
    >
      <div className="space-y-5 text-xs text-[#161311]">
        <p className="leading-relaxed text-[#524B44]">
          <strong>Fit Guidance:</strong> {silhouetteNote} All measurements below are garment
          measurements in inches.
        </p>

        <div className="overflow-x-auto border border-[#D6CFC2]">
          <table className="w-full border-collapse text-left tabular-nums">
            <thead>
              <tr className="border-b border-[#D6CFC2] bg-[#EAE4D8] text-[11px] font-semibold tracking-wider text-[#161311] uppercase">
                <th className="px-3 py-2.5">Size</th>
                <th className="px-3 py-2.5">Bust</th>
                <th className="px-3 py-2.5">Waist</th>
                <th className="px-3 py-2.5">Hip</th>
                <th className="px-3 py-2.5">Length</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAE4D8] bg-[#FAF8F5]">
              {measurements.map((row) => (
                <tr key={row.size}>
                  <td className="px-3 py-2.5 font-semibold text-[#161311]">{row.size}</td>
                  <td className="px-3 py-2.5 text-[#524B44]">{row.bustInches}</td>
                  <td className="px-3 py-2.5 text-[#524B44]">{row.waistInches}</td>
                  <td className="px-3 py-2.5 text-[#524B44]">{row.hipInches}</td>
                  <td className="px-3 py-2.5 text-[#524B44]">{row.garmentLengthInches}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border border-[#D6CFC2] bg-[#F4F1EA] p-3.5 text-[#524B44]">
          <p className="font-semibold text-[#161311]">Why Accurate Sizing Matters</p>
          <p className="mt-1 leading-relaxed">
            Per GAYRAA policy, general monetary refunds are not applicable. Exchanges are supported
            within 3 days of delivery for size issues or defective items (one exchange per product,
            unused/unwashed with Order ID, customer-arranged return shipping).
          </p>
        </div>
      </div>
    </Drawer>
  );
}
