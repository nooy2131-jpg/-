/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { CensusAnalytics } from './components/CensusAnalytics';
import { CensusForm } from './components/CensusFormModal';
import { CensusRecordsTable } from './components/CensusRecordsTable';
import { LatestShiftOverview } from './components/LatestShiftOverview';
import { LineReportGenerator } from './components/LineReportGenerator';
import {
  deleteCensusRecord,
  getCensusRecords,
  saveCensusRecord,
} from './services/censusService';
import { CensusRecord, SHIFT_META } from './types/census';
import {
  exportCensusToCSV,
  formatThaiDate,
  formatUpdatedAt,
  getLatestModifiedRecord,
  getTodayDateString,
} from './utils/censusUtils';

type ActiveTab = 'overview' | 'entry' | 'line' | 'history' | 'analytics';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [records, setRecords] = useState<CensusRecord[]>([]);
  const [selectedOverviewRecord, setSelectedOverviewRecord] = useState<CensusRecord | null>(null);
  const [editingRecord, setEditingRecord] = useState<CensusRecord | null>(null);
  const [lineModalRecord, setLineModalRecord] = useState<CensusRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>(new Date().toISOString());
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification((prev) => (prev?.message === message ? null : prev));
    }, 3500);
  }, []);

  const loadRecords = useCallback(
    async (silent = false) => {
      if (!silent) {
        setIsLoading(true);
      } else {
        setIsSyncing(true);
      }
      try {
        const result = await getCensusRecords();
        setRecords(result.records);
        setLastSyncedAt(result.syncedAt);
        if (result.records.length > 0) {
          setSelectedOverviewRecord((prev) => {
            if (!prev) return result.records[0];
            const updated = result.records.find((r) => r.id === prev.id);
            return updated || result.records[0];
          });
        } else {
          setSelectedOverviewRecord(null);
        }
      } catch (err: any) {
        if (!silent) {
          showToast(err?.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล', 'error');
        }
      } finally {
        if (!silent) {
          setIsLoading(false);
        }
        setIsSyncing(false);
      }
    },
    [showToast]
  );

  // Initial load + automatic background polling every 10 seconds + window focus sync
  useEffect(() => {
    loadRecords(false);

    const intervalId = window.setInterval(() => {
      loadRecords(true);
    }, 10000);

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        loadRecords(true);
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [loadRecords]);

  const latestModifiedRecord = useMemo(
    () => getLatestModifiedRecord(records),
    [records]
  );

  const handleSaveRecord = async (record: CensusRecord) => {
    setIsSubmitting(true);
    try {
      const res = await saveCensusRecord(record);
      if (res.success) {
        await loadRecords(true);
        const saved = res.record || record;
        setSelectedOverviewRecord(saved);
        setIsModalOpen(false);
        setEditingRecord(null);
        if (activeTab === 'entry') {
          setActiveTab('overview');
        }
        showToast(
          `${res.message || 'บันทึกสำเร็จ'} · อัปเดตข้อมูลวันที่ ${formatThaiDate(
            saved.date
          )} (เวร${saved.shift}) ล่าสุดเรียบร้อยแล้ว`
        );
      } else {
        showToast(res.error || 'ไม่สามารถบันทึกข้อมูลได้', 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRecord = async (id: string) => {
    const res = await deleteCensusRecord(id);
    if (res.success) {
      await loadRecords(true);
      showToast('ลบรายการรายงานยอดผู้ป่วยเรียบร้อยแล้ว');
    } else {
      showToast(res.error || 'ไม่สามารถลบรายการได้', 'error');
    }
  };

  const handleOpenCreateModal = () => {
    setEditingRecord(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (record: CensusRecord) => {
    setEditingRecord(record);
    setIsModalOpen(true);
  };

  const navItems: Array<{ id: ActiveTab; label: string }> = [
    { id: 'overview', label: 'ภาพรวมยอดผู้ป่วย' },
    { id: 'entry', label: 'บันทึกยอดเวร' },
    { id: 'line', label: 'สรุปส่ง LINE' },
    { id: 'history', label: 'ตารางประวัติ' },
    { id: 'analytics', label: 'วิเคราะห์แนวโน้ม' },
  ];

  const activeLineRecord = selectedOverviewRecord || records[0] || null;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 sm:px-8 h-14 flex items-center justify-between gap-4">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#overview"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('overview');
          }}
          className="text-base sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap truncate"
        >
          โรงพยาบาลองครักษ์ · ตึกผู้ป่วยใน
        </a>

        {/* Zone 2: 5 clean text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-600">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === 'entry') {
                    setEditingRecord(null);
                  }
                  setActiveTab(item.id);
                }}
                className={`py-4 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'border-teal-600 text-teal-700 font-semibold'
                    : 'border-transparent hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 2 primary actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => exportCensusToCSV(records)}
            disabled={records.length === 0}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>ส่งออก CSV</span>
          </button>
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>บันทึกยอดผู้ป่วย</span>
          </button>
        </div>
      </header>

      {/* Mobile Navigation Strip */}
      <div className="md:hidden bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-2 overflow-x-auto">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.id === 'entry') {
                  setEditingRecord(null);
                }
                setActiveTab(item.id);
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-teal-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Main Content Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-8 py-6 sm:py-8 space-y-8">
        {/* Contextual Page Header & Live Sync Indicator */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-slate-200">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>ตึกผู้ป่วยใน (Inpatient Department)</span>
              <span aria-hidden="true">·</span>
              <span>ประจำวันที่ {formatThaiDate(getTodayDateString(0), true)}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                บันทึกแล้ว {records.length} เวร
              </span>
              {latestModifiedRecord && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-teal-700 font-medium font-mono tabular-nums">
                    แก้ไขล่าสุดเมื่อ {formatUpdatedAt(latestModifiedRecord.updatedAt, true)} (
                    {formatThaiDate(latestModifiedRecord.date)}{' '}
                    {SHIFT_META[latestModifiedRecord.shift]?.label})
                  </span>
                </>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              รายงานยอดผู้ป่วย - ตึกผู้ป่วยใน โรงพยาบาลองครักษ์
            </h1>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-end">
            <span className="text-[11px] text-slate-500 font-mono tabular-nums hidden lg:inline">
              ซิงค์อัตโนมัติ: {formatUpdatedAt(lastSyncedAt, true)}
            </span>
            <button
              type="button"
              onClick={() => loadRecords(false)}
              disabled={isLoading || isSyncing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors whitespace-nowrap cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  isLoading || isSyncing ? 'animate-spin text-teal-600' : ''
                }`}
              />
              <span>อัปเดตข้อมูลล่าสุด</span>
            </button>
          </div>
        </div>

        {/* Notification Toast */}
        {notification && (
          <div
            className={`px-4 py-3 rounded-lg border text-xs font-medium flex items-center justify-between gap-3 ${
              notification.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-teal-50 border-teal-200 text-teal-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
              <span>{notification.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotification(null)}
              className="text-slate-500 hover:text-slate-800 text-xs underline cursor-pointer"
            >
              ปิด
            </button>
          </div>
        )}

        {/* Tab 1: Overview (Latest Shift Summary + LINE Summary Generator + Recent Records Table) */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            <LatestShiftOverview
              records={records}
              selectedRecord={selectedOverviewRecord}
              onSelectRecord={setSelectedOverviewRecord}
              onEditRecord={handleOpenEditModal}
              onCreateNew={handleOpenCreateModal}
              onOpenLineGenerator={(rec) => setLineModalRecord(rec)}
            />

            {/* Embedded LINE Shift Summary Generator Card */}
            {activeLineRecord && (
              <LineReportGenerator
                record={activeLineRecord}
                allRecords={records}
                onSelectRecord={setSelectedOverviewRecord}
                onCopied={(msg) => showToast(msg)}
              />
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">
                  ตารางรายการบันทึกยอดผู้ป่วยรายเวร
                </h2>
                {records.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('analytics')}
                    className="text-xs font-medium text-teal-700 hover:text-teal-800 hover:underline cursor-pointer"
                  >
                    ดูกราฟวิเคราะห์แนวโน้ม →
                  </button>
                )}
              </div>
              <CensusRecordsTable
                records={records}
                isLoading={isLoading}
                onEdit={handleOpenEditModal}
                onDelete={handleDeleteRecord}
                onCreateNew={handleOpenCreateModal}
                onOpenLineGenerator={(rec) => setLineModalRecord(rec)}
              />
            </div>
          </div>
        )}

        {/* Tab 2: Dedicated Shift Entry Form */}
        {activeTab === 'entry' && (
          <div className="bg-white border border-slate-200 rounded-lg p-6 sm:p-8">
            <div className="mb-6 pb-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingRecord
                  ? 'แก้ไขรายงานยอดผู้ป่วยประจำเวร'
                  : 'บันทึกยอดผู้ป่วยประจำเวร'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                กรอกข้อมูลยอดผู้ป่วยทั้งหมด การรับใหม่ จำหน่าย ส่งต่อ และการจำแนกประเภทผู้ป่วย 1–5 พร้อมคัดลอกข้อความสรุปส่ง LINE Group
              </p>
            </div>
            <CensusForm
              initialRecord={editingRecord}
              allRecords={records}
              onSave={handleSaveRecord}
              onCancel={() => {
                setEditingRecord(null);
                setActiveTab('overview');
              }}
              isSubmitting={isSubmitting}
            />
          </div>
        )}

        {/* Tab 3: Dedicated LINE Summary Generator View */}
        {activeTab === 'line' && (
          <div className="space-y-6">
            {activeLineRecord ? (
              <LineReportGenerator
                record={activeLineRecord}
                allRecords={records}
                onSelectRecord={setSelectedOverviewRecord}
                onCopied={(msg) => showToast(msg)}
              />
            ) : (
              <div className="p-10 bg-white border border-slate-200 rounded-lg text-center space-y-3">
                <h2 className="text-base font-semibold text-slate-900">
                  ยังไม่มีข้อมูลเวรสำหรับสร้างข้อความสรุปส่ง LINE
                </h2>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  กรุณาบันทึกข้อมูลยอดผู้ป่วยประจำเวรอย่างน้อย 1 รายการ เพื่อสร้างข้อความสรุปยอดผู้ป่วยและคัดลอกส่งใน LINE Group ของตึกผู้ป่วยใน
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleOpenCreateModal}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>บันทึกยอดผู้ป่วยใหม่</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Full History Table */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                ตารางประวัติรายงานยอดผู้ป่วยทั้งหมด
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                ค้นหา กรองตามช่วงเวลาหรือเวรปฏิบัติงาน คัดลอกสรุปเวรส่ง LINE และส่งออกไฟล์ CSV
              </p>
            </div>
            <CensusRecordsTable
              records={records}
              isLoading={isLoading}
              onEdit={handleOpenEditModal}
              onDelete={handleDeleteRecord}
              onCreateNew={handleOpenCreateModal}
              onOpenLineGenerator={(rec) => setLineModalRecord(rec)}
            />
          </div>
        )}

        {/* Tab 5: Analytics & Trends */}
        {activeTab === 'analytics' && (
          <CensusAnalytics
            records={records}
            onSelectRecord={(rec) => {
              setSelectedOverviewRecord(rec);
              setActiveTab('overview');
            }}
          />
        )}
      </main>

      {/* Quiet Clinical Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 px-4 sm:px-8 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div>
            ตึกผู้ป่วยใน (Inpatient Department) · โรงพยาบาลองครักษ์ จังหวัดนครนายก
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="hover:text-slate-800 transition-colors cursor-pointer"
            >
              บันทึกยอดผู้ป่วยประจำเวร
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => exportCensusToCSV(records)}
              disabled={records.length === 0}
              className="hover:text-slate-800 disabled:opacity-50 transition-colors cursor-pointer"
            >
              ดาวน์โหลดรายงาน CSV
            </button>
          </div>
        </div>
      </footer>

      {/* Modal Dialog for Quick Add / Edit Census Record */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[1px] overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-4xl max-h-[92vh] overflow-y-auto p-6 sm:p-8 my-8">
            <CensusForm
              initialRecord={editingRecord}
              allRecords={records}
              onSave={handleSaveRecord}
              onCancel={() => {
                setIsModalOpen(false);
                setEditingRecord(null);
              }}
              isModal={true}
              isSubmitting={isSubmitting}
            />
          </div>
        </div>
      )}

      {/* Modal Dialog for LINE Summary Generator */}
      {lineModalRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[1px] overflow-y-auto">
          <div className="w-full max-w-4xl my-8">
            <LineReportGenerator
              record={lineModalRecord}
              allRecords={records}
              onSelectRecord={setLineModalRecord}
              onClose={() => setLineModalRecord(null)}
              isModal={true}
              onCopied={(msg) => showToast(msg)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
