/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import {
  AnnotationFilters,
  AnnotationRecord,
  AnnotationType,
  AppSettings,
  AuditDocument,
  BackendProcessingProgress,
  DataSourceMode,
  ReviewerActivity,
  ReviewStatus,
  ScreenId,
} from './types/audit';
import {
  DEFAULT_APP_SETTINGS,
} from './data/mockAuditData';
import {
  ALL_ANNOTATION_TYPES,
  calculateSummaryMetrics,
  filterAnnotations,
  findNextPendingAnnotation,
} from './utils/auditLogic';
import { auditService } from './services/auditService';
import { adaptBackendDetections, adaptDashboardEntries, backendApi, BackendDashboardResponse, BackendDocumentListItem, BackendUploadResponse } from './services/backendApi';
import { AppShell } from './components/AppShell';
import { HomeDashboard } from './components/HomeDashboard';
import { UploadProcessScreen } from './components/UploadProcessScreen';
import { ProcessingProgressScreen } from './components/ProcessingProgressScreen';
import { ReviewResultsScreen } from './components/ReviewResultsScreen';
import { DocumentViewerScreen } from './components/DocumentViewerScreen';
import { ReportsExportScreen } from './components/ReportsExportScreen';
import { UserGuideScreen } from './components/UserGuideScreen';

const PROCESSED_DOCUMENTS_STORAGE_KEY = 'auditvision.processedDocuments';
type PersistedProcessedDocument = { documentId: string; documentName: string; pageCount: number; fileSizeBytes: number; processedPageIndexes: number[] };

function readPersistedProcessedDocuments(): PersistedProcessedDocument[] {
  try {
    const raw = window.localStorage.getItem(PROCESSED_DOCUMENTS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is PersistedProcessedDocument => Boolean(item && typeof item.documentId === 'string' && typeof item.documentName === 'string' && Number.isInteger(item.pageCount) && Array.isArray(item.processedPageIndexes))) : [];
  } catch {
    return [];
  }
}

function persistProcessedDocument(document: PersistedProcessedDocument) {
  try {
    const existing = readPersistedProcessedDocuments().filter((item) => item.documentId !== document.documentId);
    window.localStorage.setItem(PROCESSED_DOCUMENTS_STORAGE_KEY, JSON.stringify([document, ...existing].slice(0, 20)));
  } catch {
    // Browser storage is an optional refresh convenience; S3 remains authoritative.
  }
}

export default function App() {
  const [activeScreen, setActiveScreen] = useState<ScreenId>('home');
  const [documents, setDocuments] = useState<AuditDocument[]>([]);
  const [activeDocumentName, setActiveDocumentName] = useState<string>('');
  const [annotations, setAnnotations] = useState<AnnotationRecord[]>([]);
  const [activities, setActivities] = useState<ReviewerActivity[]>([]);
  const [dataSourceMode, setDataSourceMode] =
    useState<DataSourceMode>('demo-mock');
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [isDashboardLoading, setIsDashboardLoading] = useState<boolean>(true);

  // Optional actual rendered PDF page images keyed by samplePageNumber (4-8)
  const [renderedPageImages, setRenderedPageImages] = useState<
    Record<number, string>
  >({});
  const [annotatedPageImages, setAnnotatedPageImages] = useState<Record<number, string>>({});

  // Optional live backend progress state (null in demo mode; ready for backend polling/SSE)
  const [backendProgress] = useState<BackendProcessingProgress | null>(null);

  // Detection & review settings
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);

  // Filters state
  const [filters, setFilters] = useState<AnnotationFilters>({
    searchQuery: '',
    annotationType: 'All',
    status: 'All',
    samplePageNumber: 'All',
    minConfidence: 0.75,
  });

  // Document viewer selection state
  const [selectedAnnotationId, setSelectedAnnotationId] =
    useState<string>('ANN-0001');
  const [activePageNumber, setActivePageNumber] = useState<number>(4);

  // Processing state with separate fields for Full Report, Sample PDF, and Pages Processed
  const [isProcessingActive, setIsProcessingActive] = useState<boolean>(false);
  const [processingCounter, setProcessingCounter] = useState<number>(0);
  const [processingConfig, setProcessingConfig] = useState<{
    fileName: string;
    fileSizeMb: number;
    fullReportTotalPages: number;
    samplePdfFileName: string;
    samplePdfTotalPages: number;
    pagesProcessedCount: number;
    pageRangeInput: string;
  }>({
    fileName: 'Infosys_Annual_Report_2024-25.pdf',
    fileSizeMb: 14.8,
    fullReportTotalPages: 369,
    samplePdfFileName: 'Infosys_AR24-25_Financial_Statements_Sample.pdf',
    samplePdfTotalPages: 5,
    pagesProcessedCount: 5,
    pageRangeInput: '222-226',
  });

  // Confirmation Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
  };

  const applyDemoDashboard = (payload: BackendDashboardResponse) => {
    const nextAnnotations = adaptDashboardEntries(payload);
    const first = payload.entries[0];
    if (!first) {
      setAnnotations([]);
      setDocuments([]);
      setActiveDocumentName('');
      return;
    }
    const pageCount = payload.source === 'demo' ? 5 : Math.max(...payload.entries.map((entry) => entry.sample_page_number));
    const document: AuditDocument = {
      id: first.document_id,
      name: first.document_name,
      fullReportFileName: first.document_name,
      fullReportTotalPages: pageCount,
      samplePdfFileName: first.document_name,
      samplePdfTotalPages: pageCount,
      pagesProcessedCount: pageCount,
      companyName: 'Demo data',
      fiscalYear: 'Not supplied',
      uploadedAt: 'S3-backed demo data',
      fileSizeMb: 0,
      status: 'In Review',
      leadAuditor: 'Demo dataset',
      dataSource: 'demo-mock',
    };
    setAnnotations(nextAnnotations);
    setDocuments([document]);
    setActivities([]);
    setActiveDocumentName(first.document_name);
    setProcessingConfig((previous) => ({ ...previous, fileName: first.document_name, fullReportTotalPages: pageCount, samplePdfFileName: first.document_name, samplePdfTotalPages: pageCount, pagesProcessedCount: pageCount }));
    setSelectedAnnotationId(nextAnnotations[0]?.id || '');
    setActivePageNumber(nextAnnotations[0]?.samplePageNumber || 1);
    setDataSourceMode('demo-mock');
  };

  const loadDemoDashboard = async () => {
    setIsDashboardLoading(true);
    try {
      setDashboardError(null);
      applyDemoDashboard(await backendApi.getDashboard());
      let uploadedDocuments: AuditDocument[] = [];
      try {
        const documents = await backendApi.getDocuments();
        uploadedDocuments = documents.filter((item: BackendDocumentListItem) => item.status === 'processed').map((item) => ({ id: item.document_id, name: item.original_filename, fullReportFileName: item.original_filename, fullReportTotalPages: item.page_count, samplePdfFileName: item.original_filename, samplePdfTotalPages: item.page_count, pagesProcessedCount: item.processed_page_indexes.length, companyName: 'Uploaded document', fiscalYear: 'Not supplied', uploadedAt: 'Previously processed', fileSizeMb: Number((item.file_size_bytes / 1024 / 1024).toFixed(1)), status: 'In Review', leadAuditor: 'Local reviewer', dataSource: 'real-opencv', detectionCount: item.total_detections }));
      } catch {
        uploadedDocuments = [];
      }
      setDocuments((previous) => {
        const demoDocument = previous.find((document) => document.dataSource === 'demo-mock');
        const nextDocuments: AuditDocument[] = [];
        for (const document of [demoDocument, ...uploadedDocuments]) {
          if (!document || nextDocuments.some((candidate) => candidate.id === document.id)) continue;
          nextDocuments.push(document);
        }
        return nextDocuments;
      });
      if (uploadedDocuments.length) {
        const first = uploadedDocuments[0];
        setDataSourceMode('real-opencv');
        setActiveDocumentName(first.fullReportFileName);
        setProcessingConfig((previous) => ({ ...previous, fileName: first.fullReportFileName, fullReportTotalPages: first.fullReportTotalPages, samplePdfFileName: first.samplePdfFileName, samplePdfTotalPages: first.samplePdfTotalPages, pagesProcessedCount: first.pagesProcessedCount }));
      }
    } catch (error) {
      setAnnotations([]);
      setDocuments([]);
      setActivities([]);
      setDashboardError(error instanceof Error ? error.message : 'Dashboard data is unavailable.');
    } finally {
      setIsDashboardLoading(false);
    }
  };

  useEffect(() => { void loadDemoDashboard(); }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 4000);
    return () => clearTimeout(t);
  }, [toastMessage]);

  // Live derived metrics from current annotations state
  const metrics = useMemo(
    () => calculateSummaryMetrics(annotations),
    [annotations]
  );

  // Live filtered annotations
  const filteredAnnotations = useMemo(
    () =>
      filterAnnotations(
        annotations,
        filters,
        settings.enabledDetectionTypes
      ),
    [annotations, filters, settings.enabledDetectionTypes]
  );

  const handleUpdateFilters = (next: Partial<AnnotationFilters>) => {
    setFilters((prev) => ({ ...prev, ...next }));
  };

  const handleResetFilters = () => {
    setFilters({
      searchQuery: '',
      annotationType: 'All',
      status: 'All',
      samplePageNumber: 'All',
      minConfidence: 0.75,
    });
  };

  const handleInspectAnnotation = (annotationId: string) => {
    const target = annotations.find((a) => a.id === annotationId);
    if (target) {
      setSelectedAnnotationId(target.id);
      setActivePageNumber(target.samplePageNumber);
    }
    setActiveScreen('document-viewer');
  };

  const handleSelectPageInViewer = (samplePageNumber: number) => {
    setActivePageNumber(samplePageNumber);
    const firstOnPage = annotations.find(
      (a) => a.samplePageNumber === samplePageNumber
    );
    if (firstOnPage) {
      setSelectedAnnotationId(firstOnPage.id);
    }
    setActiveScreen('document-viewer');
  };

  const handleStartProcessingDemo = (config: {
    fileName: string;
    fileSizeMb: number;
    fullReportTotalPages: number;
    samplePdfFileName: string;
    samplePdfTotalPages: number;
    pagesProcessedCount: number;
    pageRangeMode: 'all' | 'selected';
    pageRangeInput: string;
  }) => {
    const prep = auditService.validateAndPrepareUpload({
      ...config,
      selectedDetectionTypes: settings.enabledDetectionTypes,
    });
    if (!prep.valid) return;

    setProcessingConfig({
      fileName: config.fileName,
      fileSizeMb: config.fileSizeMb,
      fullReportTotalPages: config.fullReportTotalPages,
      samplePdfFileName: config.samplePdfFileName,
      samplePdfTotalPages: config.samplePdfTotalPages,
      pagesProcessedCount: config.pagesProcessedCount,
      pageRangeInput: config.pageRangeInput,
    });
    setActiveDocumentName(config.fileName);

    if (prep.documentRecord) {
      setDocuments((prev) => {
        const exists = prev.some(
          (d) =>
            d.fullReportFileName.toLowerCase() === config.fileName.toLowerCase()
        );
        if (exists) {
          return prev.map((d) =>
            d.fullReportFileName.toLowerCase() === config.fileName.toLowerCase()
              ? {
                  ...d,
                  fullReportTotalPages: config.fullReportTotalPages,
                  samplePdfFileName: config.samplePdfFileName,
                  samplePdfTotalPages: config.samplePdfTotalPages,
                  pagesProcessedCount: config.pagesProcessedCount,
                }
              : d
          );
        }
        return [prep.documentRecord!, ...prev];
      });
    }

    setActivities((prev) => [
      {
        id: `ACT-${Date.now()}`,
        timestamp: 'Just now',
        auditorName: 'Ananya Sharma, CPA',
        auditorRole: 'Lead Engagement Manager',
        action: 'Uploaded',
        targetDescription: `${config.fileName} (${config.fullReportTotalPages} pages · Sample PDF: ${config.samplePdfTotalPages} pp · Processed: ${config.pagesProcessedCount} pp)`,
      },
      ...prev,
    ]);

    setIsProcessingActive(true);
    setProcessingCounter((c) => c + 1);
    setActiveScreen('processing');
  };

  const handleUploadPdf = async (file: File): Promise<BackendUploadResponse> => backendApi.uploadPdf(file);

  const handleStartProcessing = async (upload: BackendUploadResponse, pageIndexes: number[], types: AnnotationType[]) => {
    if (isProcessingActive) return;
    setIsProcessingActive(true);
    setDataSourceMode('real-opencv');
    setProcessingConfig({ fileName: upload.original_filename, fileSizeMb: Number((upload.file_size_bytes / 1024 / 1024).toFixed(1)), fullReportTotalPages: upload.page_count, samplePdfFileName: upload.original_filename, samplePdfTotalPages: upload.page_count, pagesProcessedCount: pageIndexes.length, pageRangeInput: pageIndexes.join(',') });
    setActiveDocumentName(upload.original_filename);
    setActiveScreen('processing');
    try {
      const processed = await backendApi.processDocument(upload.document_id, pageIndexes, types);
      const [detections, summary] = await Promise.all([backendApi.getDetections(upload.document_id), backendApi.getSummary(upload.document_id)]);
      const adapted = adaptBackendDetections(detections, upload.document_id, upload.original_filename);
      const originals: Record<number, string> = {}; const annotated: Record<number, string> = {};
      await Promise.all(summary.processed_page_indexes.map(async (index) => {
        try { originals[index] = await backendApi.getPageImage(upload.document_id, index, false); annotated[index] = await backendApi.getPageImage(upload.document_id, index, true); } catch { /* optional page images do not invalidate detector results */ }
      }));
      setRenderedPageImages(originals); setAnnotatedPageImages(annotated); setAnnotations(adapted); setDataSourceMode('real-opencv');
      setDocuments((prev) => [{ id: upload.document_id, fullReportFileName: upload.original_filename, fullReportTotalPages: upload.page_count, samplePdfFileName: upload.original_filename, samplePdfTotalPages: upload.page_count, pagesProcessedCount: processed.processed_page_indexes.length, name: upload.original_filename, companyName: 'Uploaded document', fiscalYear: 'Not supplied', uploadedAt: 'Just now', fileSizeMb: Number((upload.file_size_bytes / 1024 / 1024).toFixed(1)), status: 'In Review', leadAuditor: 'Local reviewer', dataSource: 'real-opencv' }, ...prev]);
      persistProcessedDocument({ documentId: upload.document_id, documentName: upload.original_filename, pageCount: upload.page_count, fileSizeBytes: upload.file_size_bytes, processedPageIndexes: processed.processed_page_indexes });
      if (adapted[0]) { setSelectedAnnotationId(adapted[0].id); setActivePageNumber(adapted[0].samplePageNumber); } else { setActivePageNumber(summary.processed_page_indexes[0] || 1); }
      setActiveScreen('review-results');
      triggerToast(`FastAPI processed ${processed.processed_page_indexes.length} page(s): ${summary.total_detections} actual detections returned.`);
    } finally { setIsProcessingActive(false); }
  };

  const handleProcessingComplete = () => {
    setIsProcessingActive(false);
    setActiveScreen('review-results');
    triggerToast(
      `Visual analysis completed for ${processingConfig.fileName} (${processingConfig.fullReportTotalPages} report pages, ${processingConfig.pagesProcessedCount} pages processed): ${annotations.length} annotations ready in Review Results.`
    );
  };

  const handleImportOpenCvJson = (
    jsonText: string
  ): { valid: boolean; error?: string } => {
    const parsed = auditService.importRealOpenCvJson(jsonText);
    if (!parsed.valid) {
      return { valid: false, error: parsed.error };
    }

    const distinctPagesProcessed = Math.max(
      1,
      new Set(parsed.annotations.map((a) => a.originalReportPageNumber)).size
    );

    setAnnotations(parsed.annotations);
    setDataSourceMode('real-opencv');
    setProcessingConfig((prev) => ({
      ...prev,
      pagesProcessedCount: distinctPagesProcessed,
    }));
    setDocuments((prev) =>
      prev.map((doc, idx) =>
        idx === 0
          ? {
              ...doc,
              pagesProcessedCount: distinctPagesProcessed,
              dataSource: 'real-opencv',
            }
          : doc
      )
    );

    if (parsed.annotations[0]) {
      setSelectedAnnotationId(parsed.annotations[0].id);
      setActivePageNumber(parsed.annotations[0].samplePageNumber);
    }

    setActivities((prev) => [
      {
        id: `ACT-${Date.now()}`,
        timestamp: 'Just now',
        auditorName: 'Ananya Sharma, CPA',
        auditorRole: 'Lead Engagement Manager',
        action: 'Imported OpenCV JSON',
        targetDescription: `Loaded ${parsed.annotations.length} real OpenCV detections across ${distinctPagesProcessed} processed pages.`,
      },
      ...prev,
    ]);

    triggerToast(
      `Loaded ${parsed.annotations.length} real OpenCV detections across ${distinctPagesProcessed} processed pages.`
    );
    return { valid: true };
  };

  const handleRestoreDemoMode = () => {
    void loadDemoDashboard();
    triggerToast('Loading the S3-backed demonstration dashboard.');
  };

  const handleSelectDocument = async (document: AuditDocument) => {
    setActiveDocumentName(document.fullReportFileName);
    setProcessingConfig((previous) => ({ ...previous, fileName: document.fullReportFileName, fullReportTotalPages: document.fullReportTotalPages, samplePdfFileName: document.samplePdfFileName, samplePdfTotalPages: document.samplePdfTotalPages, pagesProcessedCount: document.pagesProcessedCount }));
    try {
      if (document.dataSource === 'demo-mock') {
        const dashboard = await backendApi.getDashboard();
        const demoAnnotations = adaptDashboardEntries(dashboard);
        setAnnotations(demoAnnotations);
        setRenderedPageImages({});
        setAnnotatedPageImages({});
        setDataSourceMode('demo-mock');
        setSelectedAnnotationId(demoAnnotations[0]?.id || '');
        setActivePageNumber(demoAnnotations[0]?.samplePageNumber || 4);
        setActiveScreen('review-results');
        return;
      }
      const [detections, summary] = await Promise.all([backendApi.getDetections(document.id), backendApi.getSummary(document.id)]);
      const adapted = adaptBackendDetections(detections, document.id, document.fullReportFileName);
      const originals: Record<number, string> = {};
      const annotated: Record<number, string> = {};
      await Promise.all(summary.processed_page_indexes.map(async (index) => {
        try { originals[index] = await backendApi.getPageImage(document.id, index, false); annotated[index] = await backendApi.getPageImage(document.id, index, true); } catch { /* optional images */ }
      }));
      setRenderedPageImages(originals);
      setAnnotatedPageImages(annotated);
      setAnnotations(adapted);
      setDataSourceMode('real-opencv');
      setSelectedAnnotationId(adapted[0]?.id || '');
      setActivePageNumber(adapted[0]?.samplePageNumber || summary.processed_page_indexes[0] || 1);
      setActiveScreen('review-results');
    } catch (error) {
      triggerToast(error instanceof Error ? error.message : 'Unable to load the selected report.');
    }
  };

  const handleUploadRenderedPageImage = (
    samplePageNumber: number,
    dataUrl: string
  ) => {
    setRenderedPageImages((prev) => ({
      ...prev,
      [samplePageNumber]: dataUrl,
    }));
    triggerToast(
      `Loaded actual rendered PDF page image for Sample PDF Index #${samplePageNumber - 3} (Original Report Page ${samplePageNumber + 218}).`
    );
  };

  const handleReviewDecision = async (
    annotationId: string,
    newStatus: ReviewStatus,
    comment: string,
    advanceToNext: boolean = false
  ): Promise<{ valid: boolean; error?: string }> => {
    const result = auditService.applyReviewUpdate(
      annotations,
      annotationId,
      newStatus,
      comment,
      'Ananya Sharma, CPA',
      settings.requireCommentOnReject
    );

    if (!result.valid) {
      return { valid: false, error: result.error };
    }

    if (result.updatedItem) {
      const updated = result.updatedItem;
      let nextAnnotations = result.updatedAnnotations;
      if (updated.dataSource === 'real-opencv') {
        try {
          const persisted = await backendApi.updateReview(updated.documentId, updated.id, newStatus, comment);
          nextAnnotations = adaptBackendDetections(persisted, updated.documentId, updated.documentName);
        } catch (error) {
          return { valid: false, error: error instanceof Error ? error.message : 'Unable to save the review decision.' };
        }
      }
      setAnnotations(nextAnnotations);
      setActivities((prev) => [
        {
          id: `ACT-${Date.now()}`,
          timestamp: 'Just now',
          auditorName: 'Ananya Sharma, CPA',
          auditorRole: 'Lead Engagement Manager',
          action:
            newStatus === 'Approved'
              ? 'Approved'
              : newStatus === 'Rejected'
              ? 'Rejected'
              : 'Needs Investigation',
          annotationId: updated.id,
          targetDescription: `${updated.annotationType} on ${updated.rowLabel} (Report p. ${updated.originalReportPageNumber} · Sample #${updated.samplePdfPageIndex})`,
          comment: updated.reviewerComment,
        },
        ...prev,
      ]);

      triggerToast(
        `${updated.id} marked as "${newStatus}" and saved.`
      );

      if (advanceToNext || settings.autoAdvanceOnReview) {
        const nextPending = findNextPendingAnnotation(
          nextAnnotations,
          annotationId
        );
        if (nextPending) {
          setSelectedAnnotationId(nextPending.id);
          setActivePageNumber(nextPending.samplePageNumber);
        }
      }
    }

    return { valid: true };
  };

  const handleBulkUpdateStatus = async (ids: string[], newStatus: ReviewStatus) => {
    const idSet = new Set(ids);
    const updated = annotations.map((ann) =>
      idSet.has(ann.id)
        ? {
            ...ann,
            status: newStatus,
            reviewerComment:
              ann.reviewerComment ||
              `Bulk updated to ${newStatus} by Ananya Sharma, CPA.`,
            reviewedBy: 'Ananya Sharma, CPA',
            reviewedAt: 'Just now',
          }
        : ann
    );
    let persistedAnnotations = updated;
    const realDocumentIds = [...new Set(updated.filter((ann) => idSet.has(ann.id) && ann.dataSource === 'real-opencv').map((ann) => ann.documentId))];
    try {
      for (const documentId of realDocumentIds) {
        const targets = updated.filter((ann) => idSet.has(ann.id) && ann.documentId === documentId);
        for (const target of targets) {
          const response = await backendApi.updateReview(documentId, target.id, newStatus, target.reviewerComment);
          persistedAnnotations = persistedAnnotations.filter((ann) => ann.documentId !== documentId).concat(adaptBackendDetections(response, documentId, target.documentName));
        }
      }
    } catch (error) {
      triggerToast(error instanceof Error ? error.message : 'Unable to save bulk review decisions.');
      return;
    }
    setAnnotations(persistedAnnotations);
    triggerToast(`Updated ${ids.length} annotations to "${newStatus}".`);
  };

  const handleToggleDetectionType = (type: AnnotationType) => {
    setSettings((prev) => ({
      ...prev,
      enabledDetectionTypes: {
        ...prev.enabledDetectionTypes,
        [type]: !prev.enabledDetectionTypes[type],
      },
    }));
  };

  const handleSelectAllDetectionTypes = (enabled: boolean) => {
    const nextMap = { ...settings.enabledDetectionTypes };
    ALL_ANNOTATION_TYPES.forEach((t) => {
      nextMap[t] = enabled;
    });
    setSettings((prev) => ({
      ...prev,
      enabledDetectionTypes: nextMap,
    }));
  };

  return (
    <AppShell
      activeScreen={activeScreen}
      onNavigate={setActiveScreen}
      metrics={metrics}
      activeDocumentName={activeDocumentName}
      fullReportTotalPages={processingConfig.fullReportTotalPages}
      samplePdfTotalPages={processingConfig.samplePdfTotalPages}
      pagesProcessedCount={processingConfig.pagesProcessedCount}
      dataSourceMode={dataSourceMode}
      annotations={annotations}
      onInspectAnnotation={handleInspectAnnotation}
      isProcessingActive={isProcessingActive}
    >
      {/* Confirmation Toast Banner */}
      {dashboardError && (
        <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Dashboard data could not be loaded from configured storage: {dashboardError}
        </div>
      )}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="mb-5 bg-[#0F172A] text-white px-4 py-3 rounded-lg shadow-md flex items-center justify-between gap-3 border border-slate-700"
        >
          <div className="flex items-center gap-2.5 text-xs font-medium">
            <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            aria-label="Dismiss Notification"
            className="text-slate-400 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Home Dashboard */}
      {activeScreen === 'home' && (
        <HomeDashboard
          documents={documents}
          activities={activities}
          metrics={metrics}
          dataSourceMode={dataSourceMode}
          isLoading={isDashboardLoading}
          onNavigate={setActiveScreen}
          onSelectDocument={(doc) => { void handleSelectDocument(doc); }}
          onInspectAnnotation={handleInspectAnnotation}
        />
      )}

      {/* Upload & Process */}
      {activeScreen === 'upload' && (
        <UploadProcessScreen
          selectedDetectionTypes={settings.enabledDetectionTypes}
          dataSourceMode={dataSourceMode}
          onToggleDetectionType={handleToggleDetectionType}
          onSelectAllDetectionTypes={handleSelectAllDetectionTypes}
          onImportOpenCvJson={handleImportOpenCvJson}
          onRestoreDemoMode={handleRestoreDemoMode}
          onUploadPdf={handleUploadPdf}
          onStartProcessing={handleStartProcessing}
        />
      )}

      {/* Processing Progress */}
      {activeScreen === 'processing' && (
        <ProcessingProgressScreen
          fileName={processingConfig.fileName}
          fileSizeMb={processingConfig.fileSizeMb}
          fullReportTotalPages={processingConfig.fullReportTotalPages}
          samplePdfFileName={processingConfig.samplePdfFileName}
          samplePdfTotalPages={processingConfig.samplePdfTotalPages}
          pagesProcessedCount={processingConfig.pagesProcessedCount}
          pageRangeInput={processingConfig.pageRangeInput}
          targetCandidateCount={annotations.length}
          backendProgress={backendProgress}
          synchronousProcessing={isProcessingActive && dataSourceMode !== 'demo-mock'}
          autoStartCounter={processingCounter}
          onComplete={handleProcessingComplete}
          onNavigate={setActiveScreen}
        />
      )}

      {/* Unified Review Results (Summary Cards + Collapsible Page Thumbnails + Filters + Annotations Grid) */}
      {activeScreen === 'review-results' && (
        <ReviewResultsScreen
          annotations={annotations}
          filteredAnnotations={filteredAnnotations}
          metrics={metrics}
          filters={filters}
          dataSourceMode={dataSourceMode}
          activeDocumentName={activeDocumentName}
          fullReportTotalPages={processingConfig.fullReportTotalPages}
          samplePdfFileName={processingConfig.samplePdfFileName}
          samplePdfTotalPages={processingConfig.samplePdfTotalPages}
          pagesProcessedCount={processingConfig.pagesProcessedCount}
          onUpdateFilters={handleUpdateFilters}
          onResetFilters={handleResetFilters}
          onSelectPageInViewer={handleSelectPageInViewer}
          onInspectAnnotation={handleInspectAnnotation}
          onBulkUpdateStatus={handleBulkUpdateStatus}
          onDownloadJson={() => {
            auditService.downloadJsonFile(annotations, activeDocumentName, {
              fullReportTotalPages: processingConfig.fullReportTotalPages,
              samplePdfFileName: processingConfig.samplePdfFileName,
              samplePdfTotalPages: processingConfig.samplePdfTotalPages,
              pagesProcessedCount: processingConfig.pagesProcessedCount,
              dataSourceMode,
            });
            triggerToast(
              `Downloaded detection JSON for ${activeDocumentName}.`
            );
          }}
          onExportCsv={() => {
            auditService.downloadCsvFile(filteredAnnotations, activeDocumentName);
            triggerToast(
              `Exported ${filteredAnnotations.length} rows to CSV.`
            );
          }}
          onImportOpenCvJson={handleImportOpenCvJson}
          onRestoreDemoMode={handleRestoreDemoMode}
          compactDensity={settings.compactTableDensity}
          showOriginalPageNumbers={settings.showOriginalPageNumbers}
        />
      )}

      {/* Annotation Detail & Decision (Opened via View action in Review Results grid) */}
      {activeScreen === 'document-viewer' && (
        <DocumentViewerScreen
          annotations={annotations}
          selectedAnnotationId={selectedAnnotationId}
          activePageNumber={activePageNumber}
          dataSourceMode={dataSourceMode}
          renderedPageImages={renderedPageImages}
          annotatedPageImages={annotatedPageImages}
          onUploadRenderedPageImage={handleUploadRenderedPageImage}
          onSelectAnnotation={(id) => {
            setSelectedAnnotationId(id);
            const target = annotations.find((a) => a.id === id);
            if (target) {
              setActivePageNumber(target.samplePageNumber);
            }
          }}
          onChangePage={setActivePageNumber}
          onNavigate={setActiveScreen}
          onReviewDecision={handleReviewDecision}
          requireCommentOnReject={settings.requireCommentOnReject}
          showOriginalPageNumbers={settings.showOriginalPageNumbers}
        />
      )}

      {/* Reports & Export */}
      {activeScreen === 'reports' && (
        <ReportsExportScreen
          annotations={annotations}
          metrics={metrics}
          activeDocumentName={activeDocumentName}
          fullReportTotalPages={processingConfig.fullReportTotalPages}
          samplePdfFileName={processingConfig.samplePdfFileName}
          samplePdfTotalPages={processingConfig.samplePdfTotalPages}
          pagesProcessedCount={processingConfig.pagesProcessedCount}
          dataSourceMode={dataSourceMode}
          onDownloadJson={() =>
            auditService.downloadJsonFile(annotations, activeDocumentName, {
              fullReportTotalPages: processingConfig.fullReportTotalPages,
              samplePdfFileName: processingConfig.samplePdfFileName,
              samplePdfTotalPages: processingConfig.samplePdfTotalPages,
              pagesProcessedCount: processingConfig.pagesProcessedCount,
              dataSourceMode,
            })
          }
          onDownloadCsv={() =>
            auditService.downloadCsvFile(annotations, activeDocumentName)
          }
          onDownloadEvaluationReport={() =>
            auditService.downloadEvaluationSummaryTxt(
              annotations,
              activeDocumentName,
              {
                fullReportTotalPages: processingConfig.fullReportTotalPages,
                samplePdfFileName: processingConfig.samplePdfFileName,
                samplePdfTotalPages: processingConfig.samplePdfTotalPages,
                pagesProcessedCount: processingConfig.pagesProcessedCount,
                dataSourceMode,
              }
            )
          }
        />
      )}

      {activeScreen === 'user-guide' && <UserGuideScreen />}
    </AppShell>
  );
}
