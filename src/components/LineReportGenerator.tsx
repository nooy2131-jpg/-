import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  MessageSquareText,
  RotateCcw,
  X,
} from 'lucide-react';
import { CensusRecord, SHIFT_META } from '../types/census';
import {
  copyTextToClipboard,
  formatThaiDate,
  generateLineShiftSummary,
  LineReportFormat,
} from '../utils/censusUtils';

interface LineReportGeneratorProps {
  record: CensusRecord;
  allRecords?: CensusRecord[];
  onSelectRecord?: (record: CensusRecord) => void;
  onClose?: () => void;
  isModal?: boolean;
  onCopied?: (msg: string) => void;
}

export const LineReportGenerator: React.FC<LineReportGeneratorProps> = ({
  record,
  allRecords = [],
  onSelectRecord,
  onClose,
  isModal = false,
  onCopied,
}) => {
  const [format, setFormat] = useState<LineReportFormat>('standard');
  const [includeCapacityAndOccupancy, setIncludeCapacityAndOccupancy] = useState<boolean>(true);
  const [includeCategories, setIncludeCategories] = useState<boolean>(true);
  const [includeWorkloadHours, setIncludeWorkloadHours] = useState<boolean>(false);
  const [includeNote, setIncludeNote] = useState<boolean>(true);
  const [reporterName, setReporterName] = useState<string>('');
  const [customText, setCustomText] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const generatedMessage = useMemo(() => {
    return generateLineShiftSummary(record, {
      format,
      includeCapacityAndOccupancy,
      includeCategories,
      includeWorkloadHours: format === 'detailed' ? true : includeWorkloadHours,
      includeNote,
      reporterName,
    });
  }, [
    record,
    format,
    includeCapacityAndOccupancy,
    includeCategories,
    includeWorkloadHours,
    includeNote,
    reporterName,
  ]);

  // Reset manual edits when underlying record or options change
  useEffect(() => {
    setCustomText(null);
  }, [generatedMessage]);

  const activeText = customText !== null ? customText : generatedMessage;

  const handleCopy = async () => {
    const ok = await copyTextToClipboard(activeText);
    if (ok) {
      setCopied(true);
      if (onCopied) {
        onCopied(
          `คัดลอกข้อความสรุปเวร (${formatThaiDate(record.date)} · ${
            SHIFT_META[record.shift]?.label || record.shift
          }) ลงใน Clipboard เรียบร้อยแล้ว`
        );
      }
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <MessageSquareText className="w-4 h-4 text-teal-600 shrink-0" />
            <h3 className="text-base font-semibold text-slate-900">
              สร้างข้อความสรุปยอดผู้ป่วยรายเวรส่ง LINE Group
            </h3>
          </div>
          <p className="text-xs text-slate-500">
            สรุปข้อมูลประจำวันที่ {formatThaiDate(record.date, true)} ·{' '}
            {SHIFT_META[record.shift]?.label} ({SHIFT_META[record.shift]?.timeRange}) สำหรับส่งต่อเวรในกลุ่ม LINE ตึกผู้ป่วยใน
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {allRecords.length > 1 && onSelectRecord && (
            <select
              value={record.id}
              onChange={(e) => {
                const found = allRecords.find((r) => r.id === e.target.value);
                if (found) onSelectRecord(found);
              }}
              aria-label="เลือกเวรที่ต้องการสร้างข้อความสรุป"
              className="h-8 px-2.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600"
            >
              {allRecords.slice(0, 15).map((r) => (
                <option key={r.id} value={r.id}>
                  {formatThaiDate(r.date)} · เวร{r.shift} (ผู้ป่วย {r.totalPatients} ราย)
                </option>
              ))}
            </select>
          )}

          {isModal && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="ปิดหน้าต่าง"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Body Grid: Left Options & Quick Data Summary / Right Live Preview & Copy Button */}
      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
        {/* Left 6 Cols: Format & Content Controls + Key Figures Breakdown */}
        <div className="lg:col-span-6 p-6 space-y-5">
          {/* Format Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              รูปแบบข้อความรายงาน (Report Template)
            </label>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200">
              {(
                [
                  { id: 'standard', label: 'มาตรฐานหอผู้ป่วย' },
                  { id: 'compact', label: 'แบบย่อกระชับ' },
                  { id: 'detailed', label: 'ละเอียด + ภาระงาน' },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setFormat(item.id);
                    if (item.id === 'detailed') {
                      setIncludeWorkloadHours(true);
                    }
                  }}
                  className={`py-1.5 px-2.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    format === item.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Toggleable Sections */}
          <div className="space-y-2.5">
            <div className="text-xs font-semibold text-slate-700">
              หัวข้อข้อมูลที่ต้องการแสดงในข้อความ
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-slate-700">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeCapacityAndOccupancy}
                  onChange={(e) => setIncludeCapacityAndOccupancy(e.target.checked)}
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-600"
                />
                <span>เตียงว่างและอัตราครองเตียง (%)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeCategories}
                  onChange={(e) => setIncludeCategories(e.target.checked)}
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-600"
                />
                <span>สรุปแยกประเภทผู้ป่วย 1–5</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={format === 'detailed' ? true : includeWorkloadHours}
                  disabled={format === 'detailed'}
                  onChange={(e) => setIncludeWorkloadHours(e.target.checked)}
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-600"
                />
                <span>ภาระงานพยาบาล (ชม./วัน)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeNote}
                  onChange={(e) => setIncludeNote(e.target.checked)}
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-600"
                />
                <span>หมายเหตุเวร ({record.note ? 'มีข้อมูล' : 'ว่าง'})</span>
              </label>
            </div>
          </div>

          {/* Reporter Name Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              ชื่อผู้รายงาน / พยาบาลหัวหน้าเวร (ระบุเพิ่มเติมท้ายข้อความ)
            </label>
            <input
              type="text"
              value={reporterName}
              onChange={(e) => setReporterName(e.target.value)}
              placeholder="เช่น พว.กมลวรรณ (หัวหน้าเวรเช้า)..."
              className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          {/* Structured Data Verification Strip */}
          <div className="pt-3 border-t border-slate-200 space-y-2">
            <div className="text-xs font-semibold text-slate-700">
              ข้อมูลสรุปที่จะปรากฏในรายงานเวรนี้:
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200 font-mono tabular-nums">
              <div>
                <div className="text-[11px] font-sans text-slate-500">ผู้ป่วยทั้งหมด</div>
                <div className="font-bold text-slate-900">{record.totalPatients} ราย</div>
              </div>
              <div>
                <div className="text-[11px] font-sans text-slate-500">รับใหม่ / จำหน่าย / ส่งต่อ</div>
                <div className="font-semibold text-teal-700">
                  +{record.newPatients} / -{record.discharges} / {record.referrals}
                </div>
              </div>
              <div className="col-span-2">
                <div className="text-[11px] font-sans text-slate-500">แยกประเภท 1 · 2 · 3 · 4 · 5</div>
                <div className="font-semibold text-slate-900">
                  {record.cat1} · {record.cat2} · {record.cat3} · {record.cat4} · {record.cat5} ราย
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right 6 Cols: Editable LINE Message Preview & Copy to Clipboard CTA */}
        <div className="lg:col-span-6 p-6 flex flex-col justify-between space-y-4 bg-slate-50/50">
          <div className="space-y-2 flex-1 flex flex-col">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">
                ตัวอย่างข้อความที่จะคัดลอก (สามารถพิมพ์แก้ไขเพิ่มเติมได้โดยตรง)
              </label>
              {customText !== null && (
                <button
                  type="button"
                  onClick={() => setCustomText(null)}
                  className="inline-flex items-center gap-1 text-[11px] text-teal-700 hover:underline cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>คืนค่าข้อความอัตโนมัติ</span>
                </button>
              )}
            </div>

            <textarea
              rows={12}
              value={activeText}
              onChange={(e) => setCustomText(e.target.value)}
              className="w-full flex-1 p-3.5 rounded-lg border border-slate-300 bg-white font-mono text-xs text-slate-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
            <span className="text-[11px] text-slate-500">
              กดปุ่มคัดลอกเพื่อนำไปวาง (Paste) ในกลุ่ม LINE ของตึกผู้ป่วยในได้ทันที
            </span>

            <button
              type="button"
              onClick={handleCopy}
              className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-teal-600 hover:bg-teal-700 text-white'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>คัดลอกลง Clipboard แล้ว!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>คัดลอกข้อความส่ง LINE Group</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
