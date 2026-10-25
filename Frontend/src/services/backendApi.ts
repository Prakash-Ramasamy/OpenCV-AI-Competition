import { AnnotationRecord, AnnotationType } from '../types/audit';

const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | boolean | undefined> }).env;
// Vite development continues to call the local FastAPI server by default.  The
// production container builds with VITE_API_BASE_URL set to an empty string, so
// these existing /api/v1 paths stay relative to the public Nginx origin.
const configuredApiBaseUrl = viteEnv?.VITE_API_BASE_URL;
const defaultApiBaseUrl = viteEnv?.PROD === false ? 'http://127.0.0.1:8000' : '';
const baseUrl = (configuredApiBaseUrl === undefined ? defaultApiBaseUrl : configuredApiBaseUrl).replace(/\/$/, '');
const REQUEST_TIMEOUT_MS = 90_000;

export interface BackendUploadResponse { document_id: string; original_filename: string; page_count: number; file_size_bytes: number; status: string; }
export interface BackendDocumentListItem { document_id: string; original_filename: string; page_count: number; file_size_bytes: number; status: string; processed_page_indexes: number[]; total_detections: number; }
export interface BackendProcessResponse { document_id: string; status: string; processed_page_indexes: number[]; total_detections: number; }
export interface BackendDetection { id: string; annotation_type: string; page: { source_report_page_number: number | null; sample_pdf_page_index: number; rendered_image_page_index: number }; bounding_box: { x: number; y: number; width: number; height: number }; confidence: number | null; associated_text: string | null; center_pixels: [number, number] | null; radius_pixels: number | null; metadata: Record<string, unknown>; status?: string; reviewer_comment?: string; }
export interface BackendDetectionsResponse { result_set: string; total_detections: number; detections: BackendDetection[]; }
export interface BackendSummaryResponse { document_id: string; status: string; total_detections: number; detections_by_type: Record<string, number>; processed_page_indexes: number[]; }
export interface BackendDashboardEntry { id: string; document_id: string; document_name: string; original_report_page_number: number | null; sample_pdf_page_index: number; rendered_image_page_index: number; rendered_image_file_name?: string | null; sample_page_number: number; annotation_type: string; extracted_text: string; row_label: string; note_reference: string; text_association_verified: boolean; confidence: number | null; priority: string; status: string; bounding_box: { x: number; y: number; width: number; height: number }; detection_explanation?: string | null; data_source: string; reviewer_comment?: string; }
export interface BackendDashboardResponse { source: string; entries: BackendDashboardEntry[]; }

export class BackendApiError extends Error {
  constructor(message: string, public readonly status?: number) { super(message); this.name = 'BackendApiError'; }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl}${path}`, { ...init, signal: controller.signal });
    const text = await response.text();
    let payload: unknown = null;
    try { payload = text ? JSON.parse(text) : null; } catch { throw new BackendApiError('The API returned an invalid JSON response.', response.status); }
    if (!response.ok) {
      const detail = typeof payload === 'object' && payload && 'detail' in payload ? String(payload.detail) : `Request failed (${response.status}).`;
      throw new BackendApiError(detail, response.status);
    }
    if (!payload || typeof payload !== 'object') throw new BackendApiError('The API returned an empty response.', response.status);
    return payload as T;
  } catch (error) {
    if (error instanceof BackendApiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') throw new BackendApiError('The API request timed out.');
    throw new BackendApiError(error instanceof Error ? `Unable to reach the API: ${error.message}` : 'Unable to reach the API.');
  } finally { window.clearTimeout(timer); }
}

export const backendApi = {
  getDashboard() { return request<BackendDashboardResponse>('/api/v1/sample/dashboard'); },
  getDocuments() { return request<BackendDocumentListItem[]>('/api/v1/documents'); },
  uploadPdf(file: File) { const body = new FormData(); body.append('file', file); return request<BackendUploadResponse>('/api/v1/documents', { method: 'POST', body }); },
  processDocument(documentId: string, pageIndexes: number[], annotationTypes: string[]) { return request<BackendProcessResponse>(`/api/v1/documents/${encodeURIComponent(documentId)}/process`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page_indexes: pageIndexes, annotation_types: annotationTypes.map((type) => type.toLowerCase()) }) }); },
  getDetections(documentId: string) { return request<BackendDetectionsResponse>(`/api/v1/documents/${encodeURIComponent(documentId)}/detections`); },
  getSummary(documentId: string) { return request<BackendSummaryResponse>(`/api/v1/documents/${encodeURIComponent(documentId)}/summary`); },
  updateReview(documentId: string, detectionId: string, status: string, reviewerComment: string) { return request<BackendDetectionsResponse>(`/api/v1/documents/${encodeURIComponent(documentId)}/review`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ detection_id: detectionId, status, reviewer_comment: reviewerComment }) }); },
  async getPageImage(documentId: string, pageIndex: number, annotated = false): Promise<string> {
    const controller = new AbortController(); const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try { const response = await fetch(`${baseUrl}/api/v1/documents/${encodeURIComponent(documentId)}/pages/${pageIndex}/image?annotated=${annotated}`, { signal: controller.signal }); if (!response.ok) throw new BackendApiError(`Page image is unavailable (${response.status}).`, response.status); return URL.createObjectURL(await response.blob()); }
    catch (error) { if (error instanceof BackendApiError) throw error; throw new BackendApiError('Unable to load the processed page image.'); }
    finally { window.clearTimeout(timer); }
  },
};

const annotationTypes: Record<string, AnnotationType> = { arrow: 'Arrow', circle: 'Circle', cross: 'Cross', highlight: 'Highlight', tick: 'Tick', underline: 'Underline' };

/** Converts only fields emitted by FastAPI; unavailable source-page/text associations stay explicit. */
export function adaptBackendDetections(response: BackendDetectionsResponse, documentId: string, documentName: string): AnnotationRecord[] {
  return response.detections.map((detection) => ({
    id: detection.id, documentId, documentName,
    originalReportPageNumber: detection.page.source_report_page_number,
    samplePdfPageIndex: detection.page.sample_pdf_page_index,
    renderedImagePageIndex: detection.page.rendered_image_page_index,
    renderedImageFileName: `page-${String(detection.page.rendered_image_page_index).padStart(2, '0')}.png`,
    samplePageNumber: detection.page.sample_pdf_page_index,
    annotationType: annotationTypes[detection.annotation_type.toLowerCase()] ?? 'Cross',
    extractedText: detection.associated_text || 'No associated text returned',
    rowLabel: 'No verified text-region association', noteReference: 'Not available',
    textAssociationVerified: false, confidence: detection.confidence,
    priority: 'Medium', boundingBox: detection.bounding_box,
    normalizedBoundingBox: Array.isArray(detection.metadata?.bbox_normalized) ? (() => { const [x0, y0, x1, y1] = detection.metadata.bbox_normalized as number[]; return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }; })() : undefined,
    detectionExplanation: Object.keys(detection.metadata || {}).length ? JSON.stringify(detection.metadata) : undefined,
    dataSource: 'real-opencv', reviewerComment: detection.reviewer_comment || '', status: (detection.status === 'Approved' || detection.status === 'Rejected' || detection.status === 'Needs Investigation' ? detection.status : 'Pending'),
  }));
}

export function adaptDashboardEntries(response: BackendDashboardResponse): AnnotationRecord[] {
  return response.entries.map((entry) => ({
    id: entry.id,
    documentId: entry.document_id,
    documentName: entry.document_name,
    originalReportPageNumber: entry.original_report_page_number,
    samplePdfPageIndex: entry.sample_pdf_page_index,
    renderedImagePageIndex: entry.rendered_image_page_index,
    renderedImageFileName: entry.rendered_image_file_name || undefined,
    // Demo fixtures are presented on the existing UI's pages 4–8 while the
    // stored JSON keeps the real 1-based sample-PDF index (1–5).
    samplePageNumber: entry.data_source === 'demo' ? entry.sample_page_number + 3 : entry.sample_page_number,
    annotationType: annotationTypes[entry.annotation_type.toLowerCase()] ?? 'Cross',
    extractedText: entry.extracted_text,
    rowLabel: entry.row_label,
    noteReference: entry.note_reference,
    textAssociationVerified: entry.text_association_verified,
    confidence: entry.confidence,
    priority: (entry.priority === 'High' || entry.priority === 'Low' ? entry.priority : 'Medium'),
    status: (entry.status === 'Approved' || entry.status === 'Rejected' || entry.status === 'Needs Investigation' ? entry.status : 'Pending'),
    boundingBox: entry.bounding_box,
    detectionExplanation: entry.detection_explanation || undefined,
    dataSource: 'demo-mock',
    reviewerComment: entry.reviewer_comment || '',
  }));
}

export const backendApiBaseUrl = baseUrl;
