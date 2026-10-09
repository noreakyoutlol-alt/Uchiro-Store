import React, { useState } from 'react';
import {
  Download,
  Upload,
  Database,
  FileCheck,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  FileCode,
  Layers,
  Boxes,
  Gift,
  Tag,
  Settings,
} from 'lucide-react';
import { AdminAPI } from '../services/api';
import { BackupBundle } from '../types';

interface BackupPageProps {
  onRefreshAll?: () => void;
}

export const BackupPage: React.FC<BackupPageProps> = ({ onRefreshAll }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [exportedData, setExportedData] = useState<BackupBundle | null>(null);

  // Restore state
  const [jsonInput, setJsonInput] = useState('');
  const [parsedBundle, setParsedBundle] = useState<any | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [restoreResult, setRestoreResult] = useState<any | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const data = await AdminAPI.getBackup();
      setExportedData(data);

      // Create download blob
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      link.href = url;
      link.download = `uchiro-store-backup-${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to export backup bundle');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setJsonInput(text);
      validateJson(text);
    };
    reader.readAsText(file);
  };

  const validateJson = (raw: string) => {
    setParseError(null);
    setParsedBundle(null);
    setRestoreResult(null);

    if (!raw.trim()) return;

    try {
      const parsed = JSON.parse(raw);
      if (!parsed.version || !parsed.store_brand?.includes('Uchiro')) {
        setParseError('File does not match Uchiro Store Backup specification (missing version or brand header)');
        return;
      }
      setParsedBundle(parsed);
    } catch (err: any) {
      setParseError(`Invalid JSON syntax: ${err.message}`);
    }
  };

  const handleRestore = async () => {
    if (!parsedBundle) return;

    const confirmed = window.confirm(
      '⚠️ WARNING: Restoring this backup will merge or overwrite current store categories, products, gacha prizes, and system settings. Do you wish to continue?'
    );
    if (!confirmed) return;

    setIsImporting(true);
    try {
      const res = await AdminAPI.restoreBackup(parsedBundle);
      if (res.success) {
        setRestoreResult(res.summary || res);
        alert('Backup successfully restored to database!');
        if (onRefreshAll) onRefreshAll();
      } else {
        alert(res.error || 'Failed to restore backup');
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to execute backup restore');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-black text-white tracking-wide flex items-center gap-2">
          <Database className="w-5 h-5 text-indigo-400" />
          <span>DATA BACKUP & SYSTEM RESTORATION</span>
        </h2>
        <p className="text-xs text-slate-400">
          Export your entire catalog, gacha pools, active coupons, and settings as JSON or restore from an existing archive.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Export Card */}
        <div className="bg-[#111622] border border-white/10 rounded-2xl p-5 space-y-4 shadow-xl flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Export Full Store Backup</h3>
                <p className="text-[11px] text-slate-400">
                  Generate a downloadable JSON bundle of products, pools, prizes, and configs.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-2 text-xs text-slate-300">
              <div className="flex items-center gap-2 text-indigo-300 font-bold text-[11px]">
                <FileCheck className="w-4 h-4" />
                <span>Bundle Contents:</span>
              </div>
              <ul className="space-y-1 text-slate-400 text-[11px] list-disc list-inside">
                <li>Catalog Categories & Product listings</li>
                <li>Gacha Pools & 100% Probability Prize Wheels</li>
                <li>Active Store Coupons & Discount rules</li>
                <li>Global Store & Loyalty Settings</li>
              </ul>
            </div>
          </div>

          <button
            onClick={handleExport}
            disabled={isExporting}
            className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/30"
          >
            {isExporting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>Export & Download Archive (.json)</span>
          </button>
        </div>

        {/* Import & Restore Card */}
        <div className="bg-[#111622] border border-white/10 rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Restore from Backup Archive</h3>
              <p className="text-[11px] text-slate-400">
                Upload or paste a previously exported JSON backup bundle.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1.5">
                Upload Backup File
              </label>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleFileSelect}
                className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-purple-600/20 file:text-purple-300 hover:file:bg-purple-600/30 cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1.5">
                Or Paste JSON Content
              </label>
              <textarea
                value={jsonInput}
                onChange={(e) => {
                  setJsonInput(e.target.value);
                  validateJson(e.target.value);
                }}
                placeholder='{"version": "3.0.0", "store_brand": "Uchiro Store", ...}'
                rows={3}
                className="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white font-mono text-[10px] placeholder:text-slate-600 focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Validation Error */}
            {parseError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{parseError}</span>
              </div>
            )}

            {/* Parsed Preview */}
            {parsedBundle && !parseError && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-2">
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Valid Uchiro Store Backup Bundle</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 pt-1">
                  <div>Products: <b>{parsedBundle.products?.length || 0}</b></div>
                  <div>Gacha Prizes: <b>{parsedBundle.gacha_prizes?.length || 0}</b></div>
                  <div>Coupons: <b>{parsedBundle.coupons?.length || 0}</b></div>
                  <div>Exported: <b>{parsedBundle.exported_at?.slice(0, 10) || 'N/A'}</b></div>
                </div>

                <button
                  onClick={handleRestore}
                  disabled={isImporting}
                  className="w-full mt-2 py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-600/30"
                >
                  {isImporting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  <span>Confirm Restore to Database</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
