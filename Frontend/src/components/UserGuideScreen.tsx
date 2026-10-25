import React from 'react';
import { AlertTriangle, ArrowRight, BookOpen, CheckCircle2, HelpCircle, ShieldCheck, Sparkles } from 'lucide-react';

const detections = [
  ['Tick / Check', 'A visual check or tick mark', 'Locate items that may have been reviewed or marked as checked'],
  ['Cross', 'A cross or X-shaped annotation', 'Locate items marked for attention or further review'],
  ['Circle', 'A circular mark around a value or region', 'Find circled figures, references, or emphasized content'],
  ['Arrow', 'An arrow-shaped annotation', 'Locate references pointing to a figure, line, or region'],
  ['Highlight', 'A visually highlighted region', 'Find emphasized text or figures'],
  ['Underline', 'An underline annotation', 'Locate emphasized text or values'],
];

const cloudServices = [
  ['Amazon ECS Express Mode', 'Hosts the frontend and FastAPI backend containers and provides the managed deployment endpoint.', 'Deployment target; verify the current service revision before relying on it.'],
  ['Amazon ECR', 'Stores the versioned frontend and backend Docker images.', 'Images are pushed before an ECS deployment.'],
  ['Amazon S3', 'Durable storage for demo data and document JSON artifacts such as metadata, OpenCV results, and AI validation results.', 'Used when the S3 storage backend is enabled; the backend performs all reads and writes.'],
  ['Amazon Bedrock Mantle', 'OpenAI-compatible API used to access Google Gemma for supplementary finding validation.', 'Optional, only when AI validation is enabled and the API key is available.'],
  ['AWS IAM', 'Separates ECS execution, application task, and Express infrastructure permissions.', 'Execution and infrastructure roles support ECS; an application task role with least-privilege S3 access is required for deployed S3 mode.'],
  ['AWS Secrets Manager', 'Intended secure storage for AWS_BEARER_TOKEN_BEDROCK and ECS secret injection.', 'Planned deployment integration; do not place the key in source code or images.'],
  ['Amazon CloudWatch Logs', 'Provides application and container logs for processing, startup, validation, and AWS API troubleshooting.', 'Available through the deployed logging configuration; exact group and retention settings should be verified per environment.'],
];

export const UserGuideScreen: React.FC = () => (
  <div className="max-w-6xl mx-auto space-y-6">
    <section className="bg-white border border-slate-200 rounded-lg p-6">
      <div className="flex items-start gap-3"><BookOpen className="w-6 h-6 text-teal-600 mt-0.5" /><div><h2 className="text-xl font-bold text-slate-900">AuditVision AI — User Guide</h2><p className="text-sm text-slate-600 mt-1">Understand visual audit annotations, review detected findings, and use AI-assisted validation.</p></div></div>
    </section>

    <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-3">
      <h3 className="text-lg font-bold text-slate-900">What is AuditVision AI?</h3>
      <p className="text-sm text-slate-600 leading-6">AuditVision AI helps auditors examine marked-up audit documents more efficiently. OpenCV identifies supported visual annotation patterns in PDF pages. When enabled, an AI service provides supplementary review of selected OpenCV findings.</p>
      <p className="text-sm text-slate-600 leading-6">It supports document review; it does not replace professional audit judgement or certify the correctness of financial statements.</p>
    </section>

    <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
      <div><h3 className="text-lg font-bold text-slate-900">Supported visual detections</h3><p className="text-sm text-slate-600 mt-1">These are visual patterns detected by the current OpenCV baseline.</p></div>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs text-slate-500"><th className="py-3 pr-4">Detection type</th><th className="py-3 px-4">What it represents</th><th className="py-3 pl-4">Reviewer use</th></tr></thead><tbody className="divide-y divide-slate-200">{detections.map(([type, meaning, use]) => <tr key={type}><td className="py-3 pr-4 font-semibold text-slate-900 whitespace-nowrap">{type}</td><td className="py-3 px-4 text-slate-600">{meaning}</td><td className="py-3 pl-4 text-slate-600">{use}</td></tr>)}</tbody></table></div>
      <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><AlertTriangle className="w-5 h-5 shrink-0" /><p>Detection identifies visual patterns, not business meaning. A tick does not prove a control passed, and a circle does not prove a financial value is correct. Signature authenticity, stamp validity, accounting correctness, and regulatory compliance are not established by this detector.</p></div>
    </section>

    <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4"><h3 className="text-lg font-bold text-slate-900">How to use the application</h3><ol className="space-y-4 text-sm text-slate-600">{[
      ['Open the dashboard', 'Review available reports and choose the report row you want to inspect.'],
      ['Upload a PDF', 'Upload a readable audit PDF that you are authorized to process.'],
      ['Wait for OpenCV processing', 'The backend renders the selected pages and searches for supported visual marks.'],
      ['Review findings', 'Compare each detection with the original page. Detectors can miss faint or overlapping marks and can classify document graphics incorrectly.'],
      ['Review AI validation', 'When enabled, validation runs asynchronously after OpenCV publishes its artifacts. Treat its explanations as supplementary evidence.'],
      ['Revisit saved results', 'Results use local storage during development or S3 in the configured deployment environment. Refresh if background validation is still pending.'],
    ].map(([title, description], index) => <li key={title} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">{index + 1}</span><div><p className="font-semibold text-slate-900">{title}</p><p className="mt-1 leading-6">{description}</p></div></li>)}</ol></section>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-3"><div className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-teal-600" /><h3 className="text-lg font-bold text-slate-900">OpenCV and AI validation</h3></div><p className="text-sm text-slate-600 leading-6"><strong>OpenCV detection</strong> supplies the initial visual findings. <strong>AI validation</strong> reviews selected findings as an assistive second stage. Document processing may finish before the AI result is available.</p><p className="text-sm text-slate-600 leading-6">AI output may contain errors or omissions and must be checked against the original document.</p></section>
      <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-3"><div className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-600" /><h3 className="text-lg font-bold text-slate-900">Tips for better results</h3></div><ul className="list-disc pl-5 space-y-2 text-sm text-slate-600"><li>Use clear PDFs with good contrast and minimal skew or blur.</li><li>Review every finding in the context of the original page.</li><li>Pay attention to marks overlapping text, tables, or graphics.</li><li>Do not treat no detections as proof that a document has no annotations.</li><li>Upload sensitive documents only when authorized.</li></ul></section>
    </div>

    <section className="bg-slate-50 border border-slate-200 rounded-lg p-6"><div className="flex gap-3"><HelpCircle className="w-5 h-5 text-blue-600 shrink-0" /><div><h3 className="text-lg font-bold text-slate-900">Troubleshooting and responsible use</h3><p className="text-sm text-slate-600 mt-2 leading-6">No detections may mean that the document has no supported marks or that image quality limited detection. Unexpected detections can come from logos, table graphics, or scan artefacts. AI validation may be pending or unavailable while OpenCV findings remain usable. Always compare important findings with original evidence and apply qualified professional judgement.</p></div></div></section>

    <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
      <div><h3 className="text-lg font-bold text-slate-900">AWS Architecture &amp; Cloud Resources</h3><p className="text-sm text-slate-600 mt-1 leading-6">AuditVision AI combines browser-based review, containerized processing, durable JSON storage, and optional AI-assisted validation. OpenCV produces the initial visual findings; AI is a separate supplementary stage.</p></div>
      <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-semibold text-slate-700" aria-label="AuditVision processing workflow">
        {['User', 'React Frontend', 'ECS FastAPI Backend', 'OpenCV Detection', 'S3 JSON Storage', 'Optional Bedrock / Gemma', 'S3 AI Results', 'Frontend Results'].map((step, index, items) => <React.Fragment key={step}><div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${step.includes('Optional') ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-slate-200 bg-slate-50'}`}><span>{step}</span></div>{index < items.length - 1 && <ArrowRight className="w-4 h-4 text-slate-400" aria-hidden="true" />}</React.Fragment>)}
      </div>
      <p className="text-xs text-slate-500 text-center">OpenCV processing returns its findings without waiting for the asynchronous AI validation job to finish.</p>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs text-slate-500"><th className="py-3 pr-4">AWS resource or service</th><th className="py-3 px-4">Purpose in AuditVision AI</th><th className="py-3 pl-4">When it is used</th></tr></thead><tbody className="divide-y divide-slate-200">{cloudServices.map(([service, purpose, timing]) => <tr key={service}><td className="py-3 pr-4 font-semibold text-slate-900 whitespace-nowrap">{service}</td><td className="py-3 px-4 text-slate-600">{purpose}</td><td className="py-3 pl-4 text-slate-600">{timing}</td></tr>)}</tbody></table></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4"><div className="flex items-center gap-2 text-sm font-semibold text-emerald-900"><CheckCircle2 className="w-4 h-4" />Configured in the project</div><p className="text-xs text-emerald-800 mt-2 leading-5">Frontend and backend container definitions, ECR image targets, Boto3 S3 support, and the Bedrock Mantle model configuration are represented in the project.</p></div><div className="rounded-lg border border-amber-200 bg-amber-50 p-4"><div className="flex items-center gap-2 text-sm font-semibold text-amber-900"><AlertTriangle className="w-4 h-4" />Deployment-dependent</div><p className="text-xs text-amber-800 mt-2 leading-5">Assigning the ECS application task role, injecting the Bedrock key from Secrets Manager, and verifying the complete deployed OpenCV → S3 → Gemma → S3 workflow must be completed and verified in the target environment.</p></div></div>
    </section>

    <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-3"><div className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-teal-600" /><h3 className="text-lg font-bold text-slate-900">Cloud security notes</h3></div><ul className="list-disc pl-5 space-y-2 text-sm text-slate-600"><li>S3 should remain private with Block Public Access, server-side encryption, and versioning enabled.</li><li>Use least-privilege IAM roles; the ECS execution role and application task role are different.</li><li>Keep developer credentials out of Docker images and source control.</li><li>Store the Bedrock API key in Secrets Manager for deployed ECS tasks.</li><li>ECS, S3, Bedrock, and logging services may incur usage charges.</li></ul></section>
  </div>
);
