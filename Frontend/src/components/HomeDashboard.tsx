import React from 'react';
import {
  UploadCloud,
  FileText,
  AlertTriangle,
  ScanLine,
  Loader2,
} from 'lucide-react';
import {
  AuditDocument,
  DataSourceMode,
  ReviewerActivity,
  ScreenId,
  SummaryMetrics,
} from '../types/audit';

interface HomeDashboardProps {
  documents: AuditDocument[];
  activities: ReviewerActivity[];
  metrics: SummaryMetrics;
  dataSourceMode: DataSourceMode;
  onNavigate: (screen: ScreenId) => void;
  onSelectDocument: (doc: AuditDocument) => void;
  onInspectAnnotation: (annotationId: string) => void;
  isLoading: boolean;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  documents,
  activities,
  metrics,
  dataSourceMode,
  onNavigate,
  onSelectDocument,
  onInspectAnnotation,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-10 text-center space-y-3">
        <Loader2 className="w-8 h-8 mx-auto text-[#2563EB] animate-spin" />
        <h2 className="text-lg font-semibold text-slate-900">Loading reports</h2>
        <p className="text-sm text-slate-600">Reading report metadata from the backend.</p>
      </div>
    );
  }

  const activeDoc = documents[0];
  if (!activeDoc) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-8 text-center space-y-3">
        <AlertTriangle className="w-8 h-8 mx-auto text-amber-600" />
        <h2 className="text-lg font-semibold text-slate-900">No reports available</h2>
        <p className="text-sm text-slate-600">Upload an audit document to create a report. Findings will appear after you open that report.</p>
        <button type="button" onClick={() => onNavigate('upload')} className="px-4 py-2 rounded-lg bg-[#2563EB] text-white text-sm font-semibold">Upload Audit Document</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {false && <>
      {/* Top Banner / Demonstration Notice & Primary Workflow CTAs */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-medium text-teal-700 flex items-center gap-1.5">
            <ScanLine className="w-3.5 h-3.5" />
            <span>
              {dataSourceMode === 'real-opencv'
                ? 'Active Dataset: Real OpenCV Detection Output'
                : 'Demonstration Data Mode · Synthetic Sample Detections'}
            </span>
          </div>
          <h2 className="text-xl font-bold text-[#0F172A] font-display">
            FY 2024–25 Consolidated Financial Statement Review
          </h2>
          <p className="text-sm text-slate-600 max-w-2xl">
            Active audit document: <span className="font-mono font-semibold text-slate-800">{activeDoc.fullReportFileName}</span> ({activeDoc.fullReportTotalPages} pages). Open individual findings from the Review Results grid to inspect PDF overlays and record review decisions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('upload')}
            className="px-4 py-2.5 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-sm font-semibold transition-colors flex items-center gap-2 whitespace-nowrap shadow-xs"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload Audit Document</span>
          </button>
        </div>
      </div>

      {/* Prominent Active Document & Page Structure Strip */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex items-center justify-between gap-3 md:border-r border-slate-200 md:pr-4 min-w-0">
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-slate-500">
              Full Annual Report PDF
            </div>
            <div className="text-xs font-semibold text-slate-900 font-mono truncate mt-0.5">
              {activeDoc.fullReportFileName}
            </div>
          </div>
          <div className="text-right font-mono tabular-nums shrink-0">
            <span className="text-lg font-bold text-[#0F172A]">
              {activeDoc.fullReportTotalPages}
            </span>
            <span className="text-xs text-slate-500 ml-1">pages</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 md:border-r border-slate-200 md:pr-4 min-w-0">
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-slate-500">
              Selected-Page Sample PDF (pp. 222–226)
            </div>
            <div className="text-xs font-semibold text-slate-900 font-mono truncate mt-0.5">
              {activeDoc.samplePdfFileName}
            </div>
          </div>
          <div className="text-right font-mono tabular-nums shrink-0">
            <span className="text-lg font-bold text-[#0F172A]">
              {activeDoc.samplePdfTotalPages}
            </span>
            <span className="text-xs text-slate-500 ml-1">pages</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 min-w-0">
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-slate-500">
              Actual Pages Processed
            </div>
            <div className="text-xs text-teal-700 font-medium truncate mt-0.5">
              Rendered Images Index 1–{activeDoc.pagesProcessedCount}
            </div>
          </div>
          <div className="text-right font-mono tabular-nums shrink-0">
            <span className="text-lg font-bold text-teal-700">
              {activeDoc.pagesProcessedCount}
            </span>
            <span className="text-xs text-slate-500 ml-1">processed</span>
          </div>
        </div>
      </div>

      </>}

      {/* Report-level KPI cards. Finding and review counts are shown after opening a report. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-500">
            Total Reports
          </div>
          <div className="mt-2 text-2xl font-bold text-[#0F172A] font-mono tabular-nums">
            {documents.length}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">Uploaded and available for review</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-medium text-teal-700">Processed Reports</div>
          <div className="mt-2 text-2xl font-bold text-amber-700 font-mono tabular-nums">
            {documents.filter((doc) => doc.pagesProcessedCount > 0).length}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">Ready to open</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-medium text-blue-700">Reports with Findings</div>
          <div className="mt-2 text-2xl font-bold text-blue-700 font-mono tabular-nums">
            {documents.filter((doc) => (doc.detectionCount ?? 0) > 0).length}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">Detection totals appear in each row</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-medium text-amber-700">Reports Awaiting Review</div>
          <div className="mt-2 text-2xl font-bold text-amber-700 font-mono tabular-nums">
            {documents.filter((doc) => doc.status === 'In Review').length}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">Open a report to review findings</div>
        </div>
      </div>

      {/* Full-width report registry. Open Review from the selected report row. */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Active Document Registry & Derived Category Totals */}
        <div className="lg:col-span-12 bg-white border border-slate-200 rounded-lg flex flex-col justify-between">
          <div>
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#0F172A] font-display">
                  Active Audit Document & Detection Breakdown
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {dataSourceMode === 'real-opencv'
                    ? 'Derived from imported OpenCV detection JSON'
                    : 'Demonstration Data — Full Report (369 pp), Sample PDF (5 pp, pp. 222–226), and Processed Pages'}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                    <th className="py-2.5 pl-4 pr-2">Active Document / Sample PDF</th>
                    <th className="py-2.5 px-2 text-right whitespace-nowrap">Full Report</th>
                    <th className="py-2.5 px-2 text-right whitespace-nowrap">Sample PDF</th>
                    <th className="py-2.5 px-2 text-right whitespace-nowrap">Processed</th>
                    <th className="py-2.5 px-2 text-right whitespace-nowrap">Detections</th>
                    <th className="py-2.5 px-2 whitespace-nowrap">Data Mode</th>
                    <th className="py-2.5 pl-2 pr-4 text-right whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {documents.map((doc) => (
                    <tr
                      key={doc.id}
                      className="hover:bg-slate-50/90 transition-colors"
                    >
                      <td className="py-3.5 pl-4 pr-2 max-w-[230px]">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 truncate font-mono">
                              {doc.fullReportFileName}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">
                              Sample: {doc.samplePdfFileName} (pp. 222–226)
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-2 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {doc.fullReportTotalPages} pp
                      </td>
                      <td className="py-3.5 px-2 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {doc.samplePdfTotalPages} pp
                      </td>
                      <td className="py-3.5 px-2 text-right font-mono tabular-nums font-semibold text-teal-700 whitespace-nowrap">
                        {doc.pagesProcessedCount} pp
                      </td>
                      <td className="py-3.5 px-2 text-right font-mono tabular-nums font-semibold text-slate-700 whitespace-nowrap">
                        {doc.detectionCount ?? (doc.dataSource === 'demo-mock' ? metrics.totalAnnotations : '—')}
                      </td>
                      <td className="py-3.5 px-2 whitespace-nowrap">
                        <span className="font-medium text-amber-700">
                          {doc.dataSource === 'real-opencv'
                            ? 'OpenCV JSON'
                            : 'Demo Data'}
                        </span>
                      </td>
                      <td className="py-3.5 pl-2 pr-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            onSelectDocument(doc);
                            onNavigate('review-results');
                          }}
                          className="px-2.5 py-1 rounded-md border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Findings are intentionally loaded on the Review page for the selected report. */}
            <div className="p-4 border-t border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800">
                  Detection details
                </span>
                <span className="text-slate-500">Open Review to inspect categories</span>
              </div>
            </div>
          </div>

          <div className="px-5 py-3 bg-slate-50/60 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>
              Original Report pp. 222–226 mapped to Sample PDF idx 1–5 & Rendered Image idx 1–5
            </span>
          </div>
        </div>

        {/* Recent Reviewer Activity Feed (5 cols) */}
        <div className="hidden lg:col-span-5 bg-white border border-slate-200 rounded-lg flex flex-col justify-between">
          <div>
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#0F172A] font-display">
                  Recent Reviewer Activity
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Audit trail of decisions and uploads ({dataSourceMode === 'real-opencv' ? 'Active Session' : 'Demonstration Data'})
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('reports')}
                className="text-xs font-semibold text-blue-600 hover:underline"
              >
                Export Reports
              </button>
            </div>

            <div className="divide-y divide-slate-200">
              {activities.slice(0, 4).map((act) => (
                <div
                  key={act.id}
                  className="px-5 py-3 flex items-start justify-between gap-2 hover:bg-slate-50/70 transition-colors"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5 text-xs flex-wrap">
                      <span
                        className={`font-semibold ${
                          act.action === 'Approved'
                            ? 'text-emerald-700'
                            : act.action === 'Rejected'
                            ? 'text-red-700'
                            : act.action === 'Needs Investigation'
                            ? 'text-amber-700'
                            : 'text-blue-700'
                        }`}
                      >
                        {act.action}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="font-medium text-slate-800 truncate">
                        {act.targetDescription}
                      </span>
                    </div>
                    {act.comment && (
                      <p className="text-[11px] text-slate-500 truncate">
                        "{act.comment}"
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {act.annotationId && (
                      <button
                        type="button"
                        onClick={() => onInspectAnnotation(act.annotationId!)}
                        className="text-xs font-mono font-medium text-blue-600 hover:underline"
                      >
                        {act.annotationId}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="px-5 py-3 bg-slate-50/60 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>Consistent workflow states: Pending · Approved · Rejected · Needs Investigation</span>
          </div>
        </div>
      </div>
    </div>
  );
};
