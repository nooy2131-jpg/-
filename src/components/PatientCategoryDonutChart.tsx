import React, { useState } from 'react';
import { PATIENT_CATEGORIES } from '../types/census';

export interface CategoryCounts {
  cat1: number;
  cat2: number;
  cat3: number;
  cat4: number;
  cat5: number;
}

interface PatientCategoryDonutChartProps {
  counts: CategoryCounts;
  shiftCount?: number; // If > 1, also shows average per shift in legend
  subtitle?: string;
}

export const PatientCategoryDonutChart: React.FC<PatientCategoryDonutChartProps> = ({
  counts,
  shiftCount = 1,
}) => {
  const [hoveredKey, setHoveredKey] = useState<keyof CategoryCounts | null>(null);

  const totalClassified =
    (counts.cat1 || 0) +
    (counts.cat2 || 0) +
    (counts.cat3 || 0) +
    (counts.cat4 || 0) +
    (counts.cat5 || 0);

  // SVG Donut geometry
  const size = 210;
  const center = size / 2;
  const radius = 76;
  const strokeWidth = 26;
  const circumference = 2 * Math.PI * radius;

  // Compute segments
  let cumulativeFraction = 0;
  const segments = PATIENT_CATEGORIES.map((cat) => {
    const value = counts[cat.key] || 0;
    const fraction = totalClassified > 0 ? value / totalClassified : 0;
    const percentage = Math.round(fraction * 1000) / 10;
    const strokeLength = fraction * circumference;
    const strokeOffset = -cumulativeFraction * circumference;
    cumulativeFraction += fraction;

    return {
      ...cat,
      value,
      fraction,
      percentage,
      strokeLength,
      strokeOffset,
    };
  });

  const activeSegment = hoveredKey
    ? segments.find((s) => s.key === hoveredKey) || null
    : null;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6 lg:gap-8">
      {/* SVG Donut Graph */}
      <div className="relative shrink-0 flex items-center justify-center">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="select-none"
          aria-label="กราฟโดนัทแสดงสัดส่วนผู้ป่วยแยกตามประเภท 1 ถึง 5"
        >
          {/* Base background ring */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
          />

          {/* Donut Segments rotated -90deg so they start at 12 o'clock */}
          <g transform={`rotate(-90 ${center} ${center})`}>
            {totalClassified > 0 &&
              segments.map((seg) => {
                if (seg.value <= 0) return null;
                const isHovered = hoveredKey === seg.key;
                const isDimmed = hoveredKey !== null && !isHovered;

                return (
                  <circle
                    key={seg.key}
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="transparent"
                    stroke={seg.colorHex}
                    strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                    strokeDasharray={`${seg.strokeLength} ${Math.max(
                      0,
                      circumference - seg.strokeLength
                    )}`}
                    strokeDashoffset={seg.strokeOffset}
                    strokeLinecap="butt"
                    className={`cursor-pointer transition-opacity duration-150 ${
                      isDimmed ? 'opacity-35' : 'opacity-100'
                    }`}
                    onMouseEnter={() => setHoveredKey(seg.key)}
                    onMouseLeave={() => setHoveredKey(null)}
                  >
                    <title>
                      {seg.label}: {seg.value} ราย ({seg.percentage.toFixed(1)}%)
                    </title>
                  </circle>
                );
              })}
          </g>
        </svg>

        {/* Center Donut Readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-4">
          {activeSegment ? (
            <>
              <span className="text-[11px] font-medium text-slate-500 leading-tight">
                {activeSegment.shortLabel}
              </span>
              <span className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                {activeSegment.value}
              </span>
              <span className="text-xs font-mono tabular-nums font-semibold text-teal-700">
                {activeSegment.percentage.toFixed(1)}%
              </span>
            </>
          ) : (
            <>
              <span className="text-[11px] font-medium text-slate-500">
                รวมจำแนกประเภท
              </span>
              <span className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                {totalClassified}
              </span>
              <span className="text-[11px] text-slate-500">
                ราย (1 น้อยสุด – 5 วิกฤต)
              </span>
            </>
          )}
        </div>
      </div>

      {/* Structured 1-5 Legend Table */}
      <div className="flex-1 w-full space-y-2">
        {segments.map((seg) => {
          const isHovered = hoveredKey === seg.key;
          const avgPerShift =
            shiftCount > 1 ? Math.round((seg.value / shiftCount) * 10) / 10 : null;

          return (
            <div
              key={seg.key}
              onMouseEnter={() => setHoveredKey(seg.key)}
              onMouseLeave={() => setHoveredKey(null)}
              className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg border transition-colors cursor-pointer ${
                isHovered
                  ? 'border-slate-300 bg-slate-50'
                  : 'border-slate-100 bg-white hover:bg-slate-50/70'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="w-3 h-3 rounded-xs shrink-0"
                  style={{ backgroundColor: seg.colorHex }}
                  aria-hidden="true"
                />
                <div className="truncate">
                  <span className="text-xs font-semibold text-slate-900">
                    {seg.label}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 font-mono tabular-nums text-xs shrink-0">
                {avgPerShift !== null && (
                  <span className="text-slate-500 text-[11px] hidden sm:inline">
                    เฉลี่ย {avgPerShift}/เวร
                  </span>
                )}
                <span className="font-bold text-slate-900">
                  {seg.value} ราย
                </span>
                <span className="w-12 text-right text-slate-500">
                  ({seg.percentage.toFixed(1)}%)
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
