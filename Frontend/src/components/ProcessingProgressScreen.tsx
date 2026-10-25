import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  XCircle,
  ArrowRight,
  FileText,
  Cpu,
} from 'lucide-react';
import { DEFAULT_PROCESSING_STAGES } from '../data/mockAuditData';
import { BackendProcessingProgress, ScreenId } from '../types/audit';

interface ProcessingProgressScreenProps {
  fileName: string;
  fileSizeMb: number;
  fullReportTotalPages: number;
  samplePdfFileName: string;
  samplePdfTotalPages: number;
  pagesProcessedCount: number;
  pageRangeInput: string;
  targetCandidateCount: number;
  /** Optional live backend progress stream/poller state; falls back to demonstration simulation when null */
  backendProgress?: BackendProcessingProgress | null;
  autoStartCounter: number;
  /** The current FastAPI endpoint is synchronous; no per-stage server telemetry exists. */
  synchronousProcessing?: boolean;
  onComplete: () => void;
  onNavigate: (screen: ScreenId) => void;
}

export const ProcessingProgressScreen: React.FC<ProcessingProgressScreenProps> = ({
  fileName,
  fileSizeMb,
  fullReportTotalPages,
  samplePdfFileName,
  samplePdfTotalPages,
  pagesProcessedCount,
  pageRangeInput,
  targetCandidateCount,
  backendProgress = null,
  autoStartCounter,
  synchronousProcessing = false,
  onComplete,
  onNavigate,
}) => {
  const [simulatedStageIndex, setSimulatedStageIndex] = useState<number>(0);
  const [simulatedStatus, setSimulatedStatus] = useState<
    'running' | 'completed' | 'cancelled' | 'error'
  >('running');
  const [simulatedError, setSimulatedError] = useState<string | null>(null);
  const [runKey, setRunKey] = useState<number>(0);

  const totalStages = DEFAULT_PROCESSING_STAGES.length;
  if (synchronousProcessing) {
    return <div className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-lg p-8 text-center space-y-3"><Cpu className="w-8 h-8 text-blue-600 animate-pulse mx-auto" /><h2 className="text-lg font-bold text-slate-900">Processing selected PDF pages</h2><p className="text-sm text-slate-600">FastAPI is processing {pagesProcessedCount} selected page(s) synchronously. This screen does not simulate server progress; results will open when the request completes.</p><p className="text-xs font-mono text-slate-500">{fileName} · pages {pageRangeInput}</p></div>;
  }
  const isUsingLiveBackend = Boolean(backendProgress && !backendProgress.isSimulated);

  // Reset local simulation when triggered and no external backend progress is driving state
  useEffect(() => {
    if (isUsingLiveBackend) return;
    setSimulatedStatus('running');
    setSimulatedError(null);
    setSimulatedStageIndex(0);
  }, [autoStartCounter, runKey, isUsingLiveBackend]);

  // Consume live backend completion if provided
  useEffect(() => {
    if (!backendProgress) return;
    if (backendProgress.status === 'completed') {
      const redirectTimer = setTimeout(() => {
        onComplete();
      }, 400);
      return () => clearTimeout(redirectTimer);
    }
  }, [backendProgress, onComplete]);

  // Demonstration fallback progression when no live backend job is connected
  useEffect(() => {
    if (isUsingLiveBackend) return;
    if (simulatedStatus !== 'running') return;

    if (simulatedStageIndex >= totalStages) {
      setSimulatedStatus('completed');
      const redirectTimer = setTimeout(() => {
        onComplete();
      }, 600);
      return () => clearTimeout(redirectTimer);
    }

    const stageDuration =
      DEFAULT_PROCESSING_STAGES[simulatedStageIndex]?.durationMs ?? 550;
    const timer = setTimeout(() => {
      setSimulatedStageIndex((prev) => Math.min(prev + 1, totalStages));
    }, stageDuration);

    return () => clearTimeout(timer);
  }, [simulatedStageIndex, simulatedStatus, totalStages, onComplete, isUsingLiveBackend]);

  // Resolve active metrics from either live backend progress or demonstration simulation
  const status = backendProgress ? backendProgress.status : simulatedStatus;
  const currentStageIndex = backendProgress
    ? backendProgress.currentStageIndex
    : simulatedStageIndex;
  const errorReason = backendProgress ? backendProgress.errorMessage : simulatedError;

  const progressPct =
    status === 'completed'
      ? 100
      : Math.min(99, Math.round(((currentStageIndex + 0.5) / totalStages) * 100));

  const processedPages = backendProgress
    ? backendProgress.processedPages
    : status === 'completed'
    ? pagesProcessedCount
    : Math.min(
        pagesProcessedCount,
        Math.max(1, Math.round((progressPct / 100) * pagesProcessedCount))
      );

  const candidatesFound = backendProgress
    ? backendProgress.candidatesFound
    : status === 'completed'
    ? targetCandidateCount
    : currentStageIndex < 2
    ? 0
    : Math.min(
        targetCandidateCount,
        Math.round(((currentStageIndex - 1) / (totalStages - 2)) * targetCandidateCount)
      );

  const remainingSeconds =
    backendProgress && typeof backendProgress.estimatedRemainingSeconds === 'number'
      ? backendProgress.estimatedRemainingSeconds
      : status === 'completed'
      ? 0
      : Math.max(1, Math.ceil((totalStages - currentStageIndex) * 0.6));

  const handleRestart = () => {
    setRunKey((prev) => prev + 1);
  };

  const handleCancel = () => {
    setSimulatedStatus('cancelled');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* File Metadata Header Card with Distinct Full Report, Sample PDF, and Processed Fields */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-medium text-teal-700">
                {isUsingLiveBackend
                  ? 'Live Backend Processing Telemetry'
                  : 'Demonstration Mode · Simulated Pipeline Progression (Ready for Backend Progress Updates)'}
              </div>
              <h2 className="text-base font-bold text-[#0F172A] font-mono">
                {fileName}
              </h2>
              <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
                File Size: {fileSizeMb} MB · Target Report Range: pp. {pageRangeInput}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {status === 'running' && !isUsingLiveBackend && (
              <button
                type="button"
                onClick={handleCancel}
                className="px-3 py-1.5 rounded-lg border border-red-200 text-xs font-semibold text-red-700 hover:bg-red-50 transition-colors"
              >
                Cancel Processing
              </button>
            )}
            {!isUsingLiveBackend && (
              <button
                type="button"
                onClick={handleRestart}
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restart Run</span>
              </button>
            )}
          </div>
        </div>

        {/* Separate Document Scope Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100 text-xs">
          <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200">
            <div className="text-[11px] text-slate-500">Full Annual Report PDF</div>
            <div className="font-mono font-bold text-slate-900 mt-0.5 tabular-nums truncate">
              {fileName} ({fullReportTotalPages} pages)
            </div>
          </div>
          <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200">
            <div className="text-[11px] text-slate-500">
              Selected-Page Sample PDF (pp. 222–226)
            </div>
            <div className="font-mono font-bold text-slate-900 mt-0.5 tabular-nums truncate">
              {samplePdfFileName} ({samplePdfTotalPages} pages)
            </div>
          </div>
          <div className="p-2.5 rounded-md bg-teal-50/50 border border-teal-200">
            <div className="text-[11px] text-teal-800">Actual Pages Processed</div>
            <div className="font-mono font-bold text-teal-900 mt-0.5 tabular-nums">
              {processedPages} of {pagesProcessedCount} pages
            </div>
          </div>
        </div>
      </div>

      {/* Error State Alert */}
      {status === 'error' && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-red-900"
        >
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-bold">Processing Pipeline Halted</div>
              <p className="text-xs text-red-800 mt-0.5">{errorReason}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRestart}
            className="px-3.5 py-2 rounded-lg bg-red-700 text-white text-xs font-semibold hover:bg-red-800 transition-colors whitespace-nowrap shrink-0"
          >
            Retry Pipeline Run
          </button>
        </div>
      )}

      {/* Cancelled State Alert */}
      {status === 'cancelled' && (
        <div
          role="status"
          className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-bold">Processing Cancelled by Auditor</div>
              <p className="text-xs text-amber-800 mt-0.5">
                The visual analysis run was stopped at {progressPct}% completion.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('upload')}
              className="px-3 py-1.5 rounded-lg border border-amber-300 bg-white text-amber-900 text-xs font-semibold hover:bg-amber-100"
            >
              Back to Upload
            </button>
            <button
              type="button"
              onClick={handleRestart}
              className="px-3 py-1.5 rounded-lg bg-amber-700 text-white text-xs font-semibold hover:bg-amber-800"
            >
              Restart Run
            </button>
          </div>
        </div>
      )}

      {/* Main Progress Dashboard Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pb-5 border-b border-slate-200">
          <div>
            <div className="text-xs font-medium text-slate-500">Overall Progress</div>
            <div className="text-2xl font-bold text-[#0F172A] font-mono tabular-nums mt-1">
              {progressPct}%
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Pages Processed</div>
            <div className="text-2xl font-bold text-[#0F172A] font-mono tabular-nums mt-1">
              {processedPages} / {pagesProcessedCount}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">
              Annotation Candidates Found
            </div>
            <div className="text-2xl font-bold text-teal-700 font-mono tabular-nums mt-1">
              {candidatesFound}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">
              {isUsingLiveBackend ? 'Remaining Time' : 'Simulated Remaining Time'}
            </div>
            <div className="text-2xl font-bold text-slate-700 font-mono tabular-nums mt-1">
              {status === 'completed'
                ? '0s (Done)'
                : status === 'running'
                ? `~${remainingSeconds}s`
                : 'Paused'}
            </div>
          </div>
        </div>

        {/* Overall Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-800 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-teal-600" />
              <span>
                {status === 'completed'
                  ? 'All 6 visual intelligence stages completed — Redirecting to Review Results'
                  : status === 'running'
                  ? `Active Stage: ${
                      DEFAULT_PROCESSING_STAGES[
                        Math.min(currentStageIndex, totalStages - 1)
                      ]?.label
                    }`
                  : status === 'error'
                  ? 'Pipeline halted on error'
                  : 'Pipeline cancelled'}
              </span>
            </span>
            <span className="font-mono text-slate-500 tabular-nums">
              Stage {Math.min(currentStageIndex + 1, totalStages)} of {totalStages}
            </span>
          </div>

          <div
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200"
          >
            <div
              className={`h-full transition-all duration-200 ${
                status === 'error'
                  ? 'bg-red-600'
                  : status === 'cancelled'
                  ? 'bg-amber-500'
                  : status === 'completed'
                  ? 'bg-emerald-600'
                  : 'bg-[#2563EB]'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* 6 Stages Checklist */}
        <div className="space-y-2.5">
          {DEFAULT_PROCESSING_STAGES.map((stage, index) => {
            const isStageCompleted =
              status === 'completed' || index < currentStageIndex;
            const isStageActive =
              status === 'running' && index === currentStageIndex;
            const isStageError =
              status === 'error' && index === currentStageIndex;

            return (
              <div
                key={stage.id}
                className={`p-3.5 rounded-lg border flex items-start justify-between gap-4 transition-colors ${
                  isStageCompleted
                    ? 'border-emerald-200 bg-emerald-50/30'
                    : isStageActive
                    ? 'border-blue-300 bg-blue-50/40'
                    : isStageError
                    ? 'border-red-300 bg-red-50/40'
                    : 'border-slate-200 bg-slate-50/40'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {isStageCompleted ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : isStageError ? (
                      <XCircle className="w-4 h-4 text-red-600" />
                    ) : isStageActive ? (
                      <Clock className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Clock className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                  <div>
                    <div
                      className={`text-xs font-bold ${
                        isStageCompleted
                          ? 'text-emerald-950'
                          : isStageActive
                          ? 'text-blue-950'
                          : isStageError
                          ? 'text-red-950'
                          : 'text-slate-600'
                      }`}
                    >
                      {stage.label}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {stage.description}
                    </div>
                  </div>
                </div>

                <span
                  className={`text-xs font-mono font-semibold whitespace-nowrap shrink-0 ${
                    isStageCompleted
                      ? 'text-emerald-700'
                      : isStageActive
                      ? 'text-blue-700'
                      : isStageError
                      ? 'text-red-700'
                      : 'text-slate-400'
                  }`}
                >
                  {isStageCompleted
                    ? 'Completed'
                    : isStageError
                    ? 'Failed'
                    : isStageActive
                    ? 'In Progress'
                    : 'Pending'}
                </span>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            Ready to consume live backend progress updates via <code className="font-mono">BackendProcessingProgress</code> or proceed directly to Review Results.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('review-results')}
            className="px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap self-end sm:self-auto"
          >
            <span>Proceed to Review Results</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
