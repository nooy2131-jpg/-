import React, { useState } from 'react';
import {
  Check,
  Copy,
  Edit3,
  MessageSquareText,
  Plus,
} from 'lucide-react';
import {
  CensusRecord,
  SHIFT_META,
} from '../types/census';
import {
  calculateNursingWorkloadHours,
  calculateOccupancyRate,
  copyTextToClipboard,
  formatThaiDate,
  formatUpdatedAt,
  generateLineShiftSummary,
  getOccupancyStatus,
} from '../utils/censusUtils';
import { PatientCategoryDonutChart } from './PatientCategoryDonutChart';

interface LatestShiftOverviewProps {
  records: CensusRecord[];
  selectedRecord: CensusRecord | null;
  onSelectRecord: (record: CensusRecord) => void;
  onEditRecord: (record: CensusRecord) => void;
  onCreateNew: () => void;
  onOpenLineGenerator?: (record: CensusRecord) => void;
}

export const LatestShiftOverview: React.FC<LatestShiftOverviewProps> = ({
  records,
  selectedRecord,
  onSelectRecord,
  onEditRecord,
  onCreateNew,
  onOpenLineGenerator,
}) => {
  const [copiedSummary, setCopiedSummary] = useState(false);

  const active = selectedRecord || records[0] || null;

  if (!active) {
    return (
      <div className="p-10 bg-white border border-slate-200 rounded-lg text-center space-y-3">
        <h2 className="text-base font-semibold text-slate-900">
          ยังไม่มีข้อมูลรายงานยอดผู้ป่วยในระบบ
        </h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          เริ่มต้นบันทึกยอดผู้ป่วยประจำเวรเช้า เวรบ่าย หรือเวรดึกของตึกผู้ป่วยใน โรงพยาบาลองครักษ์ เพื่อแสดงผลกราฟโดนัทสรุปประเภทผู้ป่วย (1 อาการน้อยสุด – 5 วิกฤต) และสร้างข้อความส่ง LINE Group
        </p>
        <div className="pt-2">
          <button
            type="button"
            onClick={onCreateNew}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>บันทึกยอดผู้ป่วยเวรแรก</span>
          </button>
        </div>
      </div>
    );
  }

  const occRate = calculateOccupancyRate(active.totalPatients, active.capacity);
  const occStatus = getOccupancyStatus(active.totalPatients, active.capacity);
  const workloadHours = calculateNursingWorkloadHours(active);
  const recentShifts = records.slice(0, 6);

  const handleCopyLine = async () => {
    const ok = await copyTextToClipboard(generateLineShiftSummary(active));
    if (ok) {
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2200);
    }
  };

  // Build visual bed slots array for the ward bed map (ordered from Cat 5 critical down to Cat 1 minimal)
  const totalSlots = Math.max(active.capacity, active.totalPatients);
  const bedSlots: Array<{
    index: number;
    status: 'cat5' | 'cat4' | 'cat3' | 'cat2' | 'cat1' | 'occupied' | 'empty';
  }> = [];
  let c5 = active.cat5;
  let c4 = active.cat4;
  let c3 = active.cat3;
  let c2 = active.cat2;
  let c1 = active.cat1;
  let remOccupied = active.totalPatients;

  for (let i = 1; i <= totalSlots; i++) {
    if (remOccupied > 0) {
      remOccupied--;
      if (c5 > 0) {
        c5--;
        bedSlots.push({ index: i, status: 'cat5' });
      } else if (c4 > 0) {
        c4--;
        bedSlots.push({ index: i, status: 'cat4' });
      } else if (c3 > 0) {
        c3--;
        bedSlots.push({ index: i, status: 'cat3' });
      } else if (c2 > 0) {
        c2--;
        bedSlots.push({ index: i, status: 'cat2' });
      } else if (c1 > 0) {
        c1--;
        bedSlots.push({ index: i, status: 'cat1' });
      } else {
        bedSlots.push({ index: i, status: 'occupied' });
      }
    } else {
      bedSlots.push({ index: i, status: 'empty' });
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg">
      {/* Top Bar of Overview: Recent Shift Selector & Quick Actions */}
      <div className="px-6 py-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>ตึกผู้ป่วยใน (IPD)</span>
            <span aria-hidden="true">·</span>
            <span>วันที่ {formatThaiDate(active.date, true)}</span>
            <span aria-hidden="true">·</span>
            <span className="font-semibold text-teal-700">
              {SHIFT_META[active.shift]?.label} ({SHIFT_META[active.shift]?.timeRange})
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              แก้ไขล่าสุด {formatUpdatedAt(active.updatedAt, true)}
            </span>
          </div>
          <h2 className="text-lg font-semibold text-slate-900">
            สรุปสถานะยอดผู้ป่วยในและสัดส่วนประเภทผู้ป่วยประจำเวร
          </h2>
        </div>

        {/* Interactive Shift Switcher & Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {recentShifts.length > 1 && (
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200 overflow-x-auto max-w-full">
              {recentShifts.map((r) => {
                const isSelected = r.id === active.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => onSelectRecord(r)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      isSelected
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span className="font-mono tabular-nums">
                      {r.date.slice(8)}/{r.date.slice(5, 7)}
                    </span>{' '}
                    <span>{r.shift}</span>
                  </button>
                );
              })}
            </div>
          )}

          {onOpenLineGenerator && (
            <button
              type="button"
              onClick={() => onOpenLineGenerator(active)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors whitespace-nowrap cursor-pointer"
            >
              <MessageSquareText className="w-3.5 h-3.5 text-teal-600" />
              <span>ปรับแต่งข้อความ LINE</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopyLine}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              copiedSummary
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-900 hover:bg-slate-800 text-white'
            }`}
          >
            {copiedSummary ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>คัดลอกลง Clipboard แล้ว</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>คัดลอกส่ง LINE Group</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => onEditRecord(active)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>แก้ไขเวรนี้</span>
          </button>
        </div>
      </div>

      {/* Main 4-Column Metric Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-200 border-b border-slate-200">
        {/* Metric 1: Total Patients & Capacity */}
        <div className="p-6 space-y-2">
          <div className="text-xs font-medium text-slate-500">
            จำนวนผู้ป่วยทั้งหมดในเวร (Total Patients)
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono tabular-nums text-slate-900">
              {active.totalPatients}
            </span>
            <span className="text-sm text-slate-500 font-mono tabular-nums">
              / {active.capacity} เตียง
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs pt-1">
            <span
              className={`font-mono tabular-nums font-semibold ${
                occStatus.level === 'critical'
                  ? 'text-red-600'
                  : occStatus.level === 'warning'
                  ? 'text-amber-600'
                  : 'text-teal-700'
              }`}
            >
              ครองเตียง {occRate.toFixed(1)}%
            </span>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <span className="text-slate-600">{occStatus.label}</span>
          </div>
        </div>

        {/* Metric 2: Available Beds */}
        <div className="p-6 space-y-2">
          <div className="text-xs font-medium text-slate-500">
            เตียงว่างพร้อมรับ (Available Beds)
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-3xl font-bold font-mono tabular-nums ${
                active.availableBeds === 0 ? 'text-red-600' : 'text-teal-700'
              }`}
            >
              {active.availableBeds}
            </span>
            <span className="text-sm text-slate-500">เตียงว่าง</span>
          </div>
          <div className="text-xs text-slate-500 pt-1">
            {active.totalPatients > active.capacity
              ? `เปิดเตียงเสริมเกินศักยภาพ +${active.totalPatients - active.capacity} เตียง`
              : `รองรับผู้ป่วยรับใหม่ได้อีก ${active.availableBeds} เตียง`}
          </div>
        </div>

        {/* Metric 3: Shift Patient Movement */}
        <div className="p-6 space-y-2">
          <div className="text-xs font-medium text-slate-500">
            การเคลื่อนไหวในเวร (รับใหม่ · จำหน่าย · ส่งต่อ)
          </div>
          <div className="grid grid-cols-3 gap-2 pt-1 font-mono tabular-nums">
            <div>
              <div className="text-2xl font-bold text-teal-700">
                +{active.newPatients}
              </div>
              <div className="text-[11px] font-sans text-slate-500">รับใหม่ (Admit)</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">
                -{active.discharges}
              </div>
              <div className="text-[11px] font-sans text-slate-500">จำหน่าย (D/C)</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-700">
                {active.referrals}
              </div>
              <div className="text-[11px] font-sans text-slate-500">ส่งต่อ (Refer)</div>
            </div>
          </div>
        </div>

        {/* Metric 4: High Acuity Patients (Cat 4 & Cat 5) */}
        <div className="p-6 space-y-2">
          <div className="text-xs font-medium text-slate-500">
            ผู้ป่วยเฝ้าระวังสูง (ประเภท 4 และ 5)
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono tabular-nums text-slate-900">
              {active.cat4 + active.cat5}
            </span>
            <span className="text-sm text-slate-500">
              ราย (วิกฤต {active.cat5} · กึ่งวิกฤต {active.cat4})
            </span>
          </div>
          <div className="text-xs text-slate-500 pt-1 font-mono tabular-nums">
            ภาระงานพยาบาลประมาณการ {workloadHours} ชม./วัน
          </div>
        </div>
      </div>

      {/* Bottom Split: Donut Graph for Categories 1-5 & Visual 30-Bed Ward Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
        {/* Left 7 Cols: Donut Chart for Patient Categories 1-5 */}
        <div className="lg:col-span-7 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                กราฟโดนัทแสดงสัดส่วนประเภทผู้ป่วย (1 อาการน้อยสุด – 5 วิกฤต)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                ชี้ที่ส่วนของกราฟหรือรายการด้านขวาเพื่อดูจำนวนและสัดส่วนรายประเภท
              </p>
            </div>
          </div>

          <PatientCategoryDonutChart
            counts={{
              cat1: active.cat1,
              cat2: active.cat2,
              cat3: active.cat3,
              cat4: active.cat4,
              cat5: active.cat5,
            }}
          />

          {active.note && (
            <div className="pt-3 border-t border-slate-100 flex items-start gap-2 text-xs text-slate-700">
              <span className="font-semibold text-slate-900 shrink-0">หมายเหตุเวร:</span>
              <span>{active.note}</span>
            </div>
          )}
        </div>

        {/* Right 5 Cols: Visual 30-Bed Ward Occupancy Map */}
        <div className="lg:col-span-5 p-6 space-y-3 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                ผังจำลองสถานะเตียงผู้ป่วยใน ({active.capacity} เตียง)
              </h3>
              <div className="flex items-center gap-3 text-[11px] text-slate-500">
                <span>ครองเตียง {active.totalPatients}</span>
                <span>·</span>
                <span>ว่าง {active.availableBeds}</span>
              </div>
            </div>

            <div className="grid grid-cols-10 gap-1.5 pt-1">
              {bedSlots.map((slot) => {
                const colorClass =
                  slot.status === 'cat5'
                    ? 'bg-red-600 text-white border-red-700'
                    : slot.status === 'cat4'
                    ? 'bg-amber-500 text-white border-amber-600'
                    : slot.status === 'cat3'
                    ? 'bg-teal-600 text-white border-teal-700'
                    : slot.status === 'cat2'
                    ? 'bg-sky-600 text-white border-sky-700'
                    : slot.status === 'cat1' || slot.status === 'occupied'
                    ? 'bg-emerald-600 text-white border-emerald-700'
                    : 'bg-slate-100 text-slate-400 border-slate-200';

                const statusLabelMap: Record<typeof slot.status, string> = {
                  cat1: 'ประเภท 1 (อาการน้อยสุด)',
                  cat2: 'ประเภท 2 (อาการน้อย)',
                  cat3: 'ประเภท 3 (อาการปานกลาง)',
                  cat4: 'ประเภท 4 (อาการหนัก/กึ่งวิกฤต)',
                  cat5: 'ประเภท 5 (วิกฤต/หนักมาก)',
                  occupied: 'มีผู้ป่วยครองเตียง',
                  empty: 'เตียงว่าง',
                };

                return (
                  <div
                    key={slot.index}
                    title={`เตียงที่ ${slot.index}: ${statusLabelMap[slot.status]}`}
                    className={`h-7 rounded flex items-center justify-center font-mono tabular-nums text-[11px] font-medium border ${colorClass}`}
                  >
                    {slot.index}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 pt-3 border-t border-slate-100">
            <span>สีเขียว: ป.1 (น้อยสุด)</span>
            <span>·</span>
            <span>สีฟ้า: ป.2 (น้อย)</span>
            <span>·</span>
            <span>สีเขียวน้ำทะเล: ป.3 (ปานกลาง)</span>
            <span>·</span>
            <span>สีส้ม: ป.4 (กึ่งวิกฤต)</span>
            <span>·</span>
            <span>สีแดง: ป.5 (วิกฤต)</span>
            <span>·</span>
            <span>สีเทาอ่อน: เตียงว่าง</span>
          </div>
        </div>
      </div>
    </div>
  );
};
