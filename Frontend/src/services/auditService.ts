import {
  AnnotationRecord,
  AnnotationType,
  AuditDocument,
  DataSourceMode,
  ReviewStatus,
} from '../types/audit';
import {
  generateDetectionJson,
  generateReviewCsv,
  parseOpenCvDetectionJson,
  validateReviewDecision,
  validateUploadedFile,
} from '../utils/auditLogic';

export interface UploadRequest {
  fileName: string;
  fileSizeMb: number;
  fullReportTotalPages: number;
  samplePdfFileName: string;
  samplePdfTotalPages: number;
  pagesProcessedCount: number;
  pageRangeMode: 'all' | 'selected';
  pageRangeInput: string;
  selectedDetectionTypes: Record<AnnotationType, boolean>;
}

export interface ExportDocumentOptions {
  fullReportTotalPages?: number;
  samplePdfFileName?: string;
  samplePdfTotalPages?: number;
  pagesProcessedCount?: number;
  dataSourceMode?: DataSourceMode;
}

class AuditService {
  validateAndPrepareUpload(req: UploadRequest): {
    valid: boolean;
    error?: string;
    documentRecord?: AuditDocument;
  } {
    const fileCheck = validateUploadedFile(req.fileName, req.fileSizeMb);
    if (!fileCheck.valid) {
      return { valid: false, error: fileCheck.error };
    }

    const enabledCount = Object.values(req.selectedDetectionTypes).filter(Boolean).length;
    if (enabledCount === 0) {
      return {
        valid: false,
        error:
          'Select at least one visual detection category (e.g., Circles, Highlights, Ticks) before processing.',
      };
    }

    const documentRecord: AuditDocument = {
      id: `DOC-00${Math.floor(Math.random() * 89) + 10}`,
      name: req.fileName,
      fullReportFileName: req.fileName,
      fullReportTotalPages: req.fullReportTotalPages,
      samplePdfFileName: req.samplePdfFileName,
      samplePdfTotalPages: req.samplePdfTotalPages,
      pagesProcessedCount: req.pagesProcessedCount,
      companyName: req.fileName.includes('Infosys')
        ? 'Infosys Limited'
        : req.fileName.replace(/\.pdf$/i, '').replace(/_/g, ' '),
      fiscalYear: 'FY 2024-25',
      uploadedAt: 'Just now',
      fileSizeMb: req.fileSizeMb,
      status: 'In Review',
      leadAuditor: 'Ananya Sharma, CPA',
      dataSource: 'demo-mock',
    };

    return { valid: true, documentRecord };
  }

  importRealOpenCvJson(
    jsonText: string,
    defaultDocumentName = 'Infosys_Annual_Report_2024-25.pdf'
  ) {
    return parseOpenCvDetectionJson(jsonText, defaultDocumentName);
  }

  applyReviewUpdate(
    annotations: AnnotationRecord[],
    annotationId: string,
    newStatus: ReviewStatus,
    comment: string,
    auditorName: string,
    requireCommentOnReject: boolean
  ) {
    const check = validateReviewDecision(newStatus, comment, requireCommentOnReject);
    if (!check.valid) {
      return { valid: false, error: check.error, updatedAnnotations: annotations };
    }

    let updatedItem: AnnotationRecord | undefined;
    const nowStr =
      new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }) + ' IST';

    const updatedAnnotations = annotations.map((ann) => {
      if (ann.id !== annotationId) return ann;
      const defaultNote =
        newStatus === 'Approved'
          ? 'Accepted visual finding for review workflow.'
          : newStatus === 'Needs Investigation'
          ? 'Flagged for senior audit manager review.'
          : 'Rejected visual detection candidate.';

      updatedItem = {
        ...ann,
        status: newStatus,
        reviewerComment: comment.trim() || ann.reviewerComment || defaultNote,
        reviewedBy: auditorName,
        reviewedAt: `2026-10-23 ${nowStr}`,
      };
      return updatedItem;
    });

    return {
      valid: true,
      updatedAnnotations,
      updatedItem,
    };
  }

  private triggerBrowserDownload(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  downloadJsonFile(
    annotations: AnnotationRecord[],
    documentName: string,
    options?: ExportDocumentOptions
  ) {
    const jsonContent = generateDetectionJson(annotations, documentName, options);
    const cleanBase = documentName.replace(/\.pdf$/i, '');
    this.triggerBrowserDownload(
      jsonContent,
      `${cleanBase}_AuditVision_Detections.json`,
      'application/json;charset=utf-8;'
    );
  }

  downloadCsvFile(
    annotations: AnnotationRecord[],
    fileNamePrefix = 'Infosys_Annual_Report_2024-25'
  ) {
    const csvContent = generateReviewCsv(annotations);
    const cleanBase = fileNamePrefix.replace(/\.pdf$/i, '');
    this.triggerBrowserDownload(
      csvContent,
      `${cleanBase}_Audit_Review_Results.csv`,
      'text/csv;charset=utf-8;'
    );
  }

  downloadEvaluationSummaryTxt(
    annotations: AnnotationRecord[],
    documentName: string,
    options?: ExportDocumentOptions
  ) {
    const approved = annotations.filter((a) => a.status === 'Approved').length;
    const pending = annotations.filter((a) => a.status === 'Pending').length;
    const rejected = annotations.filter((a) => a.status === 'Rejected').length;
    const investigation = annotations.filter(
      (a) => a.status === 'Needs Investigation'
    ).length;

    const fullPages = options?.fullReportTotalPages ?? 369;
    const sampleName =
      options?.samplePdfFileName ?? 'Infosys_AR24-25_Financial_Statements_Sample.pdf';
    const samplePages = options?.samplePdfTotalPages ?? 5;
    const processedPages = options?.pagesProcessedCount ?? 5;

    const lines = [
      '========================================================================',
      'AUDITVISION AI — AUTONOMOUS VISUAL INTELLIGENCE EVALUATION REPORT',
      options?.dataSourceMode === 'real-opencv'
        ? 'DATA SOURCE: REAL OPENCV DETECTION OUTPUT'
        : 'DEMONSTRATION DATA ONLY — NOT AN OFFICIAL STATUTORY AUDIT CERTIFICATION',
      '========================================================================',
      `Full Annual Report   : ${documentName} (${fullPages} pages)`,
      `Sample PDF Scope     : ${sampleName} (${samplePages} pages, Original Report pp. 222–226)`,
      `Pages Processed      : ${processedPages} pages`,
      `Generated Timestamp  : ${new Date().toISOString()}`,
      '',
      '--- REVIEW SUMMARY METRICS ---',
      `Total Visual Annotations Detected : ${annotations.length}`,
      `Approved Findings                 : ${approved}`,
      `Pending Review                    : ${pending}`,
      `Rejected Findings                 : ${rejected}`,
      `Flagged (Needs Investigation)     : ${investigation}`,
      '',
      '--- DETAILED FINDINGS LOG ---',
      ...annotations.map(
        (a) =>
          `[${a.id}] Report p.${a.originalReportPageNumber} | Sample idx:${a.samplePdfPageIndex} | Render idx:${a.renderedImagePageIndex} | ${a.annotationType.padEnd(10)} | Value: ${a.extractedText.padEnd(12)} | Assoc: ${(a.textAssociationVerified ? 'Verified' : 'Unverified').padEnd(10)} | Status: ${a.status.padEnd(19)} | Row: ${a.rowLabel}`
      ),
      '========================================================================',
    ];

    const cleanBase = documentName.replace(/\.pdf$/i, '');
    this.triggerBrowserDownload(
      lines.join('\n'),
      `${cleanBase}_Evaluation_Report.txt`,
      'text/plain;charset=utf-8;'
    );
  }
}

export const auditService = new AuditService();
