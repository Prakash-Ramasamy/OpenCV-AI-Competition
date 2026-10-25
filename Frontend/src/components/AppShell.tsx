import React, { useState } from 'react';
import {
  LayoutDashboard,
  UploadCloud,
  FileBarChart2,
  Bell,
  ChevronRight,
  UserCheck,
  ShieldAlert,
  Menu,
  X,
  Activity,
  Eye,
  BookOpen,
} from 'lucide-react';
import { AnnotationRecord, DataSourceMode, ScreenId, SummaryMetrics } from '../types/audit';

interface AppShellProps {
  activeScreen: ScreenId;
  onNavigate: (screen: ScreenId) => void;
  metrics: SummaryMetrics;
  activeDocumentName: string;
  fullReportTotalPages: number;
  samplePdfTotalPages: number;
  pagesProcessedCount: number;
  dataSourceMode: DataSourceMode;
  annotations: AnnotationRecord[];
  onInspectAnnotation: (annotationId: string) => void;
  isProcessingActive: boolean;
  children: React.ReactNode;
}

const SCREEN_META: Record<
  ScreenId,
  { title: string; breadcrumb: string[] }
> = {
  home: {
    title: 'Audit Intelligence Dashboard',
    breadcrumb: ['Workspace', 'Home'],
  },
  upload: {
    title: 'Upload & Process Audit Document',
    breadcrumb: ['Workspace', 'Upload & Process'],
  },
  processing: {
    title: 'Processing Progress',
    breadcrumb: ['Workspace', 'Upload & Process', 'Processing Progress'],
  },
  'review-results': {
    title: 'Report Findings',
    breadcrumb: ['Workspace', 'Report Review'],
  },
  'document-viewer': {
    title: 'Annotation Detail & Decision',
    breadcrumb: ['Workspace', 'Review Results', 'Annotation Detail & Decision'],
  },
  reports: {
    title: 'Audit Review Reports & Data Export',
    breadcrumb: ['Workspace', 'Reports & Export'],
  },
  'user-guide': {
    title: 'User Guide',
    breadcrumb: ['Workspace', 'User Guide'],
  },
};

export const AppShell: React.FC<AppShellProps> = ({
  activeScreen,
  onNavigate,
  metrics,
  activeDocumentName,
  fullReportTotalPages,
  samplePdfTotalPages,
  pagesProcessedCount,
  dataSourceMode,
  annotations,
  onInspectAnnotation,
  isProcessingActive,
  children,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const currentMeta = SCREEN_META[activeScreen];
  const highPriorityItems = annotations.filter(
    (a) => a.status === 'Pending' || a.status === 'Needs Investigation'
  );

  // Simplified main navigation: Home, Upload & Process, Reports & Export.
  // Review Results is opened from a report row so its badge cannot become stale
  // while a different report is selected.
  const navItems: {
    id: ScreenId;
    label: string;
    icon: React.FC<{ className?: string }>;
    badge?: string | number;
  }[] = [
    {
      id: 'home',
      label: 'Home',
      icon: LayoutDashboard,
    },
    {
      id: 'upload',
      label: 'Upload & Process',
      icon: UploadCloud,
      badge: isProcessingActive ? 'Running' : undefined,
    },
    {
      id: 'reports',
      label: 'Reports & Export',
      icon: FileBarChart2,
    },
    {
      id: 'user-guide',
      label: 'User Guide',
      icon: BookOpen,
    },
  ];

  const handleNavClick = (screen: ScreenId) => {
    onNavigate(screen);
    setMobileMenuOpen(false);
    setNotificationsOpen(false);
    setProfileMenuOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#F8FAFC] text-[#0F172A]">
      {/* Persistent Left Sidebar (Desktop) */}
      <aside
        aria-label="Primary Sidebar Navigation"
        className="hidden lg:flex lg:w-64 xl:w-68 bg-[#0F172A] text-slate-200 flex-col shrink-0 border-r border-slate-800 select-none"
      >
        {/* Brand Lockup */}
        <div className="px-5 py-5 border-b border-slate-800/80 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-teal-600/20 border border-teal-500/40 flex items-center justify-center text-teal-400 shrink-0">
            <Eye className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-base font-bold tracking-tight text-white font-display truncate">
              AuditVision AI
            </div>
            <div className="text-[11px] text-teal-400 font-semibold tracking-wide truncate">
              OpenCV AI Competition 2026
            </div>
          </div>
        </div>

        {false && <>
        {/* Active Engagement Context with Distinct Document & Page Fields */}
        <div className="px-5 py-3.5 border-b border-slate-800/80 bg-slate-900/60 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-medium text-slate-400">
            <span>Active Audit File</span>
            <span className="text-teal-400 font-mono">
              {dataSourceMode === 'real-opencv' ? 'OpenCV JSON' : 'Demo Mode'}
            </span>
          </div>
          <div className="text-xs font-medium text-slate-200 truncate font-mono">
            {activeDocumentName}
          </div>
          <div className="text-[11px] text-slate-400 font-mono tabular-nums space-y-0.5 pt-0.5">
            <div>Full Report: {fullReportTotalPages} pages</div>
            <div>
              Sample PDF: {samplePdfTotalPages} pp · Processed: {pagesProcessedCount} pp
            </div>
          </div>
        </div>
        </>}

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Main Menu">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              activeScreen === item.id ||
              (item.id === 'upload' && activeScreen === 'processing') ||
              (item.id === 'review-results' && activeScreen === 'document-viewer');

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-white' : 'text-slate-400'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.badge && (
                  <span
                    className={`text-[11px] font-mono tabular-nums shrink-0 ${
                      isActive ? 'text-blue-100' : 'text-amber-400'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Review Progress Widget */}
        <div className="p-4 m-3 rounded-lg bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5">
            <span>Review Completion</span>
            <span className="font-mono font-semibold text-teal-400 tabular-nums">
              {metrics.completionPercentage}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-teal-500 transition-all duration-200"
              style={{ width: `${metrics.completionPercentage}%` }}
            />
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400 tabular-nums">
            <span>Approved: {metrics.approvedCount}</span>
            <span>·</span>
            <span>Pending: {metrics.pendingCount}</span>
          </div>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <div className="lg:hidden bg-[#0F172A] text-white px-4 py-3 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-teal-600/20 border border-teal-500/40 flex items-center justify-center text-teal-400">
            <Eye className="w-4 h-4" />
          </div>
          <span className="font-bold text-sm font-display">AuditVision AI</span>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle Navigation Menu"
          className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#0F172A] text-slate-200 border-b border-slate-800 px-4 py-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              activeScreen === item.id ||
              (item.id === 'upload' && activeScreen === 'processing') ||
              (item.id === 'review-results' && activeScreen === 'document-viewer');
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between gap-4 shrink-0">
          <div className="min-w-0">
            {/* Breadcrumb */}
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500 mb-0.5">
              {currentMeta.breadcrumb.map((crumb, idx) => (
                <React.Fragment key={crumb}>
                  {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                  <span
                    className={
                      idx === currentMeta.breadcrumb.length - 1
                        ? 'text-slate-700 font-medium truncate'
                        : 'truncate'
                    }
                  >
                    {crumb}
                  </span>
                </React.Fragment>
              ))}
            </nav>
            <h1 className="text-lg font-bold text-[#0F172A] tracking-tight truncate font-display">
              {currentMeta.title}
            </h1>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-3 shrink-0">
            {(activeScreen === 'upload' || activeScreen === 'processing') && (
              <div className="hidden sm:flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => onNavigate('upload')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    activeScreen === 'upload'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Upload & Process</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('processing')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    activeScreen === 'processing'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Processing Progress</span>
                </button>
              </div>
            )}

            {/* Notification Popover */}
            <div className="relative hidden">
              <button
                type="button"
                onClick={() => {
                  setNotificationsOpen(!notificationsOpen);
                  setProfileMenuOpen(false);
                }}
                aria-label={`Review Alerts (${highPriorityItems.length} items requiring attention)`}
                className="relative inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
              >
                <Bell className="w-4 h-4 shrink-0" />
                {highPriorityItems.length > 0 && (
                  <span className="text-xs font-mono font-semibold text-amber-700 tabular-nums">
                    {highPriorityItems.length}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-lg shadow-lg z-40 p-3">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                    <span className="text-xs font-semibold text-slate-900">
                      Pending & Flagged Findings ({highPriorityItems.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setNotificationsOpen(false);
                        onNavigate('home');
                      }}
                      className="text-xs text-blue-600 hover:underline font-medium"
                    >
                      View Reports
                    </button>
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-1.5">
                    {highPriorityItems.slice(0, 5).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setNotificationsOpen(false);
                          onInspectAnnotation(item.id);
                        }}
                        className="w-full text-left p-2 rounded-md hover:bg-slate-50 transition-colors flex items-start justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-slate-900 truncate">
                            {item.id} · {item.annotationType} ({item.extractedText})
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            Report p.{item.originalReportPageNumber} (Sample idx {item.samplePdfPageIndex}) · {item.rowLabel}
                          </div>
                        </div>
                        <span className="text-[11px] font-mono text-amber-700 shrink-0">
                          {item.status}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Menu */}
            <div className="relative hidden">
              <button
                type="button"
                onClick={() => {
                  setProfileMenuOpen(!profileMenuOpen);
                  setNotificationsOpen(false);
                }}
                aria-label="User Profile Menu — Ananya Sharma, CPA"
                className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                <div className="w-7 h-7 rounded-md bg-[#0F172A] text-white flex items-center justify-center text-xs font-semibold font-display">
                  AS
                </div>
                <div className="hidden md:block text-left">
                  <div className="text-xs font-semibold text-slate-900 leading-tight">
                    Ananya Sharma, CPA
                  </div>
                  <div className="text-[11px] text-slate-500 leading-tight">
                    Lead Audit Manager
                  </div>
                </div>
              </button>

              {profileMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-40 p-3 space-y-2">
                  <div className="pb-2 border-b border-slate-100">
                    <div className="text-xs font-semibold text-slate-900">
                      Ananya Sharma, CPA
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Statutory Financial Assurance · Engagement #IN-2025-04
                    </div>
                  </div>
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => handleNavClick('reports')}
                      className="w-full text-left px-2.5 py-1.5 rounded-md text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                    >
                      <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                      <span>Export Audit Sign-Off Log</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Viewport Content */}
        <main className="flex-1 p-6 max-w-[1440px] w-full mx-auto">
          {children}
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-slate-200 px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">AuditVision AI v1.4.0</span>
            <span>·</span>
            <span>Enterprise Audit Review Workbench</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500">
            <ShieldAlert className="w-3.5 h-3.5 text-teal-600 shrink-0" />
            <span>
              {dataSourceMode === 'real-opencv'
                ? 'Active Mode: Real OpenCV Detection Output — Approval is for review workflow only.'
                : 'Demonstration Data Mode — Synthetic sample detections; approval is for workflow review only.'}
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
};
