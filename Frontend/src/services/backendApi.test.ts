import assert from 'node:assert/strict';
import test from 'node:test';
import { adaptBackendDetections, backendApi, BackendApiError } from './backendApi';

// The browser client uses window timers; these small tests run under tsx/node.
(globalThis as unknown as { window: typeof globalThis }).window = globalThis;

test('adapts FastAPI detection fields without inventing report pages or associations', () => {
  const records = adaptBackendDetections({ result_set: 'artifacts', total_detections: 1, detections: [{ id: 'm3-0001', annotation_type: 'highlight', page: { source_report_page_number: null, sample_pdf_page_index: 2, rendered_image_page_index: 2 }, bounding_box: { x: 10, y: 20, width: 30, height: 40 }, confidence: 0.85, associated_text: null, center_pixels: null, radius_pixels: null, metadata: { bbox_normalized: [0.1, 0.2, 0.4, 0.6] } }] }, 'doc-1', 'upload.pdf');
  assert.equal(records[0].originalReportPageNumber, null);
  assert.equal(records[0].samplePdfPageIndex, 2);
  assert.equal(records[0].textAssociationVerified, false);
  assert.deepEqual(records[0].normalizedBoundingBox, { x: 0.1, y: 0.2, width: 0.30000000000000004, height: 0.39999999999999997 });
});

test('maps process request to the documented JSON endpoint and surfaces API errors', async () => {
  const originalFetch = globalThis.fetch;
  let captured: { url: string; body?: string } | undefined;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => { captured = { url: String(url), body: String(init?.body) }; return new Response(JSON.stringify({ detail: 'bad page' }), { status: 422, headers: { 'Content-Type': 'application/json' } }); }) as typeof fetch;
  await assert.rejects(() => backendApi.processDocument('doc id', [1, 2], ['Highlight']), (error: unknown) => error instanceof BackendApiError && error.status === 422);
  assert.equal(captured?.url, '/api/v1/documents/doc%20id/process');
  assert.equal(captured?.body, '{"page_indexes":[1,2],"annotation_types":["highlight"]}');
  globalThis.fetch = originalFetch;
});
