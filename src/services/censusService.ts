import {
  CensusRecord,
  DeleteCensusResponse,
  SaveCensusResponse,
} from '../types/census';
import { sortRecordsDesc } from '../utils/censusUtils';

const LOCAL_STORAGE_KEY = 'ongkharak_ipd_census_live_v2';

declare global {
  interface Window {
    google?: {
      script?: {
        run?: {
          withSuccessHandler: (callback: (result: any) => void) => {
            withFailureHandler: (errorCallback: (error: any) => void) => {
              getCensusRecords: () => void;
              saveCensusRecord: (record: CensusRecord) => void;
              deleteCensusRecord: (id: string) => void;
            };
          };
        };
      };
    };
  }
}

export function isRunningInGoogleAppsScript(): boolean {
  return Boolean(
    typeof window !== 'undefined' &&
      window.google &&
      window.google.script &&
      window.google.script.run
  );
}

function getLocalFallbackRecords(): CensusRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to read local storage records:', e);
  }
  return [];
}

function saveLocalFallbackRecords(records: CensusRecord[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(records));
  } catch (e) {
    console.error('Failed to save local storage records:', e);
  }
}

/**
 * Fetch all census records (always fetches latest modified state without cache)
 */
export async function getCensusRecords(): Promise<{
  records: CensusRecord[];
  source: 'gas-native' | 'server' | 'local';
  syncedAt: string;
}> {
  const syncedAt = new Date().toISOString();

  // 1. Check native Google Apps Script HtmlService environment
  if (isRunningInGoogleAppsScript()) {
    return new Promise((resolve, reject) => {
      window.google!.script!.run!
        .withSuccessHandler((res: CensusRecord[]) => {
          const list = Array.isArray(res) ? res : [];
          saveLocalFallbackRecords(list);
          resolve({
            records: sortRecordsDesc(list),
            source: 'gas-native',
            syncedAt: new Date().toISOString(),
          });
        })
        .withFailureHandler((err: any) => {
          reject(new Error(err?.message || String(err)));
        })
        .getCensusRecords();
    });
  }

  // 2. Call Express Backend API (/api/census) with cache-busting timestamp
  try {
    const response = await fetch(`/api/census?_t=${Date.now()}`, {
      cache: 'no-store',
    });
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data.records)) {
        saveLocalFallbackRecords(data.records);
        return {
          records: sortRecordsDesc(data.records),
          source: 'server',
          syncedAt: data.serverTime || syncedAt,
        };
      }
    }
  } catch (err) {
    console.warn('Server API unreachable, using local storage:', err);
  }

  // 3. LocalStorage Fallback
  const fallback = getLocalFallbackRecords();
  return {
    records: sortRecordsDesc(fallback),
    source: 'local',
    syncedAt,
  };
}

/**
 * Insert or Update a patient census record
 */
export async function saveCensusRecord(record: CensusRecord): Promise<SaveCensusResponse> {
  const payload: CensusRecord = {
    ...record,
    updatedAt: new Date().toISOString(),
  };

  // 1. Native Google Apps Script environment
  if (isRunningInGoogleAppsScript()) {
    return new Promise((resolve) => {
      window.google!.script!.run!
        .withSuccessHandler((res: SaveCensusResponse) => {
          resolve(res || { success: true, message: 'บันทึกสำเร็จ', record: payload });
        })
        .withFailureHandler((err: any) => {
          resolve({ success: false, error: err?.message || String(err) });
        })
        .saveCensusRecord(payload);
    });
  }

  // 2. Express Backend API
  try {
    const response = await fetch('/api/census', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (response.ok) {
      const res = await response.json();
      const savedRecord: CensusRecord = res.record || payload;
      const current = getLocalFallbackRecords();
      const idx = current.findIndex(
        (r) =>
          String(r.id) === String(savedRecord.id) ||
          (r.date === savedRecord.date && r.shift === savedRecord.shift)
      );
      if (idx >= 0) {
        current[idx] = savedRecord;
      } else {
        current.push(savedRecord);
      }
      saveLocalFallbackRecords(current);
      return {
        success: true,
        message: res.message || 'บันทึกสำเร็จ',
        record: savedRecord,
      };
    }
  } catch (err) {
    console.warn('Server API save fallback to local:', err);
  }

  // 3. LocalStorage Fallback
  const current = getLocalFallbackRecords();
  const idx = current.findIndex(
    (r) =>
      String(r.id) === String(payload.id) ||
      (r.date === payload.date && r.shift === payload.shift)
  );
  if (idx >= 0) {
    current[idx] = payload;
  } else {
    current.push(payload);
  }
  saveLocalFallbackRecords(current);
  return { success: true, message: 'บันทึกสำเร็จ', record: payload };
}

/**
 * Delete a census record by ID
 */
export async function deleteCensusRecord(id: string): Promise<DeleteCensusResponse> {
  // 1. Native Google Apps Script environment
  if (isRunningInGoogleAppsScript()) {
    return new Promise((resolve) => {
      window.google!.script!.run!
        .withSuccessHandler((res: DeleteCensusResponse) => {
          resolve(res || { success: true });
        })
        .withFailureHandler((err: any) => {
          resolve({ success: false, error: err?.message || String(err) });
        })
        .deleteCensusRecord(id);
    });
  }

  // 2. Express Backend API
  try {
    const response = await fetch(`/api/census/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (response.ok) {
      const current = getLocalFallbackRecords().filter((r) => String(r.id) !== String(id));
      saveLocalFallbackRecords(current);
      return { success: true };
    }
  } catch (err) {
    console.warn('Server API delete fallback to local:', err);
  }

  // 3. LocalStorage Fallback
  const current = getLocalFallbackRecords();
  const filtered = current.filter((r) => String(r.id) !== String(id));
  saveLocalFallbackRecords(filtered);
  return { success: true };
}
