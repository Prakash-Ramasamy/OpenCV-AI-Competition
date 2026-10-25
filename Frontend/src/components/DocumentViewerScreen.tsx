import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Info,
  ShieldCheck,
  Stamp,
  PenTool,
  Image as ImageIcon,
  ArrowLeft,
} from 'lucide-react';
import {
  AnnotationRecord,
  DataSourceMode,
  ReviewStatus,
  ScreenId,
} from '../types/audit';
import { FINANCIAL_STATEMENT_PAGES } from '../data/mockAuditData';
import { findNextPendingAnnotation } from '../utils/auditLogic';

interface DocumentViewerScreenProps {
  annotations: AnnotationRecord[];
  selectedAnnotationId: string;
  activePageNumber: number;
  dataSourceMode: DataSourceMode;
  renderedPageImages: Record<number, string>;
  annotatedPageImages: Record<number, string>;
  onUploadRenderedPageImage: (samplePageNumber: number, dataUrl: string) => void;
  onSelectAnnotation: (annotationId: string) => void;
  onChangePage: (samplePageNumber: number) => void;
  onNavigate: (screen: ScreenId) => void;
  onReviewDecision: (
    annotationId: string,
    status: ReviewStatus,
    comment: string,
    advanceToNext?: boolean
  ) => Promise<{ valid: boolean; error?: string }>;
  requireCommentOnReject: boolean;
  showOriginalPageNumbers: boolean;
}

export const DocumentViewerScreen: React.FC<DocumentViewerScreenProps> = ({
  annotations,
  selectedAnnotationId,
  activePageNumber,
  dataSourceMode,
  renderedPageImages,
  annotatedPageImages,
  onUploadRenderedPageImage,
  onSelectAnnotation,
  onChangePage,
  onNavigate,
  onReviewDecision,
  requireCommentOnReject,
  showOriginalPageNumbers,
}) => {
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [viewMode, setViewMode] = useState<'annotated' | 'original'>('annotated');
  const [commentDraft, setCommentDraft] = useState<string>('');
  const [decisionError, setDecisionError] = useState<string | null>(null);

  const selectedAnnotation =
    annotations.find((a) => a.id === selectedAnnotationId) ?? annotations[0];

  useEffect(() => {
    if (selectedAnnotation) {
      setCommentDraft(selectedAnnotation.reviewerComment || '');
      setDecisionError(null);
    }
  }, [selectedAnnotation?.id, selectedAnnotation?.reviewerComment]);

  const currentIndex = annotations.findIndex(
    (a) => a.id === selectedAnnotation?.id
  );

  const fallbackPage = FINANCIAL_STATEMENT_PAGES[4];
  const currentAnnotation = annotations.find((a) => a.samplePageNumber === activePageNumber);
  const pageData = FINANCIAL_STATEMENT_PAGES[activePageNumber] ?? {
    ...fallbackPage,
    originalReportPageNumber: currentAnnotation?.originalReportPageNumber ?? 'Unknown',
    samplePdfPageIndex: currentAnnotation?.samplePdfPageIndex ?? activePageNumber,
    renderedImagePageIndex: currentAnnotation?.renderedImagePageIndex ?? activePageNumber,
    renderedImageFileName: currentAnnotation?.renderedImageFileName ?? `page-${String(activePageNumber).padStart(2, '0')}.png`,
    statementTitle: 'Uploaded PDF page', statementSubtitle: 'Rendered by FastAPI', lineItems: [],
  };
  const pageAnnotations = annotations.filter(
    (a) => a.samplePageNumber === activePageNumber
  );

  const activeRenderedImageUrl = viewMode === 'annotated'
    ? annotatedPageImages[activePageNumber] || renderedPageImages[activePageNumber]
    : renderedPageImages[activePageNumber];

  const nextPending = selectedAnnotation
    ? findNextPendingAnnotation(annotations, selectedAnnotation.id)
    : null;

  const handlePrevAnnotation = () => {
    if (annotations.length === 0) return;
    const prevIdx =
      (currentIndex - 1 + annotations.length) % annotations.length;
    const target = annotations[prevIdx];
    onSelectAnnotation(target.id);
    onChangePage(target.samplePageNumber);
  };

  const handleNextAnnotation = () => {
    if (annotations.length === 0) return;
    const nextIdx = (currentIndex + 1) % annotations.length;
    const target = annotations[nextIdx];
    onSelectAnnotation(target.id);
    onChangePage(target.samplePageNumber);
  };

  const handleDecisionClick = async (
    status: ReviewStatus,
    advanceToNext: boolean = false
  ) => {
    if (!selectedAnnotation) return;
    const result = await onReviewDecision(
      selectedAnnotation.id,
      status,
      commentDraft,
      advanceToNext
    );
    if (!result.valid) {
      setDecisionError(result.error ?? 'Validation failed.');
    } else {
      setDecisionError(null);
    }
  };

  const handleSaveAndNext = () => {
    if (!selectedAnnotation) return;
    const targetStatus: ReviewStatus =
      selectedAnnotation.status === 'Pending'
        ? 'Approved'
        : selectedAnnotation.status;
    void handleDecisionClick(targetStatus, true);
  };

  const handleRenderedImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onUploadRenderedPageImage(activePageNumber, reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const samplePages = dataSourceMode === 'real-opencv'
    ? [...new Set(annotations.map((a) => a.samplePageNumber))].sort((a, b) => a - b)
    : [4, 5, 6, 7, 8];

  return (
    <div className="space-y-4">
      {/* Top Breadcrumb Return Bar */}
      <div className="bg-white border border-slate-200 rounded-lg px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('review-results')}
            className="px-2.5 py-1 rounded-md border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Review Results</span>
          </button>
          <span className="text-slate-300">|</span>
          <span className="font-mono text-slate-700 tabular-nums">
            <strong>Original Report Page:</strong> p.{pageData.originalReportPageNumber} of 369
          </span>
          <span className="text-slate-300">·</span>
          <span className="font-mono text-slate-700 tabular-nums">
            <strong>Sample PDF Index:</strong> {pageData.samplePdfPageIndex} of 5
          </span>
          <span className="text-slate-300">·</span>
          <span className="font-mono text-teal-800 tabular-nums">
            <strong>Rendered Image Index:</strong> #{pageData.renderedImagePageIndex} ({pageData.renderedImageFileName})
          </span>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleRenderedImageUpload}
            className="hidden"
            aria-label="Upload Rendered PDF Page Image"
          />
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className="px-2.5 py-1 rounded-md border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
          >
            <ImageIcon className="w-3.5 h-3.5 text-teal-600" />
            <span>
              {activeRenderedImageUrl
                ? 'Replace Page Render Image'
                : 'Load Actual PDF Page Render'}
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT PANEL: Financial Statement Document Viewer (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col">
          {/* Document Viewer Toolbar */}
          <div className="px-4 py-3 bg-slate-900 text-slate-200 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
            {/* Page Navigation Controls */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={samplePages.indexOf(activePageNumber) <= 0}
                onClick={() => onChangePage(samplePages[Math.max(0, samplePages.indexOf(activePageNumber) - 1)])}
                aria-label="Previous Statement Page"
                className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <select
                aria-label="Select Financial Statement Page"
                value={activePageNumber}
                onChange={(e) => onChangePage(Number(e.target.value))}
                className="bg-slate-800 border border-slate-700 text-white text-xs font-mono rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {samplePages.map((p) => {
                  const pd = FINANCIAL_STATEMENT_PAGES[p];
                  return (
                    <option key={p} value={p}>
                      Report p.{pd?.originalReportPageNumber} · Sample idx {pd?.samplePdfPageIndex} · Render #{pd?.renderedImagePageIndex}
                    </option>
                  );
                })}
              </select>
              <button
                type="button"
                disabled={samplePages.indexOf(activePageNumber) >= samplePages.length - 1}
                onClick={() => onChangePage(samplePages[Math.min(samplePages.length - 1, samplePages.indexOf(activePageNumber) + 1)])}
                aria-label="Next Statement Page"
                className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Zoom & Fit-to-Page Controls */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(80, z - 10))}
                aria-label="Zoom Out"
                className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-mono px-2 tabular-nums text-slate-300">
                {zoomLevel}%
              </span>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(125, z + 10))}
                aria-label="Zoom In"
                className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel(100)}
                aria-label="Fit to Page"
                className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1 ml-1"
              >
                <Maximize2 className="w-3 h-3" />
                <span>Fit to Page</span>
              </button>
            </div>

            {/* Original / Annotated Mode Segmented Toggle */}
            <div className="flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700">
              <button
                type="button"
                onClick={() => setViewMode('original')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  viewMode === 'original'
                    ? 'bg-white text-slate-900'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <EyeOff className="w-3.5 h-3.5" />
                <span>Original</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('annotated')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  viewMode === 'annotated'
                    ? 'bg-teal-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Annotated ({pageAnnotations.length})</span>
              </button>
            </div>
          </div>

          {/* Page Annotation Selector Strip */}
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 overflow-x-auto">
            <div className="flex items-center gap-1.5 text-xs text-slate-600 shrink-0">
              <span className="font-semibold text-slate-800">
                Marks on Report p.{pageData.originalReportPageNumber} (Sample idx {pageData.samplePdfPageIndex}):
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {pageAnnotations.map((ann) => {
                const isSelected = ann.id === selectedAnnotation?.id;
                return (
                  <button
                    key={ann.id}
                    type="button"
                    onClick={() => onSelectAnnotation(ann.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-mono transition-colors flex items-center gap-1.5 whitespace-nowrap border ${
                      isSelected
                        ? 'bg-[#2563EB] text-white border-blue-600 font-semibold'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>{ann.id}</span>
                    <span>·</span>
                    <span>{ann.annotationType}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Document Canvas: Uses Actual PDF Page Render + SVG Bounding Box Overlay when available, or Structured Financial Statement Sheet */}
          <div className="p-5 bg-slate-100/80 overflow-x-auto">
            {activeRenderedImageUrl ? (
              <div
                style={{
                  transform: `scale(${zoomLevel / 100})`,
                  transformOrigin: 'top center',
                }}
                className="relative bg-white border border-slate-300 rounded-md shadow-xs mx-auto max-w-[780px] overflow-hidden"
              >
                <img
                  src={activeRenderedImageUrl}
                  alt={`Rendered PDF Page ${pageData.originalReportPageNumber}`}
                  referrerPolicy="no-referrer"
                  className="w-full h-auto block"
                />
                {viewMode === 'annotated' && pageAnnotations.filter((ann) => ann.normalizedBoundingBox).map((ann) => {
                  const box = ann.normalizedBoundingBox!; const selected = ann.id === selectedAnnotation?.id;
                  return <button key={`normalized-${ann.id}`} type="button" onClick={() => onSelectAnnotation(ann.id)} title={`${ann.annotationType} ${ann.id}`} className={`absolute border-2 ${selected ? 'border-blue-600 bg-blue-500/20' : 'border-red-600 bg-teal-500/10'}`} style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.width * 100}%`, height: `${box.height * 100}%` }} />;
                })}
                {viewMode === 'annotated' && !pageAnnotations.some((ann) => ann.normalizedBoundingBox) && (
                  <svg
                    viewBox="0 0 650 600"
                    className="absolute inset-0 w-full h-full pointer-events-auto"
                  >
                    {pageAnnotations.map((ann) => {
                      const isSel = ann.id === selectedAnnotation?.id;
                      return (
                        <g
                          key={ann.id}
                          onClick={() => onSelectAnnotation(ann.id)}
                          className="cursor-pointer"
                        >
                          <rect
                            x={ann.boundingBox.x}
                            y={ann.boundingBox.y}
                            width={ann.boundingBox.width}
                            height={ann.boundingBox.height}
                            fill={
                              isSel
                                ? 'rgba(37, 99, 235, 0.18)'
                                : 'rgba(13, 148, 136, 0.12)'
                            }
                            stroke={isSel ? '#2563EB' : '#DC2626'}
                            strokeWidth={isSel ? 3 : 2}
                            rx={4}
                          />
                          <text
                            x={ann.boundingBox.x}
                            y={Math.max(12, ann.boundingBox.y - 4)}
                            fill={isSel ? '#1D4ED8' : '#B91C1C'}
                            fontSize="11"
                            fontWeight="bold"
                            fontFamily="monospace"
                          >
                            {ann.id} ({ann.annotationType})
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                )}
              </div>
            ) : (
              <div
                style={{
                  transform: `scale(${zoomLevel / 100})`,
                  transformOrigin: 'top center',
                }}
                className="bg-white border border-slate-300 rounded-md shadow-xs p-6 mx-auto max-w-[780px] transition-transform duration-150"
              >
                {/* Statement Sheet Header */}
                <div className="border-b-2 border-slate-900 pb-3 mb-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-bold tracking-wide text-slate-500">
                      INFOSYS LIMITED AND SUBSIDIARIES · ANNUAL REPORT FY 2024–25
                    </div>
                    <h3 className="text-base font-bold text-slate-900 font-display mt-0.5">
                      {pageData.statementTitle}
                    </h3>
                    <div className="text-xs text-slate-600 mt-0.5">
                      {pageData.statementSubtitle} ·{' '}
                      <span className="italic">{pageData.unitLabel}</span>
                    </div>
                  </div>
                  <div className="text-right font-mono text-xs text-slate-500 shrink-0 tabular-nums">
                    <div className="font-semibold text-slate-800">
                      Report Page {pageData.originalReportPageNumber} of 369
                    </div>
                    <div className="text-[11px]">
                      Sample PDF idx {pageData.samplePdfPageIndex} · Render #{pageData.renderedImagePageIndex}
                    </div>
                  </div>
                </div>

                {/* Financial Statement Table with Accurate Overlays */}
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-300 text-[11px] font-bold text-slate-700 bg-slate-50">
                      <th className="py-2 px-2.5">Particulars</th>
                      <th className="py-2 px-2 text-center w-24">Note No.</th>
                      <th className="py-2 px-2.5 text-right w-36">
                        {pageData.periodCurrentLabel}
                      </th>
                      <th className="py-2 px-2.5 text-right w-36">
                        {pageData.periodPrevLabel}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {pageData.lineItems.map((line) => {
                      const rowAnnotations = pageAnnotations.filter(
                        (ann) =>
                          ann.rowLabel.toLowerCase() ===
                            line.particulars.toLowerCase() ||
                          (ann.extractedText === line.currentPeriod &&
                            line.currentPeriod !== '') ||
                          (ann.extractedText === line.noteNo &&
                            ann.rowLabel.includes(line.particulars))
                      );

                      const highlightAnn = rowAnnotations.find(
                        (a) => a.annotationType === 'Highlight'
                      );
                      const circleAnn = rowAnnotations.find(
                        (a) => a.annotationType === 'Circle'
                      );
                      const tickAnn = rowAnnotations.find(
                        (a) => a.annotationType === 'Tick'
                      );
                      const crossAnn = rowAnnotations.find(
                        (a) => a.annotationType === 'Cross'
                      );
                      const underlineAnn = rowAnnotations.find(
                        (a) => a.annotationType === 'Underline'
                      );
                      const arrowAnn = rowAnnotations.find(
                        (a) => a.annotationType === 'Arrow'
                      );

                      const isAnySelectedInRow = rowAnnotations.some(
                        (a) => a.id === selectedAnnotation?.id
                      );

                      if (line.isHeader) {
                        return (
                          <tr key={line.id} className="bg-slate-100/70">
                            <td
                              colSpan={4}
                              className="py-2 px-2.5 font-bold text-slate-900 text-xs"
                            >
                              {line.particulars}
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr
                          key={line.id}
                          onClick={() => {
                            if (rowAnnotations[0]) {
                              onSelectAnnotation(rowAnnotations[0].id);
                            }
                          }}
                          className={`relative transition-colors ${
                            rowAnnotations.length > 0 ? 'cursor-pointer' : ''
                          } ${
                            viewMode === 'annotated' && highlightAnn
                              ? highlightAnn.id === selectedAnnotation?.id
                                ? 'bg-amber-200/80 ring-2 ring-blue-600'
                                : 'bg-amber-100/75 hover:bg-amber-200/60'
                              : isAnySelectedInRow && viewMode === 'annotated'
                              ? 'bg-blue-50/70 ring-1 ring-blue-500'
                              : line.isTotal
                              ? 'bg-slate-50 font-bold border-t-2 border-b-2 border-slate-900'
                              : line.isSubtotal
                              ? 'font-semibold bg-slate-50/40'
                              : 'hover:bg-slate-50/60'
                          }`}
                        >
                          <td
                            className={`py-2.5 px-2.5 text-slate-800 ${
                              line.indentLevel ? 'pl-6' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span>{line.particulars}</span>
                              {viewMode === 'annotated' && highlightAnn && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectAnnotation(highlightAnn.id);
                                  }}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                                    highlightAnn.id === selectedAnnotation?.id
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-amber-500/20 text-amber-900 border border-amber-500/40'
                                  }`}
                                >
                                  {highlightAnn.id} · Highlight
                                </button>
                              )}
                            </div>
                          </td>

                          <td className="py-2.5 px-2 text-center font-mono text-slate-600 relative">
                            <div className="inline-flex items-center justify-center gap-1 relative">
                              <span>{line.noteNo || '—'}</span>

                              {viewMode === 'annotated' &&
                                tickAnn &&
                                tickAnn.extractedText.startsWith('Note') && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onSelectAnnotation(tickAnn.id);
                                    }}
                                    className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded border text-[10px] font-mono font-bold ${
                                      tickAnn.id === selectedAnnotation?.id
                                        ? 'bg-emerald-600 text-white border-emerald-700 ring-2 ring-blue-500'
                                        : 'bg-emerald-50 text-emerald-800 border-emerald-400'
                                    }`}
                                  >
                                    <svg
                                      className="w-3 h-3 stroke-current fill-none"
                                      viewBox="0 0 24 24"
                                      strokeWidth={3}
                                    >
                                      <path d="M20 6L9 17l-5-5" />
                                    </svg>
                                    <span>{tickAnn.id}</span>
                                  </button>
                                )}

                              {viewMode === 'annotated' && arrowAnn && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectAnnotation(arrowAnn.id);
                                  }}
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-mono font-bold ${
                                    arrowAnn.id === selectedAnnotation?.id
                                      ? 'bg-blue-600 text-white border-blue-700 ring-2 ring-blue-400'
                                      : 'bg-teal-50 text-teal-800 border-teal-400'
                                  }`}
                                >
                                  <span>→</span>
                                  <span>{arrowAnn.id}</span>
                                </button>
                              )}
                            </div>
                          </td>

                          <td className="py-2.5 px-2.5 text-right font-mono tabular-nums text-slate-900 relative">
                            <div className="inline-flex items-center justify-end gap-1.5 relative">
                              <span
                                className={`inline-block px-1.5 py-0.5 transition-all ${
                                  viewMode === 'annotated' && circleAnn
                                    ? circleAnn.id === selectedAnnotation?.id
                                      ? 'border-2 border-red-600 rounded-full bg-red-50/70 ring-2 ring-blue-600 font-bold'
                                      : 'border-2 border-red-500 rounded-full bg-red-50/40 font-bold'
                                    : ''
                                } ${
                                  viewMode === 'annotated' && underlineAnn
                                    ? underlineAnn.id === selectedAnnotation?.id
                                      ? 'border-b-4 border-double border-blue-700 bg-blue-50/60 font-bold'
                                      : 'border-b-2 border-blue-600 font-bold'
                                    : ''
                                }`}
                              >
                                {line.currentPeriod}
                              </span>

                              {viewMode === 'annotated' &&
                                (circleAnn || underlineAnn) && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const target = circleAnn ?? underlineAnn!;
                                      onSelectAnnotation(target.id);
                                    }}
                                    className={`px-1 py-0.5 rounded text-[9px] font-mono font-bold ${
                                      (circleAnn ?? underlineAnn)?.id ===
                                      selectedAnnotation?.id
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-slate-800 text-white'
                                    }`}
                                  >
                                    {(circleAnn ?? underlineAnn)?.id}
                                  </button>
                                )}

                              {viewMode === 'annotated' &&
                                tickAnn &&
                                !tickAnn.extractedText.startsWith('Note') && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onSelectAnnotation(tickAnn.id);
                                    }}
                                    className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[10px] font-mono font-bold ${
                                      tickAnn.id === selectedAnnotation?.id
                                        ? 'bg-emerald-600 text-white border-emerald-700 ring-2 ring-blue-500'
                                        : 'bg-emerald-50 text-emerald-800 border-emerald-400'
                                    }`}
                                  >
                                    <svg
                                      className="w-3 h-3 stroke-current fill-none"
                                      viewBox="0 0 24 24"
                                      strokeWidth={3}
                                    >
                                      <path d="M20 6L9 17l-5-5" />
                                    </svg>
                                    <span>{tickAnn.id}</span>
                                  </button>
                                )}

                              {viewMode === 'annotated' && crossAnn && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectAnnotation(crossAnn.id);
                                  }}
                                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[10px] font-mono font-bold ${
                                    crossAnn.id === selectedAnnotation?.id
                                      ? 'bg-red-600 text-white border-red-700 ring-2 ring-blue-500'
                                      : 'bg-red-50 text-red-800 border-red-400'
                                  }`}
                                >
                                  <span>✕</span>
                                  <span>{crossAnn.id}</span>
                                </button>
                              )}
                            </div>
                          </td>

                          <td className="py-2.5 px-2.5 text-right font-mono tabular-nums text-slate-500">
                            {line.previousPeriod}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Page 8 Signatory & Stamp Attestation Block (Included only if Signature/Stamp detections genuinely exist in active dataset) */}
                {pageData.footerSignoff &&
                  pageAnnotations.some(
                    (a) =>
                      a.annotationType === 'Signature' ||
                      a.annotationType === 'Stamp'
                  ) && (
                  <div className="mt-6 pt-4 border-t border-slate-300 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(() => {
                      const sigAnn = pageAnnotations.find(
                        (a) => a.annotationType === 'Signature'
                      );
                      const isSigSelected = sigAnn?.id === selectedAnnotation?.id;
                      return (
                        <div
                          onClick={() => sigAnn && onSelectAnnotation(sigAnn.id)}
                          className={`p-3 rounded-lg border transition-colors ${
                            viewMode === 'annotated' && sigAnn
                              ? isSigSelected
                                ? 'border-2 border-blue-600 bg-blue-50/40 cursor-pointer'
                                : 'border-2 border-dashed border-teal-600 bg-teal-50/20 cursor-pointer'
                              : 'border-slate-200 bg-slate-50/50'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                            <span className="font-semibold text-slate-700">
                              {pageData.footerSignoff.firmName}
                            </span>
                            {viewMode === 'annotated' && sigAnn && (
                              <span className="px-1.5 py-0.5 rounded bg-teal-700 text-white font-mono font-bold">
                                {sigAnn.id} · Signature
                              </span>
                            )}
                          </div>
                          <div className="py-2 font-serif italic text-base text-slate-800 flex items-center gap-2">
                            <PenTool className="w-3.5 h-3.5 text-slate-500" />
                            <span>/s/ {pageData.footerSignoff.partnerName}</span>
                          </div>
                          <div className="text-[11px] font-semibold text-slate-800">
                            {pageData.footerSignoff.partnerName}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {pageData.footerSignoff.membershipNo} ·{' '}
                            {pageData.footerSignoff.placeAndDate}
                          </div>
                        </div>
                      );
                    })()}

                    {(() => {
                      const stampAnn = pageAnnotations.find(
                        (a) => a.annotationType === 'Stamp'
                      );
                      const isStampSelected = stampAnn?.id === selectedAnnotation?.id;
                      return (
                        <div
                          onClick={() => stampAnn && onSelectAnnotation(stampAnn.id)}
                          className={`p-3 rounded-lg border flex flex-col justify-between transition-colors ${
                            viewMode === 'annotated' && stampAnn
                              ? isStampSelected
                                ? 'border-2 border-blue-600 bg-blue-50/40 cursor-pointer'
                                : 'border-2 border-dashed border-teal-600 bg-teal-50/20 cursor-pointer'
                              : 'border-slate-200 bg-slate-50/50'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="font-semibold text-slate-700">
                              Statutory Firm Seal & Attestation
                            </span>
                            {viewMode === 'annotated' && stampAnn && (
                              <span className="px-1.5 py-0.5 rounded bg-teal-700 text-white font-mono font-bold">
                                {stampAnn.id} · Stamp
                              </span>
                            )}
                          </div>
                          <div className="my-2 flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full border-2 border-double border-blue-800/70 flex items-center justify-center text-blue-900 shrink-0">
                              <Stamp className="w-5 h-5" />
                            </div>
                            <div className="text-[10px] font-mono text-slate-700 leading-tight">
                              <div className="font-bold">DELOITTE HASKINS & SELLS LLP</div>
                              <div>CHARTERED ACCOUNTANTS</div>
                              <div>FRN: 117366W / W-100018 · BENGALURU</div>
                            </div>
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">
                            Board Signatories:{' '}
                            {pageData.footerSignoff.executiveSignatories.join(', ')}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: Selected Annotation Details & Review Decision Controls (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 space-y-5">
          {/* Top Navigation Between Annotations */}
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-200">
            <div>
              <div className="text-[11px] font-medium text-teal-700">
                {selectedAnnotation?.dataSource === 'real-opencv'
                  ? 'Real OpenCV Detection Inspector'
                  : 'Visual Finding Inspector (Demonstration Data)'}
              </div>
              <h2 className="text-base font-bold text-[#0F172A] font-mono">
                {selectedAnnotation?.id} — {selectedAnnotation?.annotationType}
              </h2>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handlePrevAnnotation}
                aria-label="Previous Annotation"
                className="px-2.5 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>
              <span className="text-xs font-mono text-slate-500 px-1 tabular-nums">
                {currentIndex + 1} / {annotations.length}
              </span>
              <button
                type="button"
                onClick={handleNextAnnotation}
                aria-label="Next Annotation"
                className="px-2.5 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Metadata Key-Value Grid with Distinct Page Indexes & Text Association Verification */}
          {selectedAnnotation && (
            <>
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs">
                <div>
                  <div className="text-[11px] text-slate-500">Annotation ID</div>
                  <div className="font-mono font-bold text-slate-900 mt-0.5">
                    {selectedAnnotation.id}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Review Status</div>
                  <div
                    className={`font-bold mt-0.5 ${
                      selectedAnnotation.status === 'Approved'
                        ? 'text-emerald-700'
                        : selectedAnnotation.status === 'Rejected'
                        ? 'text-red-700'
                        : selectedAnnotation.status === 'Needs Investigation'
                        ? 'text-amber-700'
                        : 'text-amber-600'
                    }`}
                  >
                    {selectedAnnotation.status}
                  </div>
                </div>

                <div className="col-span-2">
                  <div className="text-[11px] text-slate-500">
                    Full Report / Sample Scope
                  </div>
                  <div className="font-mono text-slate-800 truncate mt-0.5">
                    {selectedAnnotation.documentName} (369 full pp · 5 sample pp)
                  </div>
                </div>

                {/* Distinct Page Indexes */}
                <div className="col-span-2 grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/80 font-mono tabular-nums">
                  <div>
                    <div className="text-[10px] font-sans text-slate-500">
                      Original Report Page
                    </div>
                    <div className="font-bold text-slate-900 mt-0.5">
                      p.{selectedAnnotation.originalReportPageNumber}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-sans text-slate-500">
                      Sample PDF Index
                    </div>
                    <div className="font-bold text-slate-900 mt-0.5">
                      Index {selectedAnnotation.samplePdfPageIndex} of 5
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-sans text-slate-500">
                      Rendered Image Index
                    </div>
                    <div className="font-bold text-teal-800 mt-0.5">
                      Render #{selectedAnnotation.renderedImagePageIndex}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/80">
                  <div className="text-[11px] text-slate-500">
                    Extracted Financial Value
                  </div>
                  <div className="font-mono font-bold text-sm text-[#0F172A] tabular-nums mt-0.5">
                    {selectedAnnotation.extractedText}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/80">
                  <div className="text-[11px] text-slate-500">
                    Text Association Status
                  </div>
                  <div
                    className={`font-semibold mt-0.5 ${
                      selectedAnnotation.textAssociationVerified
                        ? 'text-emerald-700'
                        : 'text-amber-700'
                    }`}
                  >
                    {selectedAnnotation.textAssociationVerified
                      ? 'Verified Association'
                      : 'Unverified Association'}
                  </div>
                </div>

                <div className="col-span-2">
                  <div className="text-[11px] text-slate-500">Associated Row Label</div>
                  <div className="font-semibold text-slate-900 mt-0.5">
                    {selectedAnnotation.rowLabel} ({selectedAnnotation.noteReference})
                  </div>
                </div>

                {/* Only display mock confidence when in demo mode or when explicitly provided */}
                <div>
                  <div className="text-[11px] text-slate-500">
                    {selectedAnnotation.dataSource === 'real-opencv'
                      ? 'Detector Confidence'
                      : 'Demo Confidence Score'}
                  </div>
                  <div className="font-mono font-bold text-teal-700 tabular-nums mt-0.5">
                    {typeof selectedAnnotation.confidence === 'number'
                      ? `${Math.round(selectedAnnotation.confidence * 100)}% (${selectedAnnotation.confidence.toFixed(2)})`
                      : 'Not provided by OpenCV contour detector'}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-slate-500">
                    Bounding-Box Coordinates
                  </div>
                  <div className="font-mono text-[11px] text-slate-700 tabular-nums mt-0.5">
                    x:{selectedAnnotation.boundingBox.x}, y:
                    {selectedAnnotation.boundingBox.y}, w:
                    {selectedAnnotation.boundingBox.width}, h:
                    {selectedAnnotation.boundingBox.height}
                  </div>
                </div>
              </div>

              {/* Detection Details: Never invent explanations in real-opencv mode */}
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-teal-600" />
                  <span>
                    {selectedAnnotation.dataSource === 'real-opencv'
                      ? 'Measured OpenCV Contour Geometry'
                      : 'Simulated Detection Explanation (Demonstration Data)'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3 leading-relaxed">
                  {selectedAnnotation.dataSource === 'real-opencv'
                    ? selectedAnnotation.detectionExplanation ||
                      `OpenCV contour bounding box [x=${selectedAnnotation.boundingBox.x}, y=${selectedAnnotation.boundingBox.y}, width=${selectedAnnotation.boundingBox.width}px, height=${selectedAnnotation.boundingBox.height}px, area=${selectedAnnotation.boundingBox.width * selectedAnnotation.boundingBox.height}px²] on ${selectedAnnotation.renderedImageFileName || `render #${selectedAnnotation.renderedImagePageIndex}`}.`
                    : selectedAnnotation.detectionExplanation}
                </p>
              </div>

              {/* Reviewer Comments Textarea */}
              <div className="space-y-1.5">
                <label
                  htmlFor="reviewer-comment-box"
                  className="block text-xs font-semibold text-slate-800"
                >
                  Reviewer Audit Comment / Rejection Reason
                  {requireCommentOnReject && (
                    <span className="text-slate-400 font-normal ml-1">
                      (Required when rejecting)
                    </span>
                  )}
                </label>
                <textarea
                  id="reviewer-comment-box"
                  rows={3}
                  value={commentDraft}
                  onChange={(e) => {
                    setCommentDraft(e.target.value);
                    if (decisionError) setDecisionError(null);
                  }}
                  placeholder="Enter schedule tie-out notes, partner query, or reason for rejection..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                {decisionError && (
                  <div
                    role="alert"
                    className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2"
                  >
                    {decisionError}
                  </div>
                )}
              </div>

              {/* Review Decision Buttons */}
              <div className="space-y-2.5 pt-1">
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleDecisionClick('Approved', false)}
                    className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDecisionClick('Needs Investigation', false)}
                    className="px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Needs Investigation</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDecisionClick('Rejected', false)}
                    className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveAndNext}
                    className="flex-1 px-4 py-2.5 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-2 shadow-xs"
                  >
                    <span>Save & Next</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  {nextPending && (
                    <button
                      type="button"
                      onClick={() => {
                        onSelectAnnotation(nextPending.id);
                        onChangePage(nextPending.samplePageNumber);
                      }}
                      className="px-3 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors whitespace-nowrap"
                    >
                      Next Pending ({nextPending.id})
                    </button>
                  )}
                </div>
              </div>

              {/* Statutory Audit Governance Disclaimer */}
              <div className="pt-3 border-t border-slate-200 flex items-start gap-2 text-[11px] text-slate-500">
                <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <p>
                  <strong>Review Governance Notice:</strong> Approving an item records that the reviewer has accepted the visual finding or classification for internal audit review purposes only. It does not constitute statutory certification of the underlying financial statements.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
