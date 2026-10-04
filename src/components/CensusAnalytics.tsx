import React, { useMemo, useState } from 'react';
import {
  CensusRecord,
  PATIENT_CATEGORIES,
  SHIFT_META,
  ShiftType,
} from '../types/census';
import {
  calculateNursingWorkloadHours,
  calculateOccupancyRate,
  formatThaiDate,
  sortRecordsAsc,
} from '../utils/censusUtils';
import { PatientCategoryDonutChart } from './PatientCategoryDonutChart';

interface CensusAnalyticsProps {
  records: CensusRecord[];
  onSelectRecord?: (record: CensusRecord) => void;
}

export const CensusAnalytics: React.FC<CensusAnalyticsProps> = ({
  records,
  onSelectRecord,
}) => {
  const [rangeLimit, setRangeLimit] = useState<number>(15);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const chronological = useMemo(() => {
    const asc = sortRecordsAsc(records);
    return asc.slice(Math.max(0, asc.length - rangeLimit));
  }, [records, rangeLimit]);

  const summaryStats = useMemo(() => {
    if (records.length === 0) {
      return {
        avgOccupancy: 0,
        avgPatients: 0,
        peakPatients: 0,
        totalAdmits: 0,
        totalDischarges: 0,
        totalReferrals: 0,
        avgWorkloadHours: 0,
        catTotals: { cat1: 0, cat2: 0, cat3: 0, cat4: 0, cat5: 0, all: 0 },
        byShift: {
          'ดึก': { count: 0, admits: 0, discharges: 0, referrals: 0, avgPatients: 0 },
          'เช้า': { count: 0, admits: 0, discharges: 0, referrals: 0, avgPatients: 0 },
          'บ่าย': { count: 0, admits: 0, discharges: 0, referrals: 0, avgPatients: 0 },
        },
      };
    }

    let sumOccupancy = 0;
    let sumPatients = 0;
    let peakPatients = 0;
    let totalAdmits = 0;
    let totalDischarges = 0;
    let totalReferrals = 0;
    let sumWorkload = 0;

    const catTotals = { cat1: 0, cat2: 0, cat3: 0, cat4: 0, cat5: 0, all: 0 };
    const byShift: Record<
      ShiftType,
      { count: number; admits: number; discharges: number; referrals: number; sumPatients: number; avgPatients: number }
    > = {
      'ดึก': { count: 0, admits: 0, discharges: 0, referrals: 0, sumPatients: 0, avgPatients: 0 },
      'เช้า': { count: 0, admits: 0, discharges: 0, referrals: 0, sumPatients: 0, avgPatients: 0 },
      'บ่าย': { count: 0, admits: 0, discharges: 0, referrals: 0, sumPatients: 0, avgPatients: 0 },
    };

    for (const r of records) {
      sumOccupancy += calculateOccupancyRate(r.totalPatients, r.capacity);
      sumPatients += r.totalPatients;
      if (r.totalPatients > peakPatients) peakPatients = r.totalPatients;
      totalAdmits += r.newPatients;
      totalDischarges += r.discharges;
      totalReferrals += r.referrals;
      sumWorkload += calculateNursingWorkloadHours(r);

      catTotals.cat1 += r.cat1;
      catTotals.cat2 += r.cat2;
      catTotals.cat3 += r.cat3;
      catTotals.cat4 += r.cat4;
      catTotals.cat5 += r.cat5;
      catTotals.all += r.cat1 + r.cat2 + r.cat3 + r.cat4 + r.cat5;

      const s = byShift[r.shift] || byShift['เช้า'];
      s.count += 1;
      s.admits += r.newPatients;
      s.discharges += r.discharges;
      s.referrals += r.referrals;
      s.sumPatients += r.totalPatients;
    }

    (['ดึก', 'เช้า', 'บ่าย'] as ShiftType[]).forEach((sh) => {
      const item = byShift[sh];
      item.avgPatients = item.count > 0 ? Math.round((item.sumPatients / item.count) * 10) / 10 : 0;
    });

    return {
      avgOccupancy: Math.round((sumOccupancy / records.length) * 10) / 10,
      avgPatients: Math.round((sumPatients / records.length) * 10) / 10,
      peakPatients,
      totalAdmits,
      totalDischarges,
      totalReferrals,
      avgWorkloadHours: Math.round((sumWorkload / records.length) * 10) / 10,
      catTotals,
      byShift,
    };
  }, [records]);

  const activePoint =
    hoveredIndex !== null && chronological[hoveredIndex]
      ? chronological[hoveredIndex]
      : chronological[chronological.length - 1] || null;

  // SVG Chart dimensions
  const chartWidth = 840;
  const chartHeight = 240;
  const padLeft = 42;
  const padRight = 24;
  const padTop = 24;
  const padBottom = 38;
  const innerW = chartWidth - padLeft - padRight;
  const innerH = chartHeight - padTop - padBottom;

  const maxY = useMemo(() => {
    let m = 35;
    for (const r of chronological) {
      if (r.totalPatients > m) m = r.totalPatients + 4;
      if (r.capacity > m) m = r.capacity + 4;
    }
    return m;
  }, [chronological]);

  const getX = (index: number) => {
    if (chronological.length <= 1) return padLeft + innerW / 2;
    return padLeft + (index / (chronological.length - 1)) * innerW;
  };

  const getY = (val: number) => {
    return padTop + innerH - (Math.min(maxY, Math.max(0, val)) / maxY) * innerH;
  };

  const linePath = useMemo(() => {
    if (chronological.length === 0) return '';
    return chronological
      .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx).toFixed(1)} ${getY(pt.totalPatients).toFixed(1)}`)
      .join(' ');
  }, [chronological, maxY]);

  const areaPath = useMemo(() => {
    if (chronological.length === 0) return '';
    const firstX = getX(0).toFixed(1);
    const lastX = getX(chronological.length - 1).toFixed(1);
    const baseY = (padTop + innerH).toFixed(1);
    return `${linePath} L ${lastX} ${baseY} L ${firstX} ${baseY} Z`;
  }, [linePath, chronological]);

  const capacityY = getY(chronological[0]?.capacity || 30);

  return (
    <div className="space-y-8">
      {/* Top KPI Summary Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white border border-slate-200 rounded-lg">
          <div className="text-xs text-slate-500">อัตราการครองเตียงเฉลี่ย</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
              {summaryStats.avgOccupancy.toFixed(1)}%
            </span>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              (เฉลี่ย {summaryStats.avgPatients} ราย/เวร)
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            คำนวณจากทั้งหมด {records.length} เวรที่บันทึก
          </div>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-lg">
          <div className="text-xs text-slate-500">ยอดผู้ป่วยสูงสุด (Peak Census)</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
              {summaryStats.peakPatients}
            </span>
            <span className="text-xs text-slate-500">ราย</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            เทียบศักยภาพเตียงมาตรฐาน 30 เตียง
          </div>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-lg">
          <div className="text-xs text-slate-500">การเคลื่อนไหวสะสม (รับใหม่ / จำหน่าย / ส่งต่อ)</div>
          <div className="mt-2 flex items-baseline gap-2 font-mono tabular-nums">
            <span className="text-2xl font-bold text-teal-700">+{summaryStats.totalAdmits}</span>
            <span className="text-slate-300">/</span>
            <span className="text-xl font-semibold text-slate-800">-{summaryStats.totalDischarges}</span>
            <span className="text-slate-300">/</span>
            <span className="text-lg font-medium text-amber-700">ส่งต่อ {summaryStats.totalReferrals}</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            ยอดรวมทุกเวรในระบบ
          </div>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-lg">
          <div className="text-xs text-slate-500">ภาระงานพยาบาลเฉลี่ยต่อเวร</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
              {summaryStats.avgWorkloadHours}
            </span>
            <span className="text-xs text-slate-500">ชม.การพยาบาล</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            คำนวณตามเกณฑ์ผู้ป่วยประเภท 1–5
          </div>
        </div>
      </div>

      {/* Section 1: Interactive Census Time-Series Chart */}
      <div className="p-6 bg-white border border-slate-200 rounded-lg space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              01. แนวโน้มยอดผู้ป่วยคงเหลือรายเวรเทียบศักยภาพเตียง (Bed Occupancy Trend)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              แสดงการเปลี่ยนแปลงยอดผู้ป่วยคงเหลือ (เส้นทึบสีเขียวอมน้ำเงิน) เทียบจำนวนเตียงทั้งหมด 30 เตียง (เส้นประสีแดง)
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200 self-start">
            {[
              { label: '9 เวรล่าสุด', value: 9 },
              { label: '15 เวรล่าสุด', value: 15 },
              { label: '30 เวรล่าสุด', value: 30 },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRangeLimit(opt.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  rangeLimit === opt.value
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Active Point Readout Strip */}
        {activePoint && (
          <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
            <div className="flex items-center gap-2 text-slate-700">
              <span className="font-semibold text-slate-900">
                {formatThaiDate(activePoint.date, true)}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-medium text-teal-700">
                {SHIFT_META[activePoint.shift]?.label}
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-slate-500 truncate max-w-xs">{activePoint.note || 'ไม่มีหมายเหตุ'}</span>
            </div>
            <div className="flex items-center gap-4 font-mono tabular-nums text-slate-700">
              <span>
                คงเหลือ: <strong className="text-slate-900">{activePoint.totalPatients}</strong>/{activePoint.capacity} เตียง ({calculateOccupancyRate(activePoint.totalPatients, activePoint.capacity)}%)
              </span>
              <span aria-hidden="true">·</span>
              <span>ว่าง: {activePoint.availableBeds}</span>
              <span aria-hidden="true">·</span>
              <span>รับใหม่: +{activePoint.newPatients}</span>
              <span aria-hidden="true">·</span>
              <span>จำหน่าย: -{activePoint.discharges}</span>
            </div>
          </div>
        )}

        {/* SVG Chart */}
        {chronological.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-sm text-slate-500">
            ไม่มีข้อมูลสำหรับแสดงกราฟแนวโน้ม
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full min-w-[640px] h-auto select-none"
            >
              <defs>
                <linearGradient id="censusAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0d9488" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#0d9488" stopOpacity="0.01" />
                </linearGradient>
              </defs>

              {/* Horizontal Grid Lines */}
              {[0, 10, 20, 30].map((tick) => {
                const y = getY(tick);
                return (
                  <g key={tick}>
                    <line
                      x1={padLeft}
                      y1={y}
                      x2={chartWidth - padRight}
                      y2={y}
                      stroke="#e2e8f0"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={padLeft - 8}
                      y={y + 4}
                      textAnchor="end"
                      className="text-[11px] fill-slate-400 font-mono"
                    >
                      {tick}
                    </text>
                  </g>
                );
              })}

              {/* Capacity Threshold Line (30 Beds) */}
              <line
                x1={padLeft}
                y1={capacityY}
                x2={chartWidth - padRight}
                y2={capacityY}
                stroke="#dc2626"
                strokeWidth="1.25"
                strokeDasharray="5 4"
              />
              <text
                x={chartWidth - padRight - 4}
                y={capacityY - 6}
                textAnchor="end"
                className="text-[10px] fill-red-600 font-mono"
              >
                ศักยภาพเตียงสูงสุด ({chronological[0]?.capacity || 30} เตียง)
              </text>

              {/* Area & Line */}
              <path d={areaPath} fill="url(#censusAreaGrad)" />
              <path
                d={linePath}
                fill="none"
                stroke="#0d9488"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Data Points */}
              {chronological.map((pt, idx) => {
                const cx = getX(idx);
                const cy = getY(pt.totalPatients);
                const isHovered = hoveredIndex === idx;
                return (
                  <g
                    key={pt.id}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onClick={() => onSelectRecord && onSelectRecord(pt)}
                  >
                    {isHovered && (
                      <line
                        x1={cx}
                        y1={padTop}
                        x2={cx}
                        y2={padTop + innerH}
                        stroke="#0d9488"
                        strokeWidth="1"
                        strokeDasharray="2 2"
                      />
                    )}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isHovered ? 6 : 4}
                      fill={pt.totalPatients >= pt.capacity ? '#dc2626' : '#0d9488'}
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                    <text
                      x={cx}
                      y={cy - 10}
                      textAnchor="middle"
                      className="text-[10px] font-mono fill-slate-700 font-semibold"
                    >
                      {pt.totalPatients}
                    </text>
                    {/* X-Axis label */}
                    <text
                      x={cx}
                      y={chartHeight - 18}
                      textAnchor="middle"
                      className="text-[10px] fill-slate-500 font-mono"
                    >
                      {pt.date.slice(8)}/{pt.date.slice(5, 7)}
                    </text>
                    <text
                      x={cx}
                      y={chartHeight - 6}
                      textAnchor="middle"
                      className="text-[10px] fill-slate-400"
                    >
                      {pt.shift}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </div>

      {/* Section 2: Patient Classification Breakdown & Shift Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Patient Acuity Categories 1-5 Donut Graph */}
        <div className="lg:col-span-7 p-6 bg-white border border-slate-200 rounded-lg space-y-5">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              02. กราฟโดนัทสัดส่วนประเภทผู้ป่วย (1 อาการน้อยสุด – 5 วิกฤต)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              สะท้อนโครงสร้างความรุนแรงของผู้ป่วยและความต้องการอัตรากำลังพยาบาลของตึกผู้ป่วยใน
            </p>
          </div>

          <PatientCategoryDonutChart
            counts={{
              cat1: summaryStats.catTotals.cat1,
              cat2: summaryStats.catTotals.cat2,
              cat3: summaryStats.catTotals.cat3,
              cat4: summaryStats.catTotals.cat4,
              cat5: summaryStats.catTotals.cat5,
            }}
            shiftCount={records.length}
          />
        </div>

        {/* Right: Shift Movement Comparison Table */}
        <div className="lg:col-span-5 p-6 bg-white border border-slate-200 rounded-lg space-y-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              03. เปรียบเทียบปริมาณงานแยกตามเวร
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              ยอดผู้ป่วยเฉลี่ยและการเคลื่อนไหวแยกตามเวรดึก · เวรเช้า · เวรบ่าย
            </p>
          </div>

          <div className="overflow-x-auto pt-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-2.5 font-medium">เวรปฏิบัติงาน</th>
                  <th className="py-2.5 font-medium text-right">เฉลี่ยคงเหลือ</th>
                  <th className="py-2.5 font-medium text-right">รับใหม่รวม</th>
                  <th className="py-2.5 font-medium text-right">จำหน่ายรวม</th>
                  <th className="py-2.5 font-medium text-right">ส่งต่อรวม</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {(['ดึก', 'เช้า', 'บ่าย'] as ShiftType[]).map((sh) => {
                  const row = summaryStats.byShift[sh];
                  return (
                    <tr key={sh} className="hover:bg-slate-50">
                      <td className="py-3 font-medium text-slate-900">
                        <div>{SHIFT_META[sh].label}</div>
                        <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                          {row.count} เวรที่บันทึก
                        </div>
                      </td>
                      <td className="py-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {row.avgPatients} ราย
                      </td>
                      <td className="py-3 text-right font-mono tabular-nums text-teal-700 font-medium">
                        +{row.admits}
                      </td>
                      <td className="py-3 text-right font-mono tabular-nums text-slate-700">
                        -{row.discharges}
                      </td>
                      <td className="py-3 text-right font-mono tabular-nums text-amber-700">
                        {row.referrals}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
