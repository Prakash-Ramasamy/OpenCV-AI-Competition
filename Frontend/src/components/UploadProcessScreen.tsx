import React, { useRef, useState } from 'react';
import { AlertCircle, FileText, Play, UploadCloud } from 'lucide-react';
import { AnnotationType, DataSourceMode } from '../types/audit';
import { BackendUploadResponse } from '../services/backendApi';

interface Props {
  selectedDetectionTypes: Record<AnnotationType, boolean>;
  dataSourceMode: DataSourceMode;
  onToggleDetectionType: (type: AnnotationType) => void;
  onSelectAllDetectionTypes: (enabled: boolean) => void;
  onImportOpenCvJson: (jsonText: string) => { valid: boolean; error?: string };
  onRestoreDemoMode: () => void;
  onUploadPdf: (file: File) => Promise<BackendUploadResponse>;
  onStartProcessing: (upload: BackendUploadResponse, pageIndexes: number[], types: AnnotationType[]) => Promise<void>;
}

const options: { type: AnnotationType; label: string }[] = [
  { type: 'Circle', label: 'Circles' }, { type: 'Highlight', label: 'Highlights' }, { type: 'Tick', label: 'Ticks' },
  { type: 'Cross', label: 'Crosses' }, { type: 'Underline', label: 'Underlines' }, { type: 'Arrow', label: 'Arrows' },
  { type: 'Signature', label: 'Signatures (not currently supported)' }, { type: 'Stamp', label: 'Stamps (not currently supported)' },
];
const parseIndexes = (value: string, max: number): number[] | null => {
  const indexes = new Set<number>();
  for (const part of value.split(',').map((item) => item.trim()).filter(Boolean)) {
    const range = part.match(/^(\d+)(?:-(\d+))?$/); if (!range) return null;
    const start = Number(range[1]); const end = Number(range[2] || range[1]);
    if (start < 1 || end < start || end > max) return null;
    for (let index = start; index <= end; index += 1) indexes.add(index);
  }
  return indexes.size && indexes.size <= 5 ? [...indexes].sort((a, b) => a - b) : null;
};

export const UploadProcessScreen: React.FC<Props> = ({ selectedDetectionTypes, onToggleDetectionType, onSelectAllDetectionTypes, onUploadPdf, onStartProcessing }) => {
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null); const [upload, setUpload] = useState<BackendUploadResponse | null>(null);
  const [pageInput, setPageInput] = useState('1'); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const selectFile = (next?: File) => { if (!next) return; setFile(next); setUpload(null); setPageInput('1'); setError(next.name.toLowerCase().endsWith('.pdf') ? null : 'Please select a PDF file.'); };
  const uploadFile = async () => { if (!file) return setError('Select a PDF before uploading.'); setBusy(true); setError(null); try { const result = await onUploadPdf(file); setUpload(result); setPageInput(`1${result.page_count > 1 ? `-${Math.min(5, result.page_count)}` : ''}`); } catch (err) { setError(err instanceof Error ? err.message : 'Upload failed.'); } finally { setBusy(false); } };
  const start = async (event: React.FormEvent) => { event.preventDefault(); if (!upload) return setError('Upload the PDF first.'); const pages = parseIndexes(pageInput, upload.page_count); if (!pages) return setError(`Use valid page indexes within 1-${upload.page_count}; at most 5 pages.`); const types = options.filter((option) => selectedDetectionTypes[option.type] && !['Signature', 'Stamp'].includes(option.type)).map((option) => option.type); if (!types.length) return setError('Select at least one supported category.'); setBusy(true); setError(null); try { await onStartProcessing(upload, pages, types); } catch (err) { setError(err instanceof Error ? err.message : 'Processing failed.'); } finally { setBusy(false); } };
  return <form onSubmit={start} className="space-y-6 max-w-5xl mx-auto"><div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4"><div><h2 className="text-base font-bold text-slate-900">Upload a PDF for real OpenCV processing</h2><p className="text-xs text-slate-500 mt-1">This path calls the local FastAPI service.</p></div><input ref={fileInput} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event) => selectFile(event.target.files?.[0])} /><div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center"><UploadCloud className="w-7 h-7 mx-auto text-blue-600 mb-2" /><p className="text-sm font-semibold">Select an audited PDF</p><p className="text-xs text-slate-500 mt-1">Backend limit: 25 MB, 50 pages uploaded, 5 pages processed per request.</p><button type="button" onClick={() => fileInput.current?.click()} className="mt-4 px-4 py-2 bg-slate-900 text-white rounded text-xs font-semibold">Browse PDF</button></div>{file && <div className="p-3 border rounded bg-slate-50 flex justify-between items-center"><div><FileText className="w-4 h-4 inline mr-2" /><span className="font-mono text-xs">{file.name}</span><span className="ml-2 text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(1)} MB</span>{upload && <div className="text-xs text-teal-700 mt-1">Uploaded: ID {upload.document_id} · {upload.page_count} PDF pages</div>}</div><button type="button" onClick={uploadFile} disabled={busy} className="px-3 py-1.5 rounded bg-blue-600 text-white text-xs disabled:opacity-50">{upload ? 'Re-upload' : 'Upload to API'}</button></div>}</div>{upload && <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4"><div><h2 className="text-base font-bold text-slate-900">Select pages and detection categories</h2><p className="text-xs text-slate-500">Page indexes are 1-based indexes in this uploaded PDF.</p></div><label className="block text-xs font-semibold">Pages to process<input value={pageInput} onChange={(event) => setPageInput(event.target.value)} className="block w-full mt-1 px-3 py-2 border rounded font-mono" /></label><div className="grid sm:grid-cols-2 gap-2">{options.map((option) => <label key={option.type} className={`text-xs p-2 border rounded ${['Signature', 'Stamp'].includes(option.type) ? 'text-slate-500' : ''}`}><input type="checkbox" checked={selectedDetectionTypes[option.type]} disabled={['Signature', 'Stamp'].includes(option.type)} onChange={() => onToggleDetectionType(option.type)} className="mr-2" />{option.label}</label>)}</div><div className="flex gap-3"><button type="button" onClick={() => onSelectAllDetectionTypes(true)} className="text-xs underline">Select all</button><button type="button" onClick={() => onSelectAllDetectionTypes(false)} className="text-xs underline">Clear</button></div></div>}{error && <div role="alert" className="p-3 border border-red-200 bg-red-50 text-red-800 text-xs rounded"><AlertCircle className="w-4 h-4 inline mr-2" />{error}</div>}<div className="flex justify-end"><button type="submit" disabled={!upload || busy} className="px-5 py-2.5 bg-[#2563EB] text-white rounded-lg text-sm font-semibold disabled:opacity-50"><Play className="w-4 h-4 inline mr-2" />{busy ? 'Working…' : 'Start Processing'}</button></div></form>;
};
