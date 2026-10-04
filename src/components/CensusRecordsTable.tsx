import React, { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Edit3,
  FileSpreadsheet,
  MessageSquareText,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { CensusRecord, SHIFT_META, ShiftType } from '../types/census';
import {
  calculateOccupancyRate,
  copyTextToClipboard,
  exportCensusToCSV,
  formatThaiDate,
  formatUpdatedAt,
  generateLineShiftSummary,
  getOccupancyStatus,
  getTodayDateString,
} from '../utils/censusUtils';

interface CensusRecordsTableProps {
  records: CensusRecord[];
  isLoading: boolean;
  onEdit: (record: CensusRecord) => void;
  onDelete: (id: string) => Promise<void>;
  onCreateNew: () => void;
  onOpenLineGenerator?: (record: CensusRecord) => void;
}

type DateFilterPreset = 'all' | 'today' | '7d' | '30d' | 'custom';

export const CensusRecordsTable: React.FC<CensusRecordsTableProps> = ({
  records,
  isLoading,
  onEdit,
  onDelete,
  onCreateNew,
  onOpenLineGenerator,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [shiftFilter, setShiftFilter] = useState<'all' | ShiftType>('all');
  const [datePreset, setDatePreset] = useState<DateFilterPreset>('all');
  const [customDate, setCustomDate] = useState<string>(getTodayDateString(0));
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredRecords = useMemo(() => {
    const todayStr = getTodayDateString(0);
    const d7Str = getTodayDateString(-7);
    const d30Str = getTodayDateString(-30);
    const q = searchQuery.trim().toLowerCase();

    return records.filter((r) => {
      if (shiftFilter !== 'all' && r.shift !== shiftFilter) {
        return false;
      }

      if (datePreset === 'today' && r.date !== todayStr) {
        return false;
      } else if (datePreset === '7d' && r.date < d7Str) {
        return false;
      } else if (datePreset === '30d' && r.date < d30Str) {
        return false;
      } else if (datePreset === 'custom' && customDate && r.date !== customDate) {
        return false;
      }

      if (q) {
        const thaiDate = formatThaiDate(r.date).toLowerCase();
        const fullThaiDate = formatThaiDate(r.date, true).toLowerCase();
        const matchNote = (r.note || '').toLowerCase().includes(q);
        const matchDate =
          r.date.toLowerCase().includes(q) ||
          thaiDate.includes(q) ||
          fullThaiDate.includes(q);
        const matchId = r.id.toLowerCase().includes(q);
        const matchShift = r.shift.toLowerCase().includes(q);
        if (!matchNote && !matchDate && !matchId && !matchShift) {
          return false;
        }
      }

      return true;
    });
  }, [records, shiftFilter, datePreset, customDate, searchQuery]);

  const filteredTotals = useMemo(() => {
    if (filteredRecords.length === 0) {
      return {
        avgTotal: 0,
        sumNew: 0,
        sumDischarges: 0,
        sumReferrals: 0,
        avgOccupancy: 0,
      };
    }
    let sumTotal = 0;
    let sumNew = 0;
    let sumDischarges = 0;
    let sumReferrals = 0;
    let sumOcc = 0;

    for (const r of filteredRecords) {
      sumTotal += r.totalPatients;
      sumNew += r.newPatients;
      sumDischarges += r.discharges;
      sumReferrals += r.referrals;
      sumOcc += calculateOccupancyRate(r.totalPatients, r.capacity);
    }

    return {
      avgTotal: Math.round((sumTotal / filteredRecords.length) * 10) / 10,
      sumNew,
      sumDischarges,
      sumReferrals,
      avgOccupancy: Math.round((sumOcc / filteredRecords.length) * 10) / 10,
    };
  }, [filteredRecords]);

  const handleCopyLineReport = async (record: CensusRecord) => {
    const text = generateLineShiftSummary(record);
    const ok = await copyTextToClipboard(text);
    if (ok) {
      setCopiedId(record.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleConfirmDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await onDelete(id);
      setConfirmDeleteId(null);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      {/* Filter Controls Header */}
      <div className="p-4 sm:p-5 border-b border-slate-200 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาวันที่, ผู้รายงาน, หมายเหตุเวร..."
              className="w-full h-9 pl-9 pr-8 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label="ล้างคำค้นหา"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Interactive Filter Controls (Shift & Date Range) */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Shift Segmented Filter */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
              {(
                [
                  { key: 'all', label: 'ทุกเวร' },
                  { key: 'ดึก', label: 'เวรดึก' },
                  { key: 'เช้า', label: 'เวรเช้า' },
                  { key: 'บ่าย', label: 'เวรบ่าย' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setShiftFilter(tab.key)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    shiftFilter === tab.key
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Date Preset Segmented Filter */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
              {(
                [
                  { key: 'all', label: 'ทั้งหมด' },
                  { key: 'today', label: 'วันนี้' },
                  { key: '7d', label: '7 วัน' },
                  { key: '30d', label: '30 วัน' },
                  { key: 'custom', label: 'เลือกวัน' },
                ] as const
              ).map((dTab) => (
                <button
                  key={dTab.key}
                  type="button"
                  onClick={() => setDatePreset(dTab.key)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    datePreset === dTab.key
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {dTab.label}
                </button>
              ))}
            </div>

            {datePreset === 'custom' && (
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="h-8 px-2.5 rounded-lg border border-slate-300 bg-white font-mono tabular-nums text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            )}

            <button
              type="button"
              onClick={() => exportCensusToCSV(filteredRecords)}
              disabled={filteredRecords.length === 0}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 text-xs font-medium text-slate-700 transition-colors whitespace-nowrap cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-teal-700" />
              <span>ส่งออก CSV ({filteredRecords.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="p-6 space-y-3">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-10 bg-slate-100 animate-pulse rounded-md" />
          ))}
        </div>
      ) : filteredRecords.length === 0 ? (
        /* Empty State */
        <div className="py-14 px-6 text-center space-y-3">
          <div className="text-sm font-semibold text-slate-900">
            {records.length === 0
              ? 'ยังไม่มีข้อมูลรายงานยอดผู้ป่วยในระบบ'
              : 'ไม่พบรายการรายงานยอดผู้ป่วยตามเงื่อนไขที่เลือก'}
          </div>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {records.length === 0
              ? 'กดปุ่มด้านล่างเพื่อเริ่มบันทึกยอดผู้ป่วยประจำเวรของตึกผู้ป่วยใน โรงพยาบาลองครักษ์ ข้อมูลจะถูกอัปเดตทันทีสำหรับผู้ใช้งานทุกคน'
              : 'คุณสามารถล้างตัวกรองการค้นหา หรือกดปุ่มด้านล่างเพื่อบันทึกข้อมูลยอดผู้ป่วยประจำเวรใหม่'}
          </p>
          <div className="pt-2 flex items-center justify-center gap-3">
            {(searchQuery || shiftFilter !== 'all' || datePreset !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setShiftFilter('all');
                  setDatePreset('all');
                }}
                className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors cursor-pointer"
              >
                ล้างตัวกรองทั้งหมด
              </button>
            )}
            <button
              type="button"
              onClick={onCreateNew}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>บันทึกยอดผู้ป่วยใหม่</span>
            </button>
          </div>
        </div>
      ) : (
        /* High-Density Data Table */
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-600">
                <th className="py-3 pl-5 pr-3 whitespace-nowrap">วันที่รายงาน</th>
                <th className="py-3 px-3 whitespace-nowrap">เวร</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">ผู้ป่วยทั้งหมด / เตียง</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">ครองเตียง</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">เตียงว่าง</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">รับใหม่</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">จำหน่าย</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">ส่งต่อ</th>
                <th
                  className="py-3 px-3 text-right whitespace-nowrap"
                  title="จำแนกประเภทผู้ป่วย 1 / 2 / 3 / 4 / 5"
                >
                  ประเภท 1 · 2 · 3 · 4 · 5
                </th>
                <th className="py-3 px-3 whitespace-nowrap">หมายเหตุ / แก้ไขล่าสุด</th>
                <th className="py-3 pl-3 pr-5 text-right whitespace-nowrap">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {filteredRecords.map((r) => {
                const occRate = calculateOccupancyRate(r.totalPatients, r.capacity);
                const occStatus = getOccupancyStatus(r.totalPatients, r.capacity);
                const isConfirmingDelete = confirmDeleteId === r.id;
                const isCopied = copiedId === r.id;

                return (
                  <tr
                    key={r.id}
                    className="hover:bg-slate-50/90 transition-colors group"
                  >
                    {/* Date */}
                    <td className="py-2.5 pl-5 pr-3 whitespace-nowrap">
                      <div className="font-medium text-slate-900">
                        {formatThaiDate(r.date)}
                      </div>
                      <div className="text-[11px] font-mono tabular-nums text-slate-400">
                        {r.date}
                      </div>
                    </td>

                    {/* Shift */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="font-semibold text-slate-800">
                        {SHIFT_META[r.shift]?.label || `เวร${r.shift}`}
                      </div>
                      <div className="text-[11px] font-mono tabular-nums text-slate-400">
                        {SHIFT_META[r.shift]?.timeRange}
                      </div>
                    </td>

                    {/* Total Patients / Capacity */}
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                      <span className="text-sm font-bold text-slate-900">
                        {r.totalPatients}
                      </span>
                      <span className="text-slate-400"> / {r.capacity}</span>
                    </td>

                    {/* Occupancy Rate */}
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <div
                        className={`font-mono tabular-nums font-semibold ${
                          occStatus.level === 'critical'
                            ? 'text-red-600'
                            : occStatus.level === 'warning'
                            ? 'text-amber-600'
                            : 'text-teal-700'
                        }`}
                      >
                        {occRate.toFixed(1)}%
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {occStatus.label}
                      </div>
                    </td>

                    {/* Available Beds */}
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                      <span
                        className={`font-semibold ${
                          r.availableBeds === 0 ? 'text-red-600' : 'text-slate-800'
                        }`}
                      >
                        {r.availableBeds}
                      </span>
                      <span className="text-slate-400 ml-1">เตียง</span>
                    </td>

                    {/* New Patients */}
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                      <span
                        className={
                          r.newPatients > 0
                            ? 'font-semibold text-teal-700'
                            : 'text-slate-400'
                        }
                      >
                        {r.newPatients > 0 ? `+${r.newPatients}` : '0'}
                      </span>
                    </td>

                    {/* Discharges */}
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                      <span
                        className={
                          r.discharges > 0
                            ? 'font-semibold text-slate-800'
                            : 'text-slate-400'
                        }
                      >
                        {r.discharges > 0 ? `-${r.discharges}` : '0'}
                      </span>
                    </td>

                    {/* Referrals */}
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                      <span
                        className={
                          r.referrals > 0
                            ? 'font-semibold text-amber-700'
                            : 'text-slate-400'
                        }
                      >
                        {r.referrals}
                      </span>
                    </td>

                    {/* Categories 1-5 (1=อาการน้อยสุด -> 5=วิกฤต) */}
                    <td
                      className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap text-slate-700"
                      title={`ป.1(น้อยสุด)=${r.cat1}, ป.2(น้อย)=${r.cat2}, ป.3(ปานกลาง)=${r.cat3}, ป.4(กึ่งวิกฤต)=${r.cat4}, ป.5(วิกฤต)=${r.cat5}`}
                    >
                      <span className="text-slate-600">{r.cat1}</span>
                      <span className="text-slate-300 mx-1">·</span>
                      <span className="text-slate-600">{r.cat2}</span>
                      <span className="text-slate-300 mx-1">·</span>
                      <span className="font-medium text-slate-800">{r.cat3}</span>
                      <span className="text-slate-300 mx-1">·</span>
                      <span
                        className={
                          r.cat4 > 0
                            ? 'font-semibold text-amber-700'
                            : 'text-slate-400'
                        }
                      >
                        {r.cat4}
                      </span>
                      <span className="text-slate-300 mx-1">·</span>
                      <span
                        className={
                          r.cat5 > 0 ? 'font-bold text-red-600' : 'text-slate-400'
                        }
                      >
                        {r.cat5}
                      </span>
                    </td>

                    {/* Note & UpdatedAt */}
                    <td className="py-2.5 px-3 max-w-xs">
                      <div className="text-slate-800 truncate" title={r.note}>
                        {r.note || <span className="text-slate-400">-</span>}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                        แก้ไขล่าสุด {formatUpdatedAt(r.updatedAt, true)}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 pl-3 pr-5 text-right whitespace-nowrap">
                      {isConfirmingDelete ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={deletingId === r.id}
                            onClick={() => handleConfirmDelete(r.id)}
                            className="px-2.5 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-[11px] font-semibold transition-colors cursor-pointer"
                          >
                            {deletingId === r.id ? 'กำลังลบ...' : 'ยืนยันลบ'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-600 text-[11px] transition-colors cursor-pointer"
                          >
                            ยกเลิก
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleCopyLineReport(r)}
                            title="คัดลอกสรุปยอดเวรลง Clipboard เพื่อส่ง LINE Group"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-medium transition-colors cursor-pointer"
                          >
                            {isCopied ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span className="text-emerald-700">คัดลอกแล้ว</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3 text-slate-500" />
                                <span>คัดลอก LINE</span>
                              </>
                            )}
                          </button>
                          {onOpenLineGenerator && (
                            <button
                              type="button"
                              onClick={() => onOpenLineGenerator(r)}
                              title="เปิดหน้าต่างปรับแต่งข้อความสรุปส่ง LINE"
                              className="p-1.5 rounded border border-transparent hover:border-slate-200 hover:bg-slate-100 text-teal-700 transition-colors cursor-pointer"
                              aria-label="เปิดหน้าต่างปรับแต่งข้อความสรุปส่ง LINE"
                            >
                              <MessageSquareText className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onEdit(r)}
                            title="แก้ไขรายการ"
                            className="p-1.5 rounded border border-transparent hover:border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                            aria-label="แก้ไขรายการ"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(r.id)}
                            title="ลบรายการ"
                            className="p-1.5 rounded border border-transparent hover:border-red-200 hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                            aria-label="ลบรายการ"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Table Footer Summary */}
            <tfoot className="border-t border-slate-200 bg-slate-50 text-xs font-medium text-slate-700">
              <tr>
                <td colSpan={2} className="py-3 pl-5 pr-3">
                  สรุปจาก {filteredRecords.length} รายการที่แสดงผล
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                  เฉลี่ย {filteredTotals.avgTotal} ราย
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums text-teal-700 font-semibold">
                  เฉลี่ย {filteredTotals.avgOccupancy}%
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-400">
                  -
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums text-teal-700 font-semibold">
                  รวม +{filteredTotals.sumNew}
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-800 font-semibold">
                  รวม -{filteredTotals.sumDischarges}
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums text-amber-700 font-semibold">
                  รวม {filteredTotals.sumReferrals}
                </td>
                <td colSpan={3} className="py-3 pr-5 text-right text-slate-500">
                  ตึกผู้ป่วยใน โรงพยาบาลองครักษ์
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};
