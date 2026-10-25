export type AnnotationType =
  | 'Circle'
  | 'Highlight'
  | 'Tick'
  | 'Cross'
  | 'Underline'
  | 'Arrow'
  | 'Signature'
  | 'Stamp';

export type ReviewStatus =
  | 'Pending'
  | 'Approved'
  | 'Rejected'
  | 'Needs Investigation';

export type PriorityLevel = 'High' | 'Medium' | 'Low';

export type DataSourceMode = 'demo-mock' | 'real-opencv';

export type ScreenId =
  | 'home'
  | 'upload'
  | 'processing'
  | 'review-results'
  | 'document-viewer'
  | 'reports'
  | 'user-guide';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AnnotationRecord {
  id: string;
  documentId: string;
  documentName: string;
  /** Distinct page index fields */
  originalReportPageNumber: number | null;
  samplePdfPageIndex: number;
  renderedImagePageIndex: number;
  renderedImageFileName?: string;
  /** Internal page key (4-8 for the 5 financial statement sample pages) */
  samplePageNumber: number;
  annotationType: AnnotationType;
  extractedText: string;
  rowLabel: string;
  noteReference: string;
  /** Explicitly marks whether financial text association is verified or uncertain/unverified */
  textAssociationVerified: boolean;
  /** Null when detector does not emit calibrated confidence probabilities */
  confidence: number | null;
  priority: PriorityLevel;
  status: ReviewStatus;
  boundingBox: BoundingBox;
  /** Normalized image coordinates when emitted by the FastAPI adapter. */
  normalizedBoundingBox?: BoundingBox;
  /** Optional in real OpenCV mode so detector explanations are never invented */
  detectionExplanation?: string;
  dataSource: DataSourceMode;
  reviewerComment: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface AuditDocument {
  id: string;
  /** Full annual report metadata */
  fullReportFileName: string;
  fullReportTotalPages: number;
  /** Selected-page sample PDF metadata */
  samplePdfFileName: string;
  samplePdfTotalPages: number;
  /** Number of pages actually processed by the visual pipeline */
  pagesProcessedCount: number;
  /** Display name alias */
  name: string;
  companyName: string;
  fiscalYear: string;
  uploadedAt: string;
  fileSizeMb: number;
  status: 'Completed' | 'In Review' | 'Processing' | 'Archived';
  leadAuditor: string;
  dataSource: DataSourceMode;
  detectionCount?: number;
}

export interface ReviewerActivity {
  id: string;
  timestamp: string;
  auditorName: string;
  auditorRole: string;
  action:
    | 'Approved'
    | 'Rejected'
    | 'Needs Investigation'
    | 'Uploaded'
    | 'Exported'
    | 'Imported OpenCV JSON';
  annotationId?: string;
  targetDescription: string;
  comment?: string;
}

export interface ProcessingStage {
  id: number;
  key: string;
  label: string;
  description: string;
  status: 'completed' | 'active' | 'pending' | 'error';
  durationMs: number;
}

/**
 * Structured payload for consuming real-time or polled backend processing updates.
 * When provided by a backend job poller, ProcessingProgressScreen renders these exact metrics.
 */
export interface BackendProcessingProgress {
  jobId?: string;
  status: 'running' | 'completed' | 'cancelled' | 'error';
  currentStageIndex: number;
  processedPages: number;
  totalPagesToProcess: number;
  candidatesFound: number;
  estimatedRemainingSeconds?: number | null;
  errorMessage?: string | null;
  isSimulated: boolean;
}

export interface FinancialLineItem {
  id: string;
  particulars: string;
  noteNo?: string;
  currentPeriod: string;
  previousPeriod: string;
  isHeader?: boolean;
  isSubtotal?: boolean;
  isTotal?: boolean;
  indentLevel?: number;
}

export interface FinancialStatementPageData {
  samplePageNumber: number;
  samplePdfPageIndex: number;
  renderedImagePageIndex: number;
  renderedImageFileName: string;
  /** Optional actual rendered PDF page image URL when real page renders are loaded */
  renderedPageImageUrl?: string;
  originalReportPageNumber: number;
  statementTitle: string;
  statementSubtitle: string;
  unitLabel: string;
  periodCurrentLabel: string;
  periodPrevLabel: string;
  lineItems: FinancialLineItem[];
  footerSignoff?: {
    firmName: string;
    partnerName: string;
    membershipNo: string;
    executiveSignatories: string[];
    placeAndDate: string;
  };
}

export interface AppSettings {
  defaultDpi: 150 | 300 | 600;
  enabledDetectionTypes: Record<AnnotationType, boolean>;
  minConfidenceThreshold: number;
  autoAdvanceOnReview: boolean;
  requireCommentOnReject: boolean;
  showOriginalPageNumbers: boolean;
  compactTableDensity: boolean;
  highlightLowConfidenceWarnings: boolean;
}

export interface AnnotationFilters {
  searchQuery: string;
  annotationType: AnnotationType | 'All';
  status: ReviewStatus | 'All';
  samplePageNumber: number | 'All';
  minConfidence: number;
}

export interface SummaryMetrics {
  totalAnnotations: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  needsInvestigationCount: number;
  completionPercentage: number;
  averageConfidence: number | null;
  unverifiedAssociationCount: number;
  highPriorityPendingCount: number;
  byType: Record<AnnotationType, number>;
  byPage: Record<
    number,
    {
      samplePageNumber: number;
      samplePdfPageIndex: number;
      renderedImagePageIndex: number;
      originalReportPageNumber: number | null;
      total: number;
      pending: number;
      approved: number;
      rejected: number;
      needsInvestigation: number;
    }
  >;
}
