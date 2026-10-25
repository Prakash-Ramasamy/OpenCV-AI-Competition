import {
  AnnotationFilters,
  AnnotationRecord,
  AnnotationType,
  DataSourceMode,
  PriorityLevel,
  ReviewStatus,
  SummaryMetrics,
} from '../types/audit';

export const PRIMARY_ANNOTATION_TYPES: AnnotationType[] = [
  'Circle',
  'Highlight',
  'Tick',
  'Cross',
  'Underline',
  'Arrow',
];

export const ALL_ANNOTATION_TYPES: AnnotationType[] = [
  ...PRIMARY_ANNOTATION_TYPES,
  'Signature',
  'Stamp',
];

/**
 * Returns the 6 primary visual annotation categories plus Signature and/or Stamp
 * ONLY if those detections genuinely exist in the active dataset.
 * Guarantees that the sum of counts across returned categories equals totalAnnotations.
 */
export function getActiveAnnotationTypes(
  byType: Record<AnnotationType, number>
): AnnotationType[] {
  const result: AnnotationType[] = [...PRIMARY_ANNOTATION_TYPES];
  if (byType.Signature > 0) {
    result.push('Signature');
  }
  if (byType.Stamp > 0) {
    result.push('Stamp');
  }
  return result;
}

/**
 * Computes live summary metrics from the current annotation dataset.
 * Never returns hardcoded values.
 */
export function calculateSummaryMetrics(annotations: AnnotationRecord[]): SummaryMetrics {
  const totalAnnotations = annotations.length;
  let pendingCount = 0;
  let approvedCount = 0;
  let rejectedCount = 0;
  let needsInvestigationCount = 0;
  let highPriorityPendingCount = 0;
  let unverifiedAssociationCount = 0;
  let confidenceSum = 0;
  let confidenceCount = 0;

  const byType: Record<AnnotationType, number> = {
    Circle: 0,
    Highlight: 0,
    Tick: 0,
    Cross: 0,
    Underline: 0,
    Arrow: 0,
    Signature: 0,
    Stamp: 0,
  };

  const byPage: SummaryMetrics['byPage'] = {};

  for (const ann of annotations) {
    if (typeof ann.confidence === 'number') {
      confidenceSum += ann.confidence;
      confidenceCount += 1;
    }

    if (!ann.textAssociationVerified) {
      unverifiedAssociationCount += 1;
    }

    byType[ann.annotationType] = (byType[ann.annotationType] ?? 0) + 1;

    if (!byPage[ann.samplePageNumber]) {
      byPage[ann.samplePageNumber] = {
        samplePageNumber: ann.samplePageNumber,
        samplePdfPageIndex: ann.samplePdfPageIndex,
        renderedImagePageIndex: ann.renderedImagePageIndex,
        originalReportPageNumber: ann.originalReportPageNumber,
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        needsInvestigation: 0,
      };
    }

    const pageEntry = byPage[ann.samplePageNumber];
    pageEntry.total += 1;

    if (ann.status === 'Pending') {
      pendingCount += 1;
      pageEntry.pending += 1;
      if (ann.priority === 'High') {
        highPriorityPendingCount += 1;
      }
    } else if (ann.status === 'Approved') {
      approvedCount += 1;
      pageEntry.approved += 1;
    } else if (ann.status === 'Rejected') {
      rejectedCount += 1;
      pageEntry.rejected += 1;
    } else if (ann.status === 'Needs Investigation') {
      needsInvestigationCount += 1;
      pageEntry.needsInvestigation += 1;
    }
  }

  const reviewedCount = approvedCount + rejectedCount + needsInvestigationCount;
  const completionPercentage =
    totalAnnotations > 0 ? Math.round((reviewedCount / totalAnnotations) * 100) : 0;
  const averageConfidence =
    confidenceCount > 0 ? Math.round((confidenceSum / confidenceCount) * 100) : null;

  return {
    totalAnnotations,
    pendingCount,
    approvedCount,
    rejectedCount,
    needsInvestigationCount,
    completionPercentage,
    averageConfidence,
    unverifiedAssociationCount,
    highPriorityPendingCount,
    byType,
    byPage,
  };
}

/**
 * Filters annotations by search query, annotation type, status, page number, and minimum confidence.
 */
export function filterAnnotations(
  annotations: AnnotationRecord[],
  filters: AnnotationFilters,
  enabledTypes?: Record<AnnotationType, boolean>
): AnnotationRecord[] {
  const query = filters.searchQuery.trim().toLowerCase();

  return annotations.filter((ann) => {
    if (enabledTypes && enabledTypes[ann.annotationType] === false) {
      return false;
    }

    if (filters.annotationType !== 'All' && ann.annotationType !== filters.annotationType) {
      return false;
    }

    if (filters.status !== 'All' && ann.status !== filters.status) {
      return false;
    }

    if (
      filters.samplePageNumber !== 'All' &&
      ann.samplePageNumber !== filters.samplePageNumber
    ) {
      return false;
    }

    if (typeof ann.confidence === 'number' && ann.confidence < filters.minConfidence) {
      return false;
    }

    if (query.length > 0) {
      const searchable = [
        ann.id,
        ann.extractedText,
        ann.rowLabel,
        ann.noteReference,
        ann.annotationType,
        ann.status,
        `page ${ann.samplePageNumber}`,
        `sample ${ann.samplePdfPageIndex}`,
        `render ${ann.renderedImagePageIndex}`,
        `p.${ann.originalReportPageNumber}`,
        ann.textAssociationVerified ? 'verified' : 'unverified',
      ]
        .join(' ')
        .toLowerCase();

      if (!searchable.includes(query)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Validates file upload parameters (must be PDF and within reasonable size limit).
 */
export function validateUploadedFile(
  fileName: string,
  fileSizeMb: number
): { valid: boolean; error?: string } {
  const trimmed = fileName.trim();
  if (!trimmed) {
    return { valid: false, error: 'Please select a PDF financial statement file to upload.' };
  }
  if (!trimmed.toLowerCase().endsWith('.pdf')) {
    return {
      valid: false,
      error: `Invalid file format "${trimmed}". Only audited financial statement PDF (.pdf) files are accepted.`,
    };
  }
  if (fileSizeMb <= 0 || fileSizeMb > 250) {
    return {
      valid: false,
      error: 'File size must be between 0.1 MB and 250 MB for single-batch visual analysis.',
    };
  }
  return { valid: true };
}

/**
 * Validates custom page range input when "Selected pages" mode is chosen.
 */
export function validatePageRange(
  mode: 'all' | 'selected',
  rangeInput: string,
  maxPages: number
): { valid: boolean; parsedCount: number; error?: string } {
  if (mode === 'all') {
    return { valid: true, parsedCount: maxPages };
  }

  const trimmed = rangeInput.trim();
  if (!trimmed) {
    return {
      valid: false,
      parsedCount: 0,
      error: 'Enter a valid page range (e.g., 222-226).',
    };
  }

  const parts = trimmed.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) {
    return {
      valid: false,
      parsedCount: 0,
      error: 'Enter at least one page number or range.',
    };
  }

  const pages = new Set<number>();
  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-').map((s) => s.trim());
      const start = Number(startStr);
      const end = Number(endStr);
      if (
        !Number.isInteger(start) ||
        !Number.isInteger(end) ||
        start < 1 ||
        end < start ||
        end > maxPages
      ) {
        return {
          valid: false,
          parsedCount: 0,
          error: `Invalid range "${part}". Pages must be between 1 and ${maxPages}.`,
        };
      }
      for (let i = start; i <= end; i++) {
        pages.add(i);
      }
    } else {
      const pageNum = Number(part);
      if (!Number.isInteger(pageNum) || pageNum < 1 || pageNum > maxPages) {
        return {
          valid: false,
          parsedCount: 0,
          error: `Invalid page number "${part}". Must be between 1 and ${maxPages}.`,
        };
      }
      pages.add(pageNum);
    }
  }

  return { valid: true, parsedCount: pages.size };
}

/**
 * Validates review status change. Rejecting an annotation requires a short reason when configured.
 */
export function validateReviewDecision(
  newStatus: ReviewStatus,
  comment: string,
  requireCommentOnReject: boolean = true
): { valid: boolean; error?: string } {
  if (newStatus === 'Rejected' && requireCommentOnReject && comment.trim().length < 5) {
    return {
      valid: false,
      error: 'Please enter a brief audit rejection reason (at least 5 characters) before rejecting this finding.',
    };
  }
  return { valid: true };
}

/**
 * Finds the next pending annotation after the current annotation ID.
 */
export function findNextPendingAnnotation(
  annotations: AnnotationRecord[],
  currentId: string
): AnnotationRecord | null {
  if (annotations.length === 0) return null;
  const currentIndex = annotations.findIndex((a) => a.id === currentId);
  const startIndex = currentIndex >= 0 ? currentIndex + 1 : 0;

  for (let offset = 0; offset < annotations.length; offset++) {
    const idx = (startIndex + offset) % annotations.length;
    const candidate = annotations[idx];
    if (candidate.id !== currentId && candidate.status === 'Pending') {
      return candidate;
    }
  }
  return null;
}

/**
 * Parses real OpenCV detection JSON without inventing confidence scores,
 * financial values, note references, or detector explanations.
 */
export function parseOpenCvDetectionJson(
  jsonText: string,
  defaultDocumentName = 'Infosys_Annual_Report_2024-25.pdf'
): { valid: boolean; annotations: AnnotationRecord[]; error?: string } {
  try {
    const raw = JSON.parse(jsonText);
    const items: Record<string, unknown>[] = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.detections)
      ? raw.detections
      : Array.isArray(raw?.annotations)
      ? raw.annotations
      : [];

    if (items.length === 0) {
      return {
        valid: false,
        annotations: [],
        error: 'JSON file does not contain a non-empty array of detections.',
      };
    }

    const normalizeType = (val: unknown): AnnotationType => {
      const str = String(val ?? 'Circle').trim().toLowerCase();
      if (str.includes('highlight')) return 'Highlight';
      if (str.includes('tick') || str.includes('check')) return 'Tick';
      if (str.includes('cross') || str.includes('x')) return 'Cross';
      if (str.includes('underline') || str.includes('line')) return 'Underline';
      if (str.includes('arrow')) return 'Arrow';
      if (str.includes('sig')) return 'Signature';
      if (str.includes('stamp') || str.includes('seal')) return 'Stamp';
      return 'Circle';
    };

    const normalizeStatus = (val: unknown): ReviewStatus => {
      const str = String(val ?? 'Pending').trim();
      if (
        str === 'Pending' ||
        str === 'Approved' ||
        str === 'Rejected' ||
        str === 'Needs Investigation'
      ) {
        return str;
      }
      return 'Pending';
    };

    const normalizePriority = (val: unknown): PriorityLevel => {
      const str = String(val ?? 'Medium').trim();
      if (str === 'High' || str === 'Medium' || str === 'Low') return str;
      return 'Medium';
    };

    const parsed: AnnotationRecord[] = items.map((item, idx) => {
      const bboxRaw = (item.boundingBox ?? item.bbox ?? {}) as Record<string, unknown>;
      const x = Number(bboxRaw.x ?? item.x ?? 0);
      const y = Number(bboxRaw.y ?? item.y ?? 0);
      const width = Number(bboxRaw.width ?? bboxRaw.w ?? item.width ?? 60);
      const height = Number(bboxRaw.height ?? bboxRaw.h ?? item.height ?? 28);

      const samplePdfIdx = Number(
        item.samplePdfPageIndex ?? item.samplePageIndex ?? item.pageIndex ?? 1
      );
      const renderedIdx = Number(
        item.renderedImagePageIndex ?? item.renderIndex ?? samplePdfIdx
      );
      const origReportPage = Number(
        item.originalReportPageNumber ?? item.reportPage ?? 221 + samplePdfIdx
      );
      const samplePageNum = Number(
        item.samplePageNumber ?? Math.min(8, Math.max(4, samplePdfIdx + 3))
      );

      const extractedText =
        typeof item.extractedText === 'string' && item.extractedText.trim().length > 0
          ? item.extractedText.trim()
          : 'Unverified text region';

      const rowLabel =
        typeof item.rowLabel === 'string' && item.rowLabel.trim().length > 0
          ? item.rowLabel.trim()
          : 'Unverified line item association';

      const noteReference =
        typeof item.noteReference === 'string' && item.noteReference.trim().length > 0
          ? item.noteReference.trim()
          : 'Unmapped';

      const textVerified =
        typeof item.textAssociationVerified === 'boolean'
          ? item.textAssociationVerified
          : extractedText !== 'Unverified text region' &&
            rowLabel !== 'Unverified line item association';

      // Never invent confidence scores when not provided by real detector
      const confidence =
        typeof item.confidence === 'number' && !Number.isNaN(item.confidence)
          ? item.confidence
          : null;

      // Never invent prose explanations for real detector output
      const detectionExplanation =
        typeof item.detectionExplanation === 'string' &&
        item.detectionExplanation.trim().length > 0
          ? item.detectionExplanation.trim()
          : undefined;

      return {
        id:
          typeof item.id === 'string' && item.id.trim().length > 0
            ? item.id.trim()
            : `OCV-${String(idx + 1).padStart(4, '0')}`,
        documentId: String(item.documentId ?? 'DOC-001'),
        documentName: String(item.documentName ?? defaultDocumentName),
        originalReportPageNumber: origReportPage,
        samplePdfPageIndex: samplePdfIdx,
        renderedImagePageIndex: renderedIdx,
        renderedImageFileName:
          typeof item.renderedImageFileName === 'string'
            ? item.renderedImageFileName
            : `render_p${origReportPage}_idx0${renderedIdx}.png`,
        samplePageNumber: samplePageNum,
        annotationType: normalizeType(item.annotationType ?? item.type),
        extractedText,
        rowLabel,
        noteReference,
        textAssociationVerified: textVerified,
        confidence,
        priority: normalizePriority(item.priority),
        status: normalizeStatus(item.status),
        boundingBox: { x, y, width, height },
        detectionExplanation,
        dataSource: 'real-opencv',
        reviewerComment: typeof item.reviewerComment === 'string' ? item.reviewerComment : '',
      };
    });

    return { valid: true, annotations: parsed };
  } catch (err) {
    return {
      valid: false,
      annotations: [],
      error: `Failed to parse OpenCV JSON: ${err instanceof Error ? err.message : 'Invalid JSON'}`,
    };
  }
}

/**
 * Generates formatted JSON payload for export.
 */
export function generateDetectionJson(
  annotations: AnnotationRecord[],
  documentName: string,
  options?: {
    fullReportTotalPages?: number;
    samplePdfFileName?: string;
    samplePdfTotalPages?: number;
    pagesProcessedCount?: number;
    dataSourceMode?: DataSourceMode;
  }
): string {
  const metrics = calculateSummaryMetrics(annotations);
  const activeTypes = getActiveAnnotationTypes(metrics.byType);
  const activeByType = Object.fromEntries(
    activeTypes.map((t) => [t, metrics.byType[t]])
  );

  const payload = {
    schemaVersion: '1.4.0',
    dataMode:
      options?.dataSourceMode === 'real-opencv' ||
      annotations.some((a) => a.dataSource === 'real-opencv')
        ? 'Real OpenCV Detection Output'
        : 'DEMONSTRATION DATA ONLY — Simulated visual intelligence audit output.',
    generatedAt: new Date().toISOString(),
    documentName,
    documentStructure: {
      fullReportTotalPages: options?.fullReportTotalPages ?? 369,
      samplePdfFileName:
        options?.samplePdfFileName ?? 'Infosys_AR24-25_Financial_Statements_Sample.pdf',
      samplePdfTotalPages: options?.samplePdfTotalPages ?? 5,
      pagesProcessedCount: options?.pagesProcessedCount ?? 5,
    },
    summary: {
      totalAnnotations: metrics.totalAnnotations,
      approvedCount: metrics.approvedCount,
      pendingCount: metrics.pendingCount,
      rejectedCount: metrics.rejectedCount,
      needsInvestigationCount: metrics.needsInvestigationCount,
      completionPercentage: metrics.completionPercentage,
      unverifiedAssociationCount: metrics.unverifiedAssociationCount,
      byType: activeByType,
    },
    detections: annotations,
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Generates RFC-4180 compliant CSV string for review findings export.
 */
export function generateReviewCsv(annotations: AnnotationRecord[]): string {
  const headers = [
    'ID',
    'Document Name',
    'Original Report Page',
    'Sample PDF Page Index',
    'Rendered Image Index',
    'Annotation Type',
    'Extracted Value / Text',
    'Associated Row Label',
    'Note Reference',
    'Text Association Verified',
    'Confidence (%)',
    'Priority',
    'Review Status',
    'Bounding Box (x,y,w,h)',
    'Data Source',
    'Reviewer Comment',
    'Reviewed By',
    'Reviewed At',
  ];

  const escapeCsvCell = (val: string | number | null | undefined): string => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = annotations.map((ann) => [
    ann.id,
    ann.documentName,
    ann.originalReportPageNumber,
    ann.samplePdfPageIndex,
    ann.renderedImagePageIndex,
    ann.annotationType,
    ann.extractedText,
    ann.rowLabel,
    ann.noteReference,
    ann.textAssociationVerified ? 'Verified' : 'Unverified',
    typeof ann.confidence === 'number' ? Math.round(ann.confidence * 100) : 'N/A',
    ann.priority,
    ann.status,
    `${ann.boundingBox.x},${ann.boundingBox.y},${ann.boundingBox.width},${ann.boundingBox.height}`,
    ann.dataSource,
    ann.reviewerComment,
    ann.reviewedBy ?? '',
    ann.reviewedAt ?? '',
  ]);

  return [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((r) => r.map(escapeCsvCell).join(',')),
  ].join('\n');
}
