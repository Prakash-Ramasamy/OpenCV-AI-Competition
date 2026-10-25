import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSummaryMetrics,
  filterAnnotations,
  getActiveAnnotationTypes,
  validatePageRange,
  validateReviewDecision,
  generateDetectionJson,
  generateReviewCsv,
  parseOpenCvDetectionJson,
} from './auditLogic';
import { INITIAL_ANNOTATIONS, INITIAL_DOCUMENTS } from '../data/mockAuditData';

test('Active document is Infosys Annual Report with 369 full report pages and 5 sample/processed pages (pp. 222–226)', () => {
  assert.equal(INITIAL_DOCUMENTS.length, 1);
  const infosysDoc = INITIAL_DOCUMENTS[0];
  assert.equal(infosysDoc.fullReportFileName, 'Infosys_Annual_Report_2024-25.pdf');
  assert.equal(infosysDoc.fullReportTotalPages, 369);
  assert.equal(infosysDoc.samplePdfTotalPages, 5);
  assert.equal(infosysDoc.pagesProcessedCount, 5);
});

test('calculateSummaryMetrics derives 12 total annotations matching the sum of the 6 primary category cards', () => {
  const metrics = calculateSummaryMetrics(INITIAL_ANNOTATIONS);
  assert.equal(metrics.totalAnnotations, 12);
  assert.equal(metrics.pendingCount, 6);
  assert.equal(metrics.approvedCount, 4);
  assert.equal(metrics.rejectedCount, 1);
  assert.equal(metrics.needsInvestigationCount, 1);
  assert.equal(metrics.unverifiedAssociationCount, 4);

  const activeCategories = getActiveAnnotationTypes(metrics.byType);
  assert.deepEqual(activeCategories, [
    'Circle',
    'Highlight',
    'Tick',
    'Cross',
    'Underline',
    'Arrow',
  ]);

  const categorySum = activeCategories.reduce(
    (sum, type) => sum + metrics.byType[type],
    0
  );
  assert.equal(categorySum, metrics.totalAnnotations);

  assert.equal(metrics.byPage[4].originalReportPageNumber, 222);
  assert.equal(metrics.byPage[4].samplePdfPageIndex, 1);
  assert.equal(metrics.byPage[4].renderedImagePageIndex, 1);
});

test('getActiveAnnotationTypes includes Signature and Stamp only when genuinely present in imported data', () => {
  const importedJson = JSON.stringify({
    detections: [
      {
        id: 'OCV-01',
        type: 'Circle',
        originalReportPageNumber: 222,
        samplePdfPageIndex: 1,
        renderedImagePageIndex: 1,
        bbox: { x: 410, y: 180, width: 95, height: 32 },
      },
      {
        id: 'OCV-02',
        type: 'Signature',
        originalReportPageNumber: 226,
        samplePdfPageIndex: 5,
        renderedImagePageIndex: 5,
        bbox: { x: 118, y: 446, width: 220, height: 62 },
      },
    ],
  });

  const parsed = parseOpenCvDetectionJson(importedJson);
  assert.equal(parsed.valid, true);
  const metrics = calculateSummaryMetrics(parsed.annotations);
  const activeTypes = getActiveAnnotationTypes(metrics.byType);
  assert.ok(activeTypes.includes('Signature'));
  assert.ok(!activeTypes.includes('Stamp'));

  const sum = activeTypes.reduce((acc, t) => acc + metrics.byType[t], 0);
  assert.equal(sum, metrics.totalAnnotations);
});

test('filterAnnotations filters by type, status, page, confidence, and search text', () => {
  const byCircle = filterAnnotations(INITIAL_ANNOTATIONS, {
    searchQuery: '',
    annotationType: 'Circle',
    status: 'All',
    samplePageNumber: 'All',
    minConfidence: 0,
  });
  assert.equal(byCircle.length, 3);

  const byUnverified = filterAnnotations(INITIAL_ANNOTATIONS, {
    searchQuery: 'unverified',
    annotationType: 'All',
    status: 'All',
    samplePageNumber: 'All',
    minConfidence: 0,
  });
  assert.equal(byUnverified.length, 4);
});

test('validatePageRange validates against 369 pages', () => {
  const allMode = validatePageRange('all', '', 369);
  assert.equal(allMode.valid, true);
  assert.equal(allMode.parsedCount, 369);

  const selectedValid = validatePageRange('selected', '222-226', 369);
  assert.equal(selectedValid.valid, true);
  assert.equal(selectedValid.parsedCount, 5);

  const outOfBounds = validatePageRange('selected', '1-370', 369);
  assert.equal(outOfBounds.valid, false);
});

test('validateReviewDecision requires a comment when rejecting an annotation', () => {
  const rejectEmpty = validateReviewDecision('Rejected', '', true);
  assert.equal(rejectEmpty.valid, false);

  const rejectWithReason = validateReviewDecision(
    'Rejected',
    'Scanner artifact on gridline',
    true
  );
  assert.equal(rejectWithReason.valid, true);
});

test('parseOpenCvDetectionJson imports real OpenCV output without inventing confidence or explanations', () => {
  const sampleOpenCvJson = JSON.stringify({
    detections: [
      {
        id: 'OCV-01',
        type: 'Circle',
        originalReportPageNumber: 222,
        samplePdfPageIndex: 1,
        renderedImagePageIndex: 1,
        bbox: { x: 410, y: 180, width: 95, height: 32 },
      },
    ],
  });

  const result = parseOpenCvDetectionJson(sampleOpenCvJson);
  assert.equal(result.valid, true);
  assert.equal(result.annotations.length, 1);
  assert.equal(result.annotations[0].confidence, null);
  assert.equal(result.annotations[0].detectionExplanation, undefined);
  assert.equal(result.annotations[0].textAssociationVerified, false);
  assert.equal(result.annotations[0].dataSource, 'real-opencv');
});

test('generateDetectionJson and generateReviewCsv include 369 full report pages and distinct page indexes', () => {
  const jsonStr = generateDetectionJson(
    INITIAL_ANNOTATIONS,
    'Infosys_Annual_Report_2024-25.pdf'
  );
  const parsed = JSON.parse(jsonStr);
  assert.equal(parsed.documentStructure.fullReportTotalPages, 369);
  assert.equal(parsed.summary.totalAnnotations, 12);

  const csvStr = generateReviewCsv(INITIAL_ANNOTATIONS);
  const lines = csvStr.split('\n');
  assert.equal(lines.length, 13);
  assert.ok(lines[0].includes('Sample PDF Page Index'));
  assert.ok(lines[0].includes('Text Association Verified'));
});
