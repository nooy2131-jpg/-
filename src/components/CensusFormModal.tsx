import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calculator,
  Check,
  Copy,
  MessageSquareText,
  RefreshCw,
  Save,
  X,
} from 'lucide-react';
import {
  CensusRecord,
  DEFAULT_WARD_CAPACITY,
  PATIENT_CATEGORIES,
  SHIFT_META,
  ShiftType,
} from '../types/census';
import {
  calculateNursingWorkloadHours,
  calculateOccupancyRate,
  copyTextToClipboard,
  formatThaiDate,
  generateLineShiftSummary,
  getOccupancyStatus,
  getTodayDateString,
  sortRecordsDesc,
} from '../utils/censusUtils';

interface CensusFormProps {
  initialRecord?: CensusRecord | null;
  allRecords: CensusRecord[];
  onSave: (record: CensusRecord) => Promise<void>;
  onCancel?: () => void;
  isModal?: boolean;
  isSubmitting?: boolean;
}

const SHIFTS: ShiftType[] = ['ดึก', 'เช้า', 'บ่าย'];

function makeShiftId(date: string, shift: ShiftType): string {
  const code = SHIFT_META[shift]?.shortCode || 'M';
  return `REC-${date.replace(/-/g, '')}-${code}`;
}

export const CensusForm: React.FC<CensusFormProps> = ({
  initialRecord,
  allRecords,
  onSave,
  onCancel,
  isModal = false,
  isSubmitting = false,
}) => {
  const isEditing = Boolean(initialRecord);

  const [date, setDate] = useState<string>(initialRecord?.date || getTodayDateString(0));
  const [shift, setShift] = useState<ShiftType>(initialRecord?.shift || 'เช้า');
  const [capacity, setCapacity] = useState<number>(
    initialRecord?.capacity ?? DEFAULT_WARD_CAPACITY
  );
  const [totalPatients, setTotalPatients] = useState<number>(
    initialRecord?.totalPatients ?? 0
  );
  const [availableBeds, setAvailableBeds] = useState<number>(
    initialRecord?.availableBeds ?? DEFAULT_WARD_CAPACITY
  );
  const [autoCalcAvailable, setAutoCalcAvailable] = useState<boolean>(true);

  const [newPatients, setNewPatients] = useState<number>(initialRecord?.newPatients ?? 0);
  const [discharges, setDischarges] = useState<number>(initialRecord?.discharges ?? 0);
  const [referrals, setReferrals] = useState<number>(initialRecord?.referrals ?? 0);

  const [cat1, setCat1] = useState<number>(initialRecord?.cat1 ?? 0);
  const [cat2, setCat2] = useState<number>(initialRecord?.cat2 ?? 0);
  const [cat3, setCat3] = useState<number>(initialRecord?.cat3 ?? 0);
  const [cat4, setCat4] = useState<number>(initialRecord?.cat4 ?? 0);
  const [cat5, setCat5] = useState<number>(initialRecord?.cat5 ?? 0);
  const [note, setNote] = useState<string>(initialRecord?.note ?? '');
  const [formError, setFormError] = useState<string | null>(null);
  const [copiedLivePreview, setCopiedLivePreview] = useState<boolean>(false);

  useEffect(() => {
    if (initialRecord) {
      setDate(initialRecord.date);
      setShift(initialRecord.shift);
      setCapacity(initialRecord.capacity || DEFAULT_WARD_CAPACITY);
      setTotalPatients(initialRecord.totalPatients);
      setAvailableBeds(initialRecord.availableBeds);
      setNewPatients(initialRecord.newPatients);
      setDischarges(initialRecord.discharges);
      setReferrals(initialRecord.referrals);
      setCat1(initialRecord.cat1);
      setCat2(initialRecord.cat2);
      setCat3(initialRecord.cat3);
      setCat4(initialRecord.cat4);
      setCat5(initialRecord.cat5);
      setNote(initialRecord.note || '');
      const expectedAvail = Math.max(
        0,
        (initialRecord.capacity || DEFAULT_WARD_CAPACITY) - initialRecord.totalPatients
      );
      setAutoCalcAvailable(initialRecord.availableBeds === expectedAvail);
    }
  }, [initialRecord]);

  useEffect(() => {
    if (autoCalcAvailable) {
      setAvailableBeds(Math.max(0, capacity - totalPatients));
    }
  }, [capacity, totalPatients, autoCalcAvailable]);

  // Check if there is an existing record for the selected date & shift
  const duplicateRecord = useMemo(() => {
    if (isEditing) return null;
    return allRecords.find((r) => r.date === date && r.shift === shift) || null;
  }, [allRecords, date, shift, isEditing]);

  // Find the most recent previous shift record to assist handover math
  const previousShiftRecord = useMemo(() => {
    const sorted = sortRecordsDesc(allRecords);
    return (
      sorted.find((r) => {
        if (initialRecord && r.id === initialRecord.id) return false;
        if (r.date < date) return true;
        if (r.date === date && r.shift !== shift) return true;
        return false;
      }) || null
    );
  }, [allRecords, date, shift, initialRecord]);

  const expectedFromPrevShift = useMemo(() => {
    if (!previousShiftRecord) return null;
    return Math.max(
      0,
      previousShiftRecord.totalPatients + newPatients - discharges - referrals
    );
  }, [previousShiftRecord, newPatients, discharges, referrals]);

  const categorySum = cat1 + cat2 + cat3 + cat4 + cat5;
  const catDiff = totalPatients - categorySum;
  const occupancyRate = calculateOccupancyRate(totalPatients, capacity);
  const occupancyStatus = getOccupancyStatus(totalPatients, capacity);
  const workloadHours = calculateNursingWorkloadHours({ cat1, cat2, cat3, cat4, cat5 });

  // Live draft record for LINE summary preview
  const draftRecord: CensusRecord = useMemo(
    () => ({
      id: initialRecord?.id || duplicateRecord?.id || makeShiftId(date, shift),
      date,
      shift,
      totalPatients: Math.max(0, Number(totalPatients) || 0),
      capacity: Math.max(1, Number(capacity) || DEFAULT_WARD_CAPACITY),
      availableBeds: Math.max(0, Number(availableBeds) || 0),
      newPatients: Math.max(0, Number(newPatients) || 0),
      discharges: Math.max(0, Number(discharges) || 0),
      referrals: Math.max(0, Number(referrals) || 0),
      cat1: Math.max(0, Number(cat1) || 0),
      cat2: Math.max(0, Number(cat2) || 0),
      cat3: Math.max(0, Number(cat3) || 0),
      cat4: Math.max(0, Number(cat4) || 0),
      cat5: Math.max(0, Number(cat5) || 0),
      note: note.trim(),
      updatedAt: new Date().toISOString(),
    }),
    [
      initialRecord,
      duplicateRecord,
      date,
      shift,
      totalPatients,
      capacity,
      availableBeds,
      newPatients,
      discharges,
      referrals,
      cat1,
      cat2,
      cat3,
      cat4,
      cat5,
      note,
    ]
  );

  const liveLineText = useMemo(
    () => generateLineShiftSummary(draftRecord),
    [draftRecord]
  );

  const handleCopyLiveLine = async () => {
    const ok = await copyTextToClipboard(liveLineText);
    if (ok) {
      setCopiedLivePreview(true);
      setTimeout(() => setCopiedLivePreview(false), 2200);
    }
  };

  const handleLoadDuplicateForEdit = () => {
    if (!duplicateRecord) return;
    setCapacity(duplicateRecord.capacity);
    setTotalPatients(duplicateRecord.totalPatients);
    setAvailableBeds(duplicateRecord.availableBeds);
    setNewPatients(duplicateRecord.newPatients);
    setDischarges(duplicateRecord.discharges);
    setReferrals(duplicateRecord.referrals);
    setCat1(duplicateRecord.cat1);
    setCat2(duplicateRecord.cat2);
    setCat3(duplicateRecord.cat3);
    setCat4(duplicateRecord.cat4);
    setCat5(duplicateRecord.cat5);
    setNote(duplicateRecord.note);
  };

  const handleApplyPreviousHandover = () => {
    if (!previousShiftRecord) return;
    const nextTotal = Math.max(
      0,
      previousShiftRecord.totalPatients + newPatients - discharges - referrals
    );
    setTotalPatients(nextTotal);
    if (categorySum === 0) {
      setCat1(previousShiftRecord.cat1);
      setCat2(previousShiftRecord.cat2);
      setCat3(previousShiftRecord.cat3);
      setCat4(previousShiftRecord.cat4);
      setCat5(previousShiftRecord.cat5);
    }
  };

  const handleSyncTotalToCategories = () => {
    setTotalPatients(categorySum);
  };

  const handleBalanceCategory3Or5 = () => {
    if (catDiff === 0) return;
    const nextCat3 = Math.max(0, cat3 + catDiff);
    setCat3(nextCat3);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!date) {
      setFormError('กรุณาระบุวันที่รายงาน');
      return;
    }

    await onSave(draftRecord);
  };

  const renderNumberStepper = (
    label: string,
    sublabel: string,
    value: number,
    onChange: (val: number) => void,
    min = 0
  ) => (
    <div className="flex flex-col justify-between py-2.5 border-b border-slate-200 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-slate-900">{label}</div>
          <div className="text-xs text-slate-500">{sublabel}</div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onChange(Math.max(min, value - 1))}
            className="w-8 h-8 flex items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 active:bg-slate-200 font-mono text-sm transition-colors cursor-pointer"
            aria-label={`ลด ${label}`}
          >
            -
          </button>
          <input
            type="number"
            min={min}
            value={value}
            onChange={(e) => onChange(Math.max(min, parseInt(e.target.value, 10) || 0))}
            className="w-16 h-8 text-center rounded-md border border-slate-300 bg-white font-mono tabular-nums text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-transparent"
          />
          <button
            type="button"
            onClick={() => onChange(value + 1)}
            className="w-8 h-8 flex items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 active:bg-slate-200 font-mono text-sm transition-colors cursor-pointer"
            aria-label={`เพิ่ม ${label}`}
          >
            +
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {isModal && (
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {isEditing ? 'แก้ไขข้อมูลรายงานยอดผู้ป่วย' : 'บันทึกยอดผู้ป่วยประจำเวร'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              ตึกผู้ป่วยใน โรงพยาบาลองครักษ์ · อัปเดตข้อมูลล่าสุดแบบเรียลไทม์
            </p>
          </div>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="ปิดหน้าต่าง"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      )}

      {formError && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      {/* Duplicate Shift Notice */}
      {duplicateRecord && (
        <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">
                มีข้อมูลของวันที่ {formatThaiDate(date)} ({SHIFT_META[shift].label}) อยู่แล้ว
              </span>
              <span className="block text-amber-800 mt-0.5">
                ยอดคงเหลือเดิม {duplicateRecord.totalPatients} ราย · เมื่อกดบันทึก ระบบจะอัปเดตเป็นข้อมูลแก้ไขล่าสุดทันที
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLoadDuplicateForEdit}
            className="px-3 py-1.5 rounded-md bg-amber-700 text-white font-medium text-xs hover:bg-amber-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            ดึงข้อมูลเดิมมาแก้ไข
          </button>
        </div>
      )}

      {/* Section 1: Date & Shift Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-slate-200">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-2">
            วันที่รายงาน (Date)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="flex-1 h-10 px-3 rounded-lg border border-slate-300 bg-white font-mono tabular-nums text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
              required
            />
            <button
              type="button"
              onClick={() => setDate(getTodayDateString(0))}
              className="h-10 px-3 rounded-lg border border-slate-200 bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 transition-colors whitespace-nowrap cursor-pointer"
            >
              วันนี้
            </button>
            <button
              type="button"
              onClick={() => setDate(getTodayDateString(-1))}
              className="h-10 px-3 rounded-lg border border-slate-200 bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 transition-colors whitespace-nowrap cursor-pointer"
            >
              เมื่อวาน
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-1.5">
            วันที่แสดงผล: <span className="font-medium text-slate-700">{formatThaiDate(date, true)}</span>
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-2">
            เวรปฏิบัติงาน (Shift)
          </label>
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200">
            {SHIFTS.map((s) => {
              const active = shift === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setShift(s)}
                  className={`py-2 px-3 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <div>{SHIFT_META[s].label}</div>
                  <div
                    className={`text-[11px] font-mono tabular-nums ${
                      active ? 'text-teal-100' : 'text-slate-500'
                    }`}
                  >
                    {SHIFT_META[s].timeRange}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Section 2: Patient Movement & Bed Totals */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-6 border-b border-slate-200">
        {/* Left: Shift Movement (Admit, Discharge, Refer) */}
        <div className="lg:col-span-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">
              01. การเคลื่อนไหวผู้ป่วยในเวร (Shift Flow)
            </h3>
            {previousShiftRecord && (
              <span className="text-xs text-slate-500 font-mono tabular-nums">
                เวรก่อนหน้า ({SHIFT_META[previousShiftRecord.shift].label}): {previousShiftRecord.totalPatients} ราย
              </span>
            )}
          </div>

          <div className="divide-y divide-slate-200 border-t border-b border-slate-200">
            {renderNumberStepper(
              'ผู้ป่วยรับใหม่ (New Admissions)',
              'ผู้ป่วยรับใหม่ในเวรจาก ER / OPD / ย้ายหอผู้ป่วย',
              newPatients,
              setNewPatients
            )}
            {renderNumberStepper(
              'จำหน่าย (Discharges)',
              'ผู้ป่วยแพทย์อนุญาตให้กลับบ้าน / จำหน่ายในเวร',
              discharges,
              setDischarges
            )}
            {renderNumberStepper(
              'ส่งต่อ (Referrals)',
              'ผู้ป่วยส่งรักษาต่อโรงพยาบาลอื่น (Refer Out)',
              referrals,
              setReferrals
            )}
          </div>

          {previousShiftRecord && expectedFromPrevShift !== null && (
            <div className="flex items-center justify-between pt-1 text-xs text-slate-600">
              <span>
                คำนวณจากเวรก่อน: {previousShiftRecord.totalPatients} + {newPatients} - {discharges} - {referrals} ={' '}
                <strong className="font-mono tabular-nums text-slate-900">{expectedFromPrevShift} ราย</strong>
              </span>
              <button
                type="button"
                onClick={handleApplyPreviousHandover}
                className="inline-flex items-center gap-1 text-teal-700 hover:text-teal-800 font-medium underline underline-offset-4 cursor-pointer whitespace-nowrap"
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>ใช้ยอดคำนวณนี้ ({expectedFromPrevShift})</span>
              </button>
            </div>
          )}
        </div>

        {/* Right: Bed Census Summary */}
        <div className="lg:col-span-6 space-y-4 lg:pl-6 lg:border-l lg:border-slate-200">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">
              02. จำนวนผู้ป่วยทั้งหมดและศักยภาพเตียง
            </h3>
            <span className="text-xs font-mono tabular-nums text-slate-600">
              อัตราครองเตียง {occupancyRate.toFixed(1)}% · {occupancyStatus.label}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                จำนวนผู้ป่วยทั้งหมด (ราย)
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setTotalPatients(Math.max(0, totalPatients - 1))}
                  className="w-9 h-10 flex items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 font-mono cursor-pointer"
                >
                  -
                </button>
                <input
                  type="number"
                  min={0}
                  value={totalPatients}
                  onChange={(e) =>
                    setTotalPatients(Math.max(0, parseInt(e.target.value, 10) || 0))
                  }
                  className="w-full h-10 text-center rounded-lg border border-teal-600 bg-teal-50/40 font-mono tabular-nums text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
                <button
                  type="button"
                  onClick={() => setTotalPatients(totalPatients + 1)}
                  className="w-9 h-10 flex items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 font-mono cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                เตียงทั้งหมด (Capacity)
              </label>
              <input
                type="number"
                min={1}
                value={capacity}
                onChange={(e) =>
                  setCapacity(Math.max(1, parseInt(e.target.value, 10) || DEFAULT_WARD_CAPACITY))
                }
                className="w-full h-10 px-3 text-center rounded-lg border border-slate-300 bg-white font-mono tabular-nums text-base font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-600">
                  เตียงว่าง (Available)
                </label>
                <button
                  type="button"
                  onClick={() => setAutoCalcAvailable(!autoCalcAvailable)}
                  className="text-[11px] text-teal-700 hover:underline cursor-pointer"
                >
                  {autoCalcAvailable ? 'คำนวณอัตโนมัติ' : 'กำหนดเอง'}
                </button>
              </div>
              <input
                type="number"
                min={0}
                value={availableBeds}
                readOnly={autoCalcAvailable}
                onChange={(e) => {
                  setAutoCalcAvailable(false);
                  setAvailableBeds(Math.max(0, parseInt(e.target.value, 10) || 0));
                }}
                className={`w-full h-10 px-3 text-center rounded-lg border font-mono tabular-nums text-base font-semibold focus:outline-none ${
                  autoCalcAvailable
                    ? 'border-slate-200 bg-slate-100 text-slate-700'
                    : 'border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-teal-600'
                }`}
              />
            </div>
          </div>

          <div className="pt-2">
            <div className="flex items-center justify-between text-xs text-slate-600 mb-1.5">
              <span>สัดส่วนการครองเตียง ({totalPatients} / {capacity} เตียง)</span>
              <span className="font-mono tabular-nums font-medium">
                {totalPatients > capacity
                  ? `เตียงเสริม +${totalPatients - capacity} เตียง`
                  : `ว่าง ${availableBeds} เตียง`}
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-150 ${
                  occupancyStatus.level === 'critical'
                    ? 'bg-red-600'
                    : occupancyStatus.level === 'warning'
                    ? 'bg-amber-500'
                    : 'bg-teal-600'
                }`}
                style={{ width: `${Math.min(100, occupancyRate)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Patient Classification Categories (Cat 1 - Cat 5) */}
      <div className="space-y-4 pb-6 border-b border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              03. สรุปแยกประเภทผู้ป่วย 1–5 (1 อาการน้อยสุด – 5 วิกฤต)
            </h3>
            <p className="text-xs text-slate-500">
              ระบุจำนวนผู้ป่วยเรียงตามระดับความรุนแรงจากน้อยสุดไปถึงวิกฤต (ภาระงานรวมประมาณ{' '}
              <span className="font-mono tabular-nums font-medium text-slate-700">
                {workloadHours} ชม.การพยาบาล/วัน
              </span>
              )
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="font-mono tabular-nums text-slate-700">
              ผลรวมประเภท 1–5: <strong>{categorySum}</strong> / {totalPatients} ราย
            </span>
            {catDiff !== 0 ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSyncTotalToCategories}
                  className="px-2.5 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-medium transition-colors whitespace-nowrap cursor-pointer"
                >
                  ปรับยอดรวมเป็น {categorySum}
                </button>
                <button
                  type="button"
                  onClick={handleBalanceCategory3Or5}
                  className="px-2.5 py-1 rounded-md bg-teal-600 hover:bg-teal-700 text-white font-medium transition-colors whitespace-nowrap cursor-pointer"
                >
                  ดุลยอดเข้าประเภท 3 ({catDiff > 0 ? `+${catDiff}` : catDiff})
                </button>
              </div>
            ) : (
              <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                <Check className="w-3.5 h-3.5" />
                ยอดตรงกัน
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {PATIENT_CATEGORIES.map((cat) => {
            const valMap = { cat1, cat2, cat3, cat4, cat5 };
            const setMap = {
              cat1: setCat1,
              cat2: setCat2,
              cat3: setCat3,
              cat4: setCat4,
              cat5: setCat5,
            };
            const val = valMap[cat.key];
            const setVal = setMap[cat.key];

            return (
              <div
                key={cat.key}
                className="p-3.5 rounded-lg border border-slate-200 bg-white flex flex-col justify-between gap-3"
                style={{ borderTopWidth: '3px', borderTopColor: cat.colorHex }}
              >
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-semibold text-slate-900">
                      {cat.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    {cat.description}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setVal(Math.max(0, val - 1))}
                    className="w-8 h-8 flex items-center justify-center rounded-md border border-slate-300 bg-slate-50 hover:bg-slate-100 font-mono text-sm text-slate-700 cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={0}
                    value={val}
                    onChange={(e) => setVal(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-14 h-8 text-center font-mono tabular-nums text-sm font-bold text-slate-900 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                  <button
                    type="button"
                    onClick={() => setVal(val + 1)}
                    className="w-8 h-8 flex items-center justify-center rounded-md border border-slate-300 bg-slate-50 hover:bg-slate-100 font-mono text-sm text-slate-700 cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 4: Shift Note & Live LINE Message Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-4 border-b border-slate-200">
        <div className="lg:col-span-6 space-y-2">
          <label className="block text-xs font-semibold text-slate-700">
            04. หมายเหตุเวร / รายละเอียดเพิ่มเติม / ผู้รายงาน (Note)
          </label>
          <textarea
            rows={6}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="ระบุรายละเอียดสำคัญในเวร หรือชื่อผู้รายงาน..."
            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
        </div>

        {/* Live LINE Summary Preview & Copy inside Form */}
        <div className="lg:col-span-6 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <MessageSquareText className="w-3.5 h-3.5 text-teal-600" />
              <span>ตัวอย่างข้อความสรุปส่ง LINE Group (อัปเดตตามข้อมูลที่กรอก)</span>
            </label>
            <button
              type="button"
              onClick={handleCopyLiveLine}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                copiedLivePreview
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-900 hover:bg-slate-800 text-white'
              }`}
            >
              {copiedLivePreview ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>คัดลอกลง Clipboard แล้ว</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>คัดลอกส่ง LINE</span>
                </>
              )}
            </button>
          </div>
          <pre className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 font-mono text-xs text-slate-800 whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed">
            {liveLineText}
          </pre>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer"
          >
            ยกเลิก
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>กำลังบันทึกข้อมูล...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>{isEditing ? 'บันทึกการแก้ไขข้อมูล' : 'บันทึกรายงานยอดผู้ป่วย'}</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
};
