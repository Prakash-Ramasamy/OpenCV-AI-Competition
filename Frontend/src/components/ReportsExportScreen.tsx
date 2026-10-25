import React, { useState } from 'react';
import { CheckCircle2, Download, FileJson, FileSpreadsheet, FileText } from 'lucide-react';
import { AnnotationRecord, DataSourceMode, SummaryMetrics } from '../types/audit';

interface ReportsExportScreenProps {
  annotations: AnnotationRecord[];
  metrics: SummaryMetrics;
  activeDocumentName: string;
  fullReportTotalPages: number;
  samplePdfFileName: string;
  samplePdfTotalPages: number;
  pagesProcessedCount: number;
  dataSourceMode: DataSourceMode;
  onDownloadJson: () => void;
  onDownloadCsv: () => void;
  onDownloadEvaluationReport: () => void;
}

export const ReportsExportScreen: React.FC<ReportsExportScreenProps> = ({ onDownloadJson, onDownloadCsv, onDownloadEvaluationReport }) => {
  const [lastExportAction, setLastExportAction] = useState<string | null>(null);
  const notice = (message: string, action: () => void) => { action(); setLastExportAction(message); };
  return <div className="space-y-6">
    {lastExportAction && <div role="status" className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 flex items-center justify-between text-xs text-emerald-900"><span className="flex items-center gap-2 font-medium"><CheckCircle2 className="w-4 h-4 text-emerald-600" />{lastExportAction}</span><button type="button" onClick={() => setLastExportAction(null)} className="text-emerald-800 underline font-semibold">Dismiss</button></div>}
    <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
      <div><h3 className="text-base font-bold text-[#0F172A] font-display">Export Review Deliverables</h3><p className="text-xs text-slate-500 mt-0.5">Download Detection JSON, Review Results CSV, and Evaluation Report from the active dataset</p></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
        <ExportCard icon={<FileJson className="w-5 h-5 text-blue-600" />} title="Detection JSON" description="Complete machine-readable payload containing bounding boxes, page indexes, and review states." button="Download Detection JSON" onClick={() => notice('Detection JSON downloaded.', onDownloadJson)} tone="primary" />
        <ExportCard icon={<FileSpreadsheet className="w-5 h-5 text-emerald-600" />} title="Review Results CSV" description="Spreadsheet workpaper log with page indexes, detection details, and review comments." button="Download Review CSV" onClick={() => notice('Review Results CSV downloaded.', onDownloadCsv)} tone="dark" />
        <ExportCard icon={<FileText className="w-5 h-5 text-teal-600" />} title="Evaluation Report" description="Formatted text audit dossier summarizing review completion and finding dispositions." button="Download Evaluation Report" onClick={() => notice('Evaluation Report downloaded.', onDownloadEvaluationReport)} tone="light" />
      </div>
    </div>
  </div>;
};

function ExportCard({ icon, title, description, button, onClick, tone }: { icon: React.ReactNode; title: string; description: string; button: string; onClick: () => void; tone: 'primary' | 'dark' | 'light' }) {
  const buttonClass = 'bg-slate-900 hover:bg-slate-800 text-white';
  return <div className="border border-slate-200 rounded-lg p-4 flex flex-col justify-between bg-slate-50/40"><div><div className="flex items-center justify-between mb-2">{icon}<span className="text-[11px] font-mono text-emerald-700 font-semibold">Ready to Download</span></div><div className="text-sm font-bold text-slate-900">{title}</div><p className="text-xs text-slate-500 mt-1">{description}</p></div><button type="button" onClick={onClick} className={`mt-4 w-full px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${buttonClass}`}><Download className="w-3.5 h-3.5" />{button}</button></div>;
}
