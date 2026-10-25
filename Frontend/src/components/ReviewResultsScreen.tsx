import React, { useRef, useState } from 'react';
import {
  Search,
  Download,
  Eye,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  FileSearch,
  ChevronDown,
  ChevronUp,
  FileJson,
} from 'lucide-react';
import {
  AnnotationFilters,
  AnnotationRecord,
  AnnotationType,
  DataSourceMode,
  ReviewStatus,
  SummaryMetrics,
} from '../types/audit';
import { FINANCIAL_STATEMENT_PAGES } from '../data/mockAuditData';
import { getActiveAnnotationTypes } from '../utils/auditLogic';

const CATEGORY_PLURAL_LABELS: Record<AnnotationType, string> = {
  Circle: 'Circles',
  Highlight: 'Highlights',
  Tick: 'Ticks',
  Cross: 'Crosses',
  Underline: 'Underlines',
  Arrow: 'Arrows',
  Signature: 'Signatures',
  Stamp: 'Stamps',
};

interface ReviewResultsScreenProps {
  annotations: AnnotationRecord[];
  filteredAnnotations: AnnotationRecord[];
  metrics: SummaryMetrics;
  filters: AnnotationFilters;
  dataSourceMode: DataSourceMode;
  activeDocumentName: string;
  fullReportTotalPages: number;
  samplePdfFileName: string;
  samplePdfTotalPages: number;
  pagesProcessedCount: number;
  onUpdateFilters: (next: Partial<AnnotationFilters>) => void;
  onResetFilters: () => void;
  onSelectPageInViewer: (samplePageNumber: number) => void;
  onInspectAnnotation: (annotationId: string) => void;
  onBulkUpdateStatus: (ids: string[], status: ReviewStatus) => void | Promise<void>;
  onDownloadJson: () => void;
  onExportCsv: () => void;
  onImportOpenCvJson: (jsonText: string) => { valid: boolean; error?: string };
  onRestoreDemoMode: () => void;
  compactDensity: boolean;
  showOriginalPageNumbers: boolean;
}

export const ReviewResultsScreen: React.FC<ReviewResultsScreenProps> = ({
  annotations,
  filteredAnnotations,
  metrics,
  filters,
  dataSourceMode,
  activeDocumentName,
  fullReportTotalPages,
  samplePdfFileName,
  samplePdfTotalPages,
  pagesProcessedCount,
  onUpdateFilters,
  onResetFilters,
  onSelectPageInViewer,
  onInspectAnnotation,
  onBulkUpdateStatus,
  onDownloadJson,
  onExportCsv,
  onImportOpenCvJson,
  onRestoreDemoMode,
  compactDensity,
  showOriginalPageNumbers,
}) => {
  const openCvInputRef = useRef<HTMLInputElement | null>(null);
  const [thumbnailsExpanded, setThumbnailsExpanded] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  const [importError, setImportError] = useState<string | null>(null);

  const samplePages = dataSourceMode === 'real-opencv'
    ? [...new Set(annotations.map((annotation) => annotation.samplePageNumber))].sort((a, b) => a - b)
    : [4, 5, 6, 7, 8];
  const activeCategoryTypes = getActiveAnnotationTypes(metrics.byType);

  const summaryCards: {
    label: string;
    value: number;
    filterType?: AnnotationType;
    filterStatus?: ReviewStatus;
    tone?: string;
  }[] = [
    { label: 'Total Detected', value: metrics.totalAnnotations },
    ...activeCategoryTypes.map((type) => ({
      label: CATEGORY_PLURAL_LABELS[type] ?? type,
      value: metrics.byType[type] ?? 0,
      filterType: type,
    })),
    {
      label: 'Pending Reviews',
      value: metrics.pendingCount,
      filterStatus: 'Pending',
      tone: 'text-amber-700',
    },
  ];

  const totalFiltered = filteredAnnotations.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / rowsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * rowsPerPage;
  const paginatedRows = filteredAnnotations.slice(
    startIndex,
    startIndex + rowsPerPage
  );

  const allVisibleSelected =
    paginatedRows.length > 0 &&
    paginatedRows.every((row) => selectedIds.includes(row.id));

  const handleToggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      const visibleSet = new Set(paginatedRows.map((r) => r.id));
      setSelectedIds((prev) => prev.filter((id) => !visibleSet.has(id)));
    } else {
      const next = new Set(selectedIds);
      paginatedRows.forEach((r) => next.add(r.id));
      setSelectedIds(Array.from(next));
    }
  };

  const handleToggleRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBulkAction = (status: ReviewStatus) => {
    if (selectedIds.length === 0) return;
    void onBulkUpdateStatus(selectedIds, status);
    setSelectedIds([]);
  };

  const handleOpenCvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const res = onImportOpenCvJson(String(reader.result ?? ''));
      if (!res.valid) {
        setImportError(res.error ?? 'Invalid JSON');
      } else {
        setImportError(null);
      }
    };
    reader.readAsText(file);
  };

  const cellPadding = compactDensity ? 'py-2 px-2.5' : 'py-3 px-2.5';

  return (
    <div className="space-y-4">
      {/* Top Document Scope & Export Header */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium text-teal-700">
            <span>
              {dataSourceMode === 'real-opencv'
                ? 'Real OpenCV Detection Output'
                : 'Demonstration Data Only · Sample Statistics'}
            </span>
            <span>·</span>
            <span className="font-mono text-slate-600 tabular-nums">
              Approved: {metrics.approvedCount} · Pending: {metrics.pendingCount} · Rejected: {metrics.rejectedCount} · Needs Investigation: {metrics.needsInvestigationCount}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-slate-700 tabular-nums">
            <span>
              <strong className="font-sans text-slate-900">Full Report:</strong>{' '}
              {activeDocumentName} ({fullReportTotalPages} pages)
            </span>
            <span className="text-slate-300">|</span>
            <span>
              <strong className="font-sans text-slate-900">Sample PDF:</strong>{' '}
              {samplePdfFileName} ({samplePdfTotalPages} pages)
            </span>
            <span className="text-slate-300">|</span>
            <span>
              <strong className="font-sans text-teal-800">Pages Processed:</strong>{' '}
              {pagesProcessedCount} pages (Report pp. 222–226)
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <input
            ref={openCvInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleOpenCvFile}
            className="hidden"
            aria-label="Load Real OpenCV Detection JSON"
          />
          <button
            type="button"
            onClick={() => openCvInputRef.current?.click()}
            className="px-3 py-1.5 rounded-lg border border-teal-600/40 bg-teal-50/50 text-teal-900 hover:bg-teal-100/60 text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <FileJson className="w-3.5 h-3.5" />
            <span>Load OpenCV JSON</span>
          </button>
          <button
            type="button"
            onClick={onDownloadJson}
            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download JSON</span>
          </button>
          <button
            type="button"
            onClick={onExportCsv}
            className="px-3.5 py-1.5 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {importError && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-xs text-red-800 flex items-center justify-between"
        >
          <span>{importError}</span>
          <button
            type="button"
            onClick={() => setImportError(null)}
            className="underline font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 1. Compact Summary Cards at the Top */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        {summaryCards.map((card) => {
          const isActiveFilter =
            (card.filterType && filters.annotationType === card.filterType) ||
            (card.filterStatus && filters.status === card.filterStatus);

          return (
            <button
              key={card.label}
              type="button"
              onClick={() => {
                setCurrentPage(1);
                if (card.filterType) {
                  onUpdateFilters({
                    annotationType:
                      filters.annotationType === card.filterType ? 'All' : card.filterType,
                  });
                } else if (card.filterStatus) {
                  onUpdateFilters({
                    status: filters.status === card.filterStatus ? 'All' : card.filterStatus,
                  });
                } else {
                  onResetFilters();
                }
              }}
              className={`text-left bg-white border rounded-lg px-3 py-2.5 transition-colors ${
                isActiveFilter
                  ? 'border-blue-600 bg-blue-50/20'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="text-[11px] font-medium text-slate-500 truncate">
                {card.label}
              </div>
              <div
                className={`text-lg font-bold font-mono tabular-nums mt-0.5 ${
                  card.tone ?? 'text-[#0F172A]'
                }`}
              >
                {card.value}
              </div>
            </button>
          );
        })}
      </div>

      {/* 2. Collapsible / Optional Page Thumbnails Drawer */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-slate-800">
              Processed Page Thumbnails ({pagesProcessedCount} Pages)
            </span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-500">
              Original Report pp. 222–226 mapped to Sample PDF idx 1–5 & Rendered Image idx 1–5
            </span>
          </div>
          <button
            type="button"
            aria-expanded={thumbnailsExpanded}
            onClick={() => setThumbnailsExpanded((prev) => !prev)}
            className="px-3 py-1 rounded-md border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 transition-colors"
          >
            <span>
              {thumbnailsExpanded ? 'Hide Page Thumbnails' : 'Show Page Thumbnails'}
            </span>
            {thumbnailsExpanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {thumbnailsExpanded && (
          <div className="p-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {samplePages.map((pageNum) => {
              const pageData = FINANCIAL_STATEMENT_PAGES[pageNum];
              const pageAnnotations = annotations.filter(
                (a) => a.samplePageNumber === pageNum
              );
              const pageStats = metrics.byPage[pageNum] ?? {
                total: 0,
                pending: 0,
                approved: 0,
                rejected: 0,
                needsInvestigation: 0,
              };

              return (
                <div
                  key={pageNum}
                  className="border border-slate-200 rounded-lg bg-slate-50/50 hover:border-blue-500 transition-colors flex flex-col justify-between p-3"
                >
                  <div>
                    <div className="flex items-center justify-between text-[11px] mb-1.5 font-mono tabular-nums">
                      <span className="font-bold text-slate-900">
                        Report p.{pageData?.originalReportPageNumber}
                      </span>
                      <span className="font-semibold text-teal-700">
                        {pageStats.total} marks
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 mb-2 tabular-nums">
                      Sample PDF idx: {pageData?.samplePdfPageIndex} · Render idx:{' '}
                      {pageData?.renderedImagePageIndex}
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelectPageInViewer(pageNum)}
                      aria-label={`Open Report Page ${pageData?.originalReportPageNumber} in Annotation Detail Viewer`}
                      className="w-full text-left bg-white border border-slate-200 rounded-md p-2.5 shadow-2xs hover:border-blue-400 transition-colors flex flex-col justify-between group"
                    >
                      <div>
                        <div className="text-[10px] font-bold text-slate-800 truncate">
                          {pageData?.statementTitle}
                        </div>
                        <div className="space-y-1 my-2">
                          {pageData?.lineItems.slice(0, 3).map((line, idx) => {
                            const matchingAnn = pageAnnotations[idx];
                            return (
                              <div
                                key={line.id}
                                className="flex items-center justify-between text-[9px] px-1 py-0.5"
                              >
                                <span className="text-slate-600 truncate max-w-[65%]">
                                  {line.particulars}
                                </span>
                                <span
                                  className={`font-mono tabular-nums ${
                                    matchingAnn?.annotationType === 'Circle'
                                      ? 'border border-red-500 rounded-full px-1 text-red-700 font-bold'
                                      : 'text-slate-700'
                                  }`}
                                >
                                  {line.currentPeriod || '—'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-blue-600 font-semibold group-hover:underline">
                        <span>Open Page in Viewer</span>
                        <FileSearch className="w-3 h-3 shrink-0" />
                      </div>
                    </button>
                  </div>

                  <div className="mt-2 pt-1.5 border-t border-slate-200/80 flex items-center justify-between text-[10px] text-slate-500 font-mono tabular-nums">
                    <span className="text-amber-700">{pageStats.pending} pending</span>
                    <span>·</span>
                    <span className="text-emerald-700">{pageStats.approved} appr</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Filters Bar Below */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          <div className="lg:col-span-2">
            <label
              htmlFor="grid-search"
              className="block text-[11px] font-semibold text-slate-600 mb-1"
            >
              Search ID, Extracted Value, Row Label, or Verification Status
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="grid-search"
                type="text"
                value={filters.searchQuery}
                onChange={(e) => {
                  onUpdateFilters({ searchQuery: e.target.value });
                  setCurrentPage(1);
                }}
                placeholder="Search e.g. ANN-0001, 10,321, Revenue, unverified..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="grid-type-filter"
              className="block text-[11px] font-semibold text-slate-600 mb-1"
            >
              Annotation Type
            </label>
            <select
              id="grid-type-filter"
              value={filters.annotationType}
              onChange={(e) => {
                onUpdateFilters({
                  annotationType: e.target.value as AnnotationType | 'All',
                });
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="All">All Types ({annotations.length})</option>
              {activeCategoryTypes.map((type) => (
                <option key={type} value={type}>
                  {type} ({metrics.byType[type] ?? 0})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="grid-status-filter"
              className="block text-[11px] font-semibold text-slate-600 mb-1"
            >
              Review Status
            </label>
            <select
              id="grid-status-filter"
              value={filters.status}
              onChange={(e) => {
                onUpdateFilters({
                  status: e.target.value as ReviewStatus | 'All',
                });
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending ({metrics.pendingCount})</option>
              <option value="Approved">Approved ({metrics.approvedCount})</option>
              <option value="Rejected">Rejected ({metrics.rejectedCount})</option>
              <option value="Needs Investigation">
                Needs Investigation ({metrics.needsInvestigationCount})
              </option>
            </select>
          </div>

          <div>
            <label
              htmlFor="grid-page-filter"
              className="block text-[11px] font-semibold text-slate-600 mb-1"
            >
              Page Filter
            </label>
            <select
              id="grid-page-filter"
              value={filters.samplePageNumber}
              onChange={(e) => {
                onUpdateFilters({
                  samplePageNumber:
                    e.target.value === 'All' ? 'All' : Number(e.target.value),
                });
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="All">All Processed Pages ({samplePages.length})</option>
              {samplePages.map((page) => { const first = annotations.find((annotation) => annotation.samplePageNumber === page); return <option key={page} value={page}>{first?.originalReportPageNumber ? `Report p.${first.originalReportPageNumber} · ` : ''}Sample idx {first?.samplePdfPageIndex ?? page}</option>; })}
            </select>
          </div>

          <div className="flex items-center gap-2">
            {dataSourceMode === 'demo-mock' ? (
              <div className="flex-1">
                <label
                  htmlFor="grid-confidence-filter"
                  className="block text-[11px] font-semibold text-slate-600 mb-1 tabular-nums"
                >
                  Demo Conf ≥ {Math.round(filters.minConfidence * 100)}%
                </label>
                <input
                  id="grid-confidence-filter"
                  type="range"
                  min={0.5}
                  max={0.95}
                  step={0.05}
                  value={filters.minConfidence}
                  onChange={(e) => {
                    onUpdateFilters({ minConfidence: Number(e.target.value) });
                    setCurrentPage(1);
                  }}
                  className="w-full accent-blue-600"
                />
              </div>
            ) : (
              <div className="flex-1 text-[11px] text-slate-500">
                <div className="font-semibold text-slate-700">OpenCV Mode</div>
                <div>No mock confidence cutoff</div>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                onResetFilters();
                setCurrentPage(1);
              }}
              aria-label="Reset Review Filters"
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-1 shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Bulk Selection Action Bar */}
        {selectedIds.length > 0 && (
          <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-700 tabular-nums">
              {selectedIds.length} annotations selected for bulk review:
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleBulkAction('Approved')}
                className="px-2.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Approve Selected</span>
              </button>
              <button
                type="button"
                onClick={() => handleBulkAction('Needs Investigation')}
                className="px-2.5 py-1.5 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold flex items-center gap-1"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Mark Needs Investigation</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. Main Content — Annotations Grid */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                <th className="py-3 pl-3 pr-2 w-8">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={handleToggleSelectAllVisible}
                    aria-label="Select all visible rows"
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                  />
                </th>
                <th className="py-3 px-2.5 whitespace-nowrap">ID</th>
                <th className="py-3 px-2.5 whitespace-nowrap">
                  Report / Sample / Render Page
                </th>
                <th className="py-3 px-2.5 whitespace-nowrap">Annotation Type</th>
                <th className="py-3 px-3">Extracted Value & Text Association</th>
                <th className="py-3 px-2.5 text-right whitespace-nowrap">
                  {dataSourceMode === 'real-opencv' ? 'Detector Score' : 'Demo Confidence'}
                </th>
                <th className="py-3 px-2.5 whitespace-nowrap">Priority</th>
                <th className="py-3 px-2.5 whitespace-nowrap">Review Status</th>
                <th className="py-3 pl-2.5 pr-4 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-500">
                    No annotations match the selected filter criteria. Click "Reset" to show all findings.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row) => {
                  const isSelected = selectedIds.includes(row.id);
                  return (
                    <tr
                      key={row.id}
                      onClick={() => onInspectAnnotation(row.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-50/50 hover:bg-blue-50/80'
                          : 'hover:bg-slate-50/90'
                      }`}
                    >
                      <td
                        className="py-3 pl-3 pr-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleRow(row.id)}
                          aria-label={`Select annotation ${row.id}`}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                        />
                      </td>
                      <td className={`${cellPadding} font-mono font-bold text-slate-900 whitespace-nowrap`}>
                        {row.id}
                      </td>
                      <td className={`${cellPadding} font-mono tabular-nums text-slate-700 whitespace-nowrap`}>
                        <div className="font-semibold text-slate-900">
                          {showOriginalPageNumbers
                            ? `Report p.${row.originalReportPageNumber}`
                            : `Sample idx ${row.samplePdfPageIndex}`}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Sample idx {row.samplePdfPageIndex} · Render idx {row.renderedImagePageIndex}
                        </div>
                      </td>
                      <td className={`${cellPadding} font-semibold text-teal-800 whitespace-nowrap`}>
                        {row.annotationType}
                      </td>
                      <td className="py-3 px-3 max-w-[260px]">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900 tabular-nums truncate">
                            {row.extractedText}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span
                            className={`text-[11px] font-medium whitespace-nowrap ${
                              row.textAssociationVerified
                                ? 'text-slate-500'
                                : 'text-amber-700 font-semibold'
                            }`}
                          >
                            {row.textAssociationVerified
                              ? 'Verified'
                              : 'Unverified Association'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {row.rowLabel} · {row.noteReference}
                        </div>
                      </td>
                      <td className={`${cellPadding} text-right font-mono tabular-nums font-semibold text-slate-800 whitespace-nowrap`}>
                        {row.dataSource === 'real-opencv' && row.confidence === null
                          ? 'Measured'
                          : typeof row.confidence === 'number'
                          ? `${Math.round(row.confidence * 100)}%`
                          : 'N/A'}
                      </td>
                      <td className={`${cellPadding} whitespace-nowrap`}>
                        <span
                          className={`font-semibold ${
                            row.priority === 'High'
                              ? 'text-red-700'
                              : row.priority === 'Medium'
                              ? 'text-amber-700'
                              : 'text-slate-600'
                          }`}
                        >
                          {row.priority}
                        </span>
                      </td>
                      <td className={`${cellPadding} whitespace-nowrap`}>
                        <span
                          className={`font-semibold ${
                            row.status === 'Approved'
                              ? 'text-emerald-700'
                              : row.status === 'Rejected'
                              ? 'text-red-700'
                              : row.status === 'Needs Investigation'
                              ? 'text-amber-700'
                              : 'text-amber-600'
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td
                        className="py-3 pl-2.5 pr-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => onInspectAnnotation(row.id)}
                          aria-label={`View ${row.id}`}
                          className="px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-colors inline-flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination & Rows-Per-Page Footer */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-3">
            <label htmlFor="rows-per-page" className="text-slate-600 font-medium">
              Rows per page:
            </label>
            <select
              id="rows-per-page"
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 rounded-md border border-slate-300 bg-white text-xs font-mono"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
            </select>
            <span className="text-slate-500 tabular-nums">
              Showing {totalFiltered === 0 ? 0 : startIndex + 1}–
              {Math.min(startIndex + rowsPerPage, totalFiltered)} of {totalFiltered}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1 rounded-md border border-slate-300 bg-white text-slate-700 disabled:opacity-40 hover:bg-slate-100 flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
            <span className="font-mono tabular-nums px-2">
              Page {safePage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1 rounded-md border border-slate-300 bg-white text-slate-700 disabled:opacity-40 hover:bg-slate-100 flex items-center gap-1"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
