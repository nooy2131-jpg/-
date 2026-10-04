export type ShiftType = 'เช้า' | 'บ่าย' | 'ดึก';

export interface CensusRecord {
  id: string;
  date: string; // yyyy-MM-dd
  shift: ShiftType;
  totalPatients: number;
  capacity: number;
  availableBeds: number;
  newPatients: number;
  discharges: number;
  referrals: number;
  cat1: number; // ประเภท 1: อาการน้อยสุด (ช่วยเหลือตนเองได้ / Minimal Acuity)
  cat2: number; // ประเภท 2: อาการน้อย (พึ่งพาตนเองได้บ้าง / Mild Care)
  cat3: number; // ประเภท 3: อาการปานกลาง (พึ่งพาปานกลาง / Moderate Care)
  cat4: number; // ประเภท 4: อาการหนัก / กึ่งวิกฤต (พึ่งพาสูง / Semi-Critical)
  cat5: number; // ประเภท 5: วิกฤต / หนักมาก (เฝ้าระวังใกล้ชิด / Critical Care)
  note: string;
  updatedAt: string;
}

export interface SaveCensusResponse {
  success: boolean;
  message?: string;
  error?: string;
  record?: CensusRecord;
}

export interface DeleteCensusResponse {
  success: boolean;
  error?: string;
}

export const SHIFT_ORDER: Record<ShiftType, number> = {
  'ดึก': 1,
  'เช้า': 2,
  'บ่าย': 3,
};

export const SHIFT_META: Record<
  ShiftType,
  { label: string; timeRange: string; shortCode: string }
> = {
  'ดึก': { label: 'เวรดึก', timeRange: '00:00 – 08:00 น.', shortCode: 'N' },
  'เช้า': { label: 'เวรเช้า', timeRange: '08:00 – 16:00 น.', shortCode: 'M' },
  'บ่าย': { label: 'เวรบ่าย', timeRange: '16:00 – 24:00 น.', shortCode: 'A' },
};

export const PATIENT_CATEGORIES = [
  {
    key: 'cat1' as const,
    label: 'ประเภท 1 (อาการน้อยสุด)',
    shortLabel: 'ประเภท 1 · อาการน้อยสุด',
    description: 'อาการน้อยสุด ช่วยเหลือตนเองได้ดี รอจำหน่ายหรือสังเกตอาการทั่วไป (Self Care)',
    nursingHours: 1.5,
    colorHex: '#10b981', // emerald-500
    dotClass: 'bg-emerald-500',
    textClass: 'text-emerald-700',
    bedClass: 'bg-emerald-600 text-white border-emerald-700',
  },
  {
    key: 'cat2' as const,
    label: 'ประเภท 2 (อาการน้อย)',
    shortLabel: 'ประเภท 2 · อาการน้อย',
    description: 'อาการน้อย ช่วยเหลือตนเองได้เป็นส่วนใหญ่ ต้องการการดูแลพึ่งพาเล็กน้อย (Minimal Care)',
    nursingHours: 2.5,
    colorHex: '#0284c7', // sky-600
    dotClass: 'bg-sky-600',
    textClass: 'text-sky-700',
    bedClass: 'bg-sky-600 text-white border-sky-700',
  },
  {
    key: 'cat3' as const,
    label: 'ประเภท 3 (อาการปานกลาง)',
    shortLabel: 'ประเภท 3 · ปานกลาง',
    description: 'อาการปานกลาง ต้องการการรักษาพยาบาลและการช่วยเหลือปานกลาง (Intermediate Care)',
    nursingHours: 3.5,
    colorHex: '#0d9488', // teal-600
    dotClass: 'bg-teal-600',
    textClass: 'text-teal-700',
    bedClass: 'bg-teal-600 text-white border-teal-700',
  },
  {
    key: 'cat4' as const,
    label: 'ประเภท 4 (อาการหนัก / กึ่งวิกฤต)',
    shortLabel: 'ประเภท 4 · กึ่งวิกฤต',
    description: 'อาการค่อนข้างหนัก ต้องเฝ้าระวังสัญญาณชีพและพึ่งพาทางการพยาบาลสูง (Semi-Critical)',
    nursingHours: 5.5,
    colorHex: '#f59e0b', // amber-500
    dotClass: 'bg-amber-500',
    textClass: 'text-amber-700',
    bedClass: 'bg-amber-500 text-white border-amber-600',
  },
  {
    key: 'cat5' as const,
    label: 'ประเภท 5 (วิกฤต / หนักมาก)',
    shortLabel: 'ประเภท 5 · วิกฤต',
    description: 'ผู้ป่วยวิกฤต ต้องการการดูแลเฝ้าระวังใกล้ชิดตลอด 24 ชม. (Critical / Intensive Care)',
    nursingHours: 7.5,
    colorHex: '#dc2626', // red-600
    dotClass: 'bg-red-600',
    textClass: 'text-red-700',
    bedClass: 'bg-red-600 text-white border-red-700',
  },
];

export const DEFAULT_WARD_CAPACITY = 30;
