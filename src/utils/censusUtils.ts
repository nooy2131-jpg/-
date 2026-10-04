import {
  CensusRecord,
  PATIENT_CATEGORIES,
  SHIFT_META,
  SHIFT_ORDER,
} from '../types/census';

/**
 * Returns current date in Thailand timezone (GMT+7) as yyyy-MM-dd
 */
export function getTodayDateString(offsetDays = 0): string {
  const now = new Date();
  const target = new Date(now.getTime() + offsetDays * 86400000);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(target);
}

/**
 * Format yyyy-MM-dd into Thai Buddhist Date (e.g., "4 ต.ค. 2569")
 */
export function formatThaiDate(dateStr: string, fullMonth = false): string {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  const thaiMonthsShort = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
  ];
  const thaiMonthsFull = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
  ];

  const buddhistYear = year + 543;
  const monthName = fullMonth ? thaiMonthsFull[month] : thaiMonthsShort[month];
  if (!monthName) return dateStr;
  return `${day} ${monthName} ${buddhistYear}`;
}

/**
 * Format ISO timestamp into readable Thai time (e.g. "4 ต.ค. 69 · 14:30:12 น.")
 */
export function formatUpdatedAt(isoStr: string, includeSeconds = false): string {
  if (!isoStr) return '-';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return (
      new Intl.DateTimeFormat('th-TH', {
        timeZone: 'Asia/Bangkok',
        day: 'numeric',
        month: 'short',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: includeSeconds ? '2-digit' : undefined,
        hour12: false,
      }).format(d) + ' น.'
    );
  } catch {
    return isoStr;
  }
}

/**
 * Sort records descending (newest date & latest shift first, then latest updatedAt)
 */
export function sortRecordsDesc(records: CensusRecord[]): CensusRecord[] {
  return [...records].sort((a, b) => {
    if (a.date !== b.date) {
      return b.date.localeCompare(a.date);
    }
    const shiftDiff = (SHIFT_ORDER[b.shift] || 0) - (SHIFT_ORDER[a.shift] || 0);
    if (shiftDiff !== 0) return shiftDiff;
    return (b.updatedAt || '').localeCompare(a.updatedAt || '');
  });
}

/**
 * Sort records ascending (oldest date & earliest shift first) for time-series charts
 */
export function sortRecordsAsc(records: CensusRecord[]): CensusRecord[] {
  return [...records].sort((a, b) => {
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }
    return (SHIFT_ORDER[a.shift] || 0) - (SHIFT_ORDER[b.shift] || 0);
  });
}

/**
 * Find the most recently modified timestamp across all records
 */
export function getLatestModifiedRecord(records: CensusRecord[]): CensusRecord | null {
  if (records.length === 0) return null;
  return [...records].sort((a, b) =>
    (b.updatedAt || '').localeCompare(a.updatedAt || '')
  )[0];
}

/**
 * Calculate Occupancy Rate (%)
 */
export function calculateOccupancyRate(totalPatients: number, capacity: number): number {
  if (!capacity || capacity <= 0) return 0;
  return Math.round((totalPatients / capacity) * 1000) / 10;
}

/**
 * Determine semantic bed occupancy status (never conveyed by color alone)
 */
export function getOccupancyStatus(totalPatients: number, capacity: number): {
  level: 'normal' | 'warning' | 'critical';
  label: string;
  rate: number;
} {
  const rate = calculateOccupancyRate(totalPatients, capacity);
  if (rate >= 95) {
    return {
      level: 'critical',
      label: totalPatients > capacity ? 'เกินศักยภาพเตียง' : 'เตียงใกล้เต็ม/วิกฤต',
      rate,
    };
  }
  if (rate >= 80) {
    return {
      level: 'warning',
      label: 'เฝ้าระวังเตียงตึงตัว',
      rate,
    };
  }
  return {
    level: 'normal',
    label: 'ศักยภาพเตียงปกติ',
    rate,
  };
}

/**
 * Calculate Estimated Nursing Care Hours per shift / day (HPPD)
 */
export function calculateNursingWorkloadHours(
  record: Pick<CensusRecord, 'cat1' | 'cat2' | 'cat3' | 'cat4' | 'cat5'>
): number {
  const totalHours =
    record.cat1 * 1.5 +
    record.cat2 * 2.5 +
    record.cat3 * 3.5 +
    record.cat4 * 5.5 +
    record.cat5 * 7.5;
  return Math.round(totalHours * 10) / 10;
}

export type LineReportFormat = 'standard' | 'compact' | 'detailed';

export interface LineReportOptions {
  format?: LineReportFormat;
  includeCapacityAndOccupancy?: boolean;
  includeCategories?: boolean;
  includeWorkloadHours?: boolean;
  includeNote?: boolean;
  reporterName?: string;
}

/**
 * Copy text to clipboard reliably in both standard windows and sandboxed iframes
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback to textarea execCommand below
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textArea);
    return copied;
  } catch {
    return false;
  }
}

/**
 * Generate structured text summary for LINE / Hospital Ward Shift Handover
 */
export function generateLineShiftSummary(
  record: CensusRecord,
  options?: LineReportOptions
): string {
  const format = options?.format ?? 'standard';
  const includeCapacityAndOccupancy = options?.includeCapacityAndOccupancy ?? true;
  const includeCategories = options?.includeCategories ?? true;
  const includeWorkloadHours = options?.includeWorkloadHours ?? (format === 'detailed');
  const includeNote = options?.includeNote ?? true;
  const reporterName = options?.reporterName?.trim() || '';

  const occRate = calculateOccupancyRate(record.totalPatients, record.capacity);
  const status = getOccupancyStatus(record.totalPatients, record.capacity);
  const shiftInfo = SHIFT_META[record.shift] || { label: `เวร${record.shift}`, timeRange: '' };
  const extraBeds =
    record.totalPatients > record.capacity ? record.totalPatients - record.capacity : 0;
  const workloadHours = calculateNursingWorkloadHours(record);

  if (format === 'compact') {
    const lines = [
      `สรุปยอดผู้ป่วย ตึกผู้ป่วยใน รพ.องครักษ์`,
      `วันที่ ${formatThaiDate(record.date, false)} | ${shiftInfo.label} (${shiftInfo.timeRange})`,
      `• ผู้ป่วยทั้งหมด: ${record.totalPatients} ราย${
        includeCapacityAndOccupancy
          ? ` (ว่าง ${record.availableBeds} เตียง · ครองเตียง ${occRate.toFixed(1)}%)`
          : ''
      }`,
      `• รับใหม่: ${record.newPatients} | จำหน่าย: ${record.discharges} | ส่งต่อ: ${record.referrals} ราย`,
    ];
    if (includeCategories) {
      lines.push(
        `• แยกประเภท 1-5: [ป.1=${record.cat1}] [ป.2=${record.cat2}] [ป.3=${record.cat3}] [ป.4=${record.cat4}] [ป.5=${record.cat5}]`
      );
    }
    if (includeWorkloadHours) {
      lines.push(`• ภาระงานพยาบาล: ${workloadHours} ชม./วัน`);
    }
    if (includeNote && record.note) {
      lines.push(`• หมายเหตุ: ${record.note}`);
    }
    if (reporterName) {
      lines.push(`• ผู้รายงาน: ${reporterName}`);
    }
    return lines.join('\n');
  }

  const lines: string[] = [
    `รายงานยอดผู้ป่วยใน โรงพยาบาลองครักษ์`,
    `หน่วยงาน: ตึกผู้ป่วยใน (IPD)`,
    `วันที่: ${formatThaiDate(record.date, true)}`,
    `เวร: ${shiftInfo.label} (${shiftInfo.timeRange})`,
    `────────────────────`,
    `สรุปยอดผู้ป่วยและเตียง:`,
    `• จำนวนผู้ป่วยทั้งหมด: ${record.totalPatients} ราย`,
  ];

  if (includeCapacityAndOccupancy) {
    lines.push(
      `• เตียงทั้งหมด: ${record.capacity} เตียง | เตียงว่าง: ${record.availableBeds} เตียง${
        extraBeds > 0 ? ` (เตียงเสริม +${extraBeds})` : ''
      }`
    );
    lines.push(`• อัตราการครองเตียง: ${occRate.toFixed(1)}% (${status.label})`);
  }

  lines.push(
    `────────────────────`,
    `การเคลื่อนไหวในเวร:`,
    `• ผู้ป่วยรับใหม่ (Admit): ${record.newPatients} ราย`,
    `• จำหน่ายกลับบ้าน (D/C): ${record.discharges} ราย`,
    `• ส่งต่อรักษา (Refer): ${record.referrals} ราย`
  );

  if (includeCategories) {
    lines.push(
      `────────────────────`,
      `สรุปแยกประเภทผู้ป่วย (ประเภท 1-5):`,
      `• ประเภท 1 (อาการน้อยสุด): ${record.cat1} ราย`,
      `• ประเภท 2 (อาการน้อย): ${record.cat2} ราย`,
      `• ประเภท 3 (อาการปานกลาง): ${record.cat3} ราย`,
      `• ประเภท 4 (อาการหนัก/กึ่งวิกฤต): ${record.cat4} ราย`,
      `• ประเภท 5 (วิกฤต/หนักมาก): ${record.cat5} ราย`
    );
  }

  if (includeWorkloadHours) {
    lines.push(`• ภาระงานทางการพยาบาลรวม: ${workloadHours} ชม./วัน`);
  }

  if ((includeNote && record.note) || reporterName) {
    lines.push(`────────────────────`);
    if (includeNote && record.note) {
      lines.push(`หมายเหตุเวร: ${record.note}`);
    }
    if (reporterName) {
      lines.push(`ผู้รายงาน: ${reporterName}`);
    }
  }

  return lines.join('\n');
}

/**
 * Export CensusRecords to CSV with UTF-8 BOM for Thai Excel compatibility
 */
export function exportCensusToCSV(records: CensusRecord[]): void {
  const headers = [
    'รหัสรายการ (id)',
    'วันที่ (date)',
    'วันที่ พ.ศ.',
    'เวร (shift)',
    'ยอดผู้ป่วยคงเหลือ (totalPatients)',
    'จำนวนเตียงทั้งหมด (capacity)',
    'เตียงว่าง (availableBeds)',
    'อัตราครองเตียง (%)',
    'รับใหม่ (newPatients)',
    'จำหน่าย (discharges)',
    'ส่งต่อ (referrals)',
    'ประเภท 1 (cat1)',
    'ประเภท 2 (cat2)',
    'ประเภท 3 (cat3)',
    'ประเภท 4 (cat4)',
    'ประเภท 5 (cat5)',
    'หมายเหตุ (note)',
    'เวลาอัปเดตล่าสุด (updatedAt)',
  ];

  const escapeCsv = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = sortRecordsDesc(records).map((r) => [
    r.id,
    r.date,
    formatThaiDate(r.date),
    r.shift,
    r.totalPatients,
    r.capacity,
    r.availableBeds,
    calculateOccupancyRate(r.totalPatients, r.capacity),
    r.newPatients,
    r.discharges,
    r.referrals,
    r.cat1,
    r.cat2,
    r.cat3,
    r.cat4,
    r.cat5,
    r.note,
    r.updatedAt,
  ]);

  const csvContent =
    '\uFEFF' +
    [headers.map(escapeCsv).join(','), ...rows.map((row) => row.map(escapeCsv).join(','))].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `รายงานยอดผู้ป่วยใน_รพ.องครักษ์_${getTodayDateString()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export { PATIENT_CATEGORIES };
