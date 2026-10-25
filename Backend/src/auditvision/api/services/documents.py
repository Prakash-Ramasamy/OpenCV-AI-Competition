from __future__ import annotations

import json
import os
import shutil
import uuid
from datetime import datetime, timezone
from collections import Counter
from pathlib import Path

import cv2
import fitz
from fastapi import HTTPException, UploadFile

from ...dataset_runner import detect_marks
from ...pipeline import render_pdf_page
from ..schemas import AIValidationResponse, DocumentListItem, DocumentProcessResponse, DocumentSummaryResponse, DocumentUploadResponse, ProcessRequest, ReviewUpdateRequest, SampleResultsResponse
from .ai_validation import is_enabled, validate_document
from .json_storage import JsonObjectMissing, JsonStorageError, create_json_storage
from .sample_results import BACKEND_ROOT, SampleResultsStore


def _int_env(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError as error:
        raise RuntimeError(f"{name} must be an integer.") from error


def _documents_root() -> Path:
    raw = Path(os.getenv("AUDITVISION_DOCUMENTS_DIR", "data/documents"))
    path = (raw if raw.is_absolute() else BACKEND_ROOT / raw).resolve()
    try:
        path.relative_to(BACKEND_ROOT.resolve())
    except ValueError as error:
        raise RuntimeError("AUDITVISION_DOCUMENTS_DIR must resolve inside Backend.") from error
    return path


class DocumentService:
    """Owns upload metadata and artifacts; detector algorithms remain unchanged."""

    def __init__(self, root: Path | None = None, max_upload_bytes: int | None = None, max_page_count: int | None = None, max_pages_per_request: int | None = None):
        self.root = (root or _documents_root()).resolve()
        self.max_upload_bytes = max_upload_bytes if max_upload_bytes is not None else _int_env("AUDITVISION_MAX_UPLOAD_BYTES", 25 * 1024 * 1024)
        self.max_page_count = max_page_count if max_page_count is not None else _int_env("AUDITVISION_MAX_PAGE_COUNT", 50)
        self.max_pages_per_request = max_pages_per_request if max_pages_per_request is not None else _int_env("AUDITVISION_MAX_PAGES_PER_REQUEST", 5)
        self.storage = create_json_storage()
        self.storage_backend = os.getenv("AUDITVISION_STORAGE_BACKEND", "local").lower()

    @property
    def documents_prefix(self) -> str:
        return os.getenv("AUDITVISION_S3_DOCUMENTS_PREFIX", "documents/").strip("/") + "/"

    def _object_key(self, document_id: str, name: str) -> str:
        return f"{self.documents_prefix}{document_id}/{name}"

    def _put_document_json(self, document_id: str, name: str, payload: dict) -> None:
        if self.storage_backend == "s3":
            self.storage.put_json(self._object_key(document_id, name), payload)

    def _get_document_json(self, document_id: str, name: str) -> dict:
        try:
            payload = self.storage.get_json(self._object_key(document_id, name))
        except JsonObjectMissing as error:
            raise HTTPException(404, f"Saved artifact not found: {name}") from error
        except JsonStorageError as error:
            raise HTTPException(503, f"Saved artifact is unavailable: {name}") from error
        if not isinstance(payload, dict):
            raise HTTPException(503, f"Saved artifact is malformed: {name}")
        return payload

    def _directory(self, document_id: str) -> Path:
        if not document_id.startswith("doc-") or any(char not in "abcdefghijklmnopqrstuvwxyz0123456789-" for char in document_id):
            raise HTTPException(404, "Document not found.")
        path = (self.root / document_id).resolve()
        try: path.relative_to(self.root)
        except ValueError as error: raise HTTPException(404, "Document not found.") from error
        if not path.is_dir(): raise HTTPException(404, "Document not found.")
        return path

    @staticmethod
    def _read_metadata(directory: Path) -> dict:
        try: return json.loads((directory / "metadata.json").read_text(encoding="utf-8"))
        except (FileNotFoundError, json.JSONDecodeError) as error: raise HTTPException(503, "Document metadata is unavailable.") from error

    @staticmethod
    def _write_metadata(directory: Path, metadata: dict) -> None:
        (directory / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    async def upload(self, file: UploadFile) -> DocumentUploadResponse:
        filename = Path(file.filename or "").name
        if not filename.lower().endswith(".pdf"): raise HTTPException(415, "Only PDF files are accepted.")
        content = await file.read(self.max_upload_bytes + 1)
        if not content.startswith(b"%PDF-"): raise HTTPException(415, "Uploaded content is not a PDF.")
        if len(content) > self.max_upload_bytes: raise HTTPException(413, "Uploaded PDF exceeds the configured size limit.")
        try:
            pdf = fitz.open(stream=content, filetype="pdf"); page_count = len(pdf); pdf.close()
        except (fitz.FileDataError, RuntimeError, ValueError) as error:
            raise HTTPException(422, "Uploaded PDF could not be opened.") from error
        if page_count < 1 or page_count > self.max_page_count: raise HTTPException(422, f"PDF page count must be between 1 and {self.max_page_count}.")
        document_id = f"doc-{uuid.uuid4()}"; directory = self.root / document_id; directory.mkdir(parents=True, exist_ok=False)
        (directory / "original.pdf").write_bytes(content)
        metadata = {"document_id": document_id, "original_filename": filename, "page_count": page_count, "file_size_bytes": len(content), "status": "uploaded"}
        self._write_metadata(directory, metadata)
        try:
            self._put_document_json(document_id, "metadata.json", metadata)
        except JsonStorageError as error:
            raise HTTPException(503, "Document metadata could not be saved to configured JSON storage.") from error
        return DocumentUploadResponse(**metadata)

    def list_documents(self) -> list[DocumentListItem]:
        documents: list[DocumentListItem] = []
        if self.storage_backend == "s3":
            keys = self.storage.list_keys(self.documents_prefix)
            document_ids = sorted({key[len(self.documents_prefix):].split("/", 1)[0] for key in keys if key.startswith(self.documents_prefix) and "/metadata.json" in key})
            for document_id in document_ids:
                try:
                    metadata = self._get_document_json(document_id, "metadata.json")
                except HTTPException:
                    continue
                try:
                    metadata["total_detections"] = int(self._get_document_json(document_id, "opencv-results.json").get("summary", {}).get("total_detections", 0))
                except HTTPException:
                    metadata["total_detections"] = 0
                documents.append(DocumentListItem(**metadata))
            return documents
        if not self.root.exists():
            return []
        for directory in self.root.iterdir():
            if not directory.is_dir() or not directory.name.startswith("doc-"):
                continue
            try:
                metadata = self._read_metadata(directory)
                summary = json.loads((directory / "artifacts" / "summary.json").read_text(encoding="utf-8"))
                metadata["processed_page_indexes"] = summary.get("processed_page_indexes", [])
                metadata["total_detections"] = int(summary.get("total_detections", 0))
                documents.append(DocumentListItem(**metadata))
            except (HTTPException, FileNotFoundError, json.JSONDecodeError, ValueError):
                continue
        return sorted(documents, key=lambda item: item.document_id)

    def process(self, document_id: str, request: ProcessRequest) -> DocumentProcessResponse:
        directory = self._directory(document_id); metadata = self._read_metadata(directory)
        if metadata.get("status") == "processed": raise HTTPException(409, "Document has already been processed; saved artifacts are read-only.")
        page_count = int(metadata["page_count"]); pages = request.page_indexes or list(range(1, min(page_count, self.max_pages_per_request) + 1))
        if len(pages) > self.max_pages_per_request or len(set(pages)) != len(pages) or any(not isinstance(page, int) or page < 1 or page > page_count for page in pages):
            raise HTTPException(422, f"Supply unique 1-based page indexes within the PDF; at most {self.max_pages_per_request} pages.")
        allowed = {item.lower() for item in request.annotation_types} if request.annotation_types else None
        staging = directory / "artifacts-staging"; artifacts = directory / "artifacts"
        if staging.exists() or artifacts.exists(): raise HTTPException(409, "Document has existing processing artifacts.")
        staging.mkdir(); detections = []
        try:
            with fitz.open(directory / "original.pdf") as pdf:
                for page_index in pages:
                    image = render_pdf_page(str(directory / "original.pdf"), page_index, 150)
                    cv2.imwrite(str(staging / f"page-{page_index:02d}.png"), image)
                    words = pdf.load_page(page_index - 1).get_text("words")
                    page_detections = [item for item in detect_marks(image) if allowed is None or item["type"].lower() in allowed]
                    preview = image.copy()
                    for item in page_detections:
                        x0,y0,x1,y1=item["bbox_pixels"]; cx,cy=(x0+x1)/2,(y0+y1)/2
                        item.update({"excerpt_pdf_page":page_index, "bbox_pdf_points":[round(value / (150/72), 2) for value in item["bbox_pixels"]], "bbox_normalized":[round(x0/image.shape[1],6),round(y0/image.shape[0],6),round(x1/image.shape[1],6),round(y1/image.shape[0],6)], "center_pixels":[cx,cy], "associated_text":min(words, key=lambda word: ((word[0]+word[2])/2-cx/(150/72))**2+((word[1]+word[3])/2-cy/(150/72))**2, default=["","","","",""])[4]})
                        cv2.rectangle(preview, (x0,y0), (x1,y1), (0,180,0), 2)
                    cv2.imwrite(str(staging / f"annotated-page-{page_index:02d}.png"), preview); detections.extend(page_detections)
            (staging / "detections.json").write_text(json.dumps(detections, indent=2), encoding="utf-8")
            summary = {"document_id": document_id, "status": "processed", "processed_page_indexes": pages, "total_detections": len(detections), "detections_by_type": dict(sorted(Counter(item["type"] for item in detections).items()))}
            (staging / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
            staging.replace(artifacts); metadata.update({"status":"processed", "processed_page_indexes":pages}); self._write_metadata(directory, metadata)
            self._put_document_json(document_id, "metadata.json", metadata)
            self._put_document_json(document_id, "opencv-results.json", {"document_id": document_id, "metadata": metadata, "summary": summary, "detections": detections})
            return DocumentProcessResponse(document_id=document_id, status="processed", processed_page_indexes=pages, total_detections=len(detections))
        except Exception as error:
            metadata.update({"status":"failed", "processing_error":str(error)}); self._write_metadata(directory, metadata)
            raise HTTPException(500, "Document processing failed; no successful artifact set was published.") from error

    def results(self, document_id: str) -> SampleResultsResponse:
        directory=self._directory(document_id); self._read_metadata(directory)
        if self.storage_backend == "s3":
            payload = self._get_document_json(document_id, "opencv-results.json")
            return SampleResultsResponse(result_set=document_id, total_detections=len(payload.get("detections", [])), detections=SampleResultsStore(directory / "artifacts", directory / "no-ground-truth.json").detections_from_raw(payload.get("detections", [])))
        return SampleResultsStore(directory / "artifacts", directory / "no-ground-truth.json").results()

    def summary(self, document_id: str) -> DocumentSummaryResponse:
        directory=self._directory(document_id); metadata=self._read_metadata(directory)
        if self.storage_backend == "s3":
            payload = self._get_document_json(document_id, "opencv-results.json").get("summary")
            if not isinstance(payload, dict):
                raise HTTPException(404, "Document processing summary not found.")
        else:
            try: payload=json.loads((directory / "artifacts" / "summary.json").read_text(encoding="utf-8"))
            except (FileNotFoundError, json.JSONDecodeError) as error: raise HTTPException(404, "Document processing summary not found.") from error
        return DocumentSummaryResponse(**payload)

    def update_review(self, document_id: str, request: ReviewUpdateRequest) -> SampleResultsResponse:
        """Persist reviewer state alongside the immutable detector geometry."""
        if request.status not in {"Pending", "Approved", "Rejected", "Needs Investigation"}:
            raise HTTPException(422, "Unsupported review status.")
        directory = self._directory(document_id)
        if self.storage_backend == "s3":
            payload = self._get_document_json(document_id, "opencv-results.json")
            detections = payload.get("detections")
        else:
            try:
                detections = json.loads((directory / "artifacts" / "detections.json").read_text(encoding="utf-8"))
            except (FileNotFoundError, json.JSONDecodeError) as error:
                raise HTTPException(404, "Document processing results not found.") from error
        if not isinstance(detections, list):
            raise HTTPException(503, "Saved detection results are malformed.")
        try:
            index = int(request.detection_id.rsplit("-", 1)[1]) - 1
        except (ValueError, IndexError):
            index = -1
        if index < 0 or index >= len(detections):
            raise HTTPException(404, "Detection not found.")
        item = detections[index]
        if not isinstance(item, dict):
            raise HTTPException(503, "Saved detection result is malformed.")
        item["status"] = request.status
        item["reviewer_comment"] = request.reviewer_comment
        item["reviewed_by"] = "Ananya Sharma, CPA"
        item["reviewed_at"] = datetime.now(timezone.utc).isoformat()
        if self.storage_backend == "s3":
            payload["detections"] = detections
            self.storage.put_json(self._object_key(document_id, "opencv-results.json"), payload)
        else:
            (directory / "artifacts" / "detections.json").write_text(json.dumps(detections, indent=2), encoding="utf-8")
        return self.results(document_id)

    def auto_validate(self, document_id: str) -> None:
        """Run optional AI validation after OpenCV publishes its artifacts."""
        self.validate_now(document_id)

    def validate_now(self, document_id: str) -> AIValidationResponse:
        """Validate and publish the result to local artifacts and configured JSON storage."""
        directory = self._directory(document_id)
        target = directory / "artifacts" / "ai-validation.json"
        temporary = directory / "artifacts" / "ai-validation.json.tmp"
        try:
            result = validate_document(directory, document_id)
        except Exception as error:
            result = AIValidationResponse(
                document_id=document_id,
                enabled=True,
                model=os.getenv("AUDITVISION_AI_MODEL", "google.gemma-4-e2b"),
                results=[{"detection_id": "*", "error": f"AI validation failed: {error}"}],
            )
        temporary.write_text(result.model_dump_json(indent=2), encoding="utf-8")
        temporary.replace(target)
        self._put_document_json(document_id, "ai-validation.json", result.model_dump())
        return result

    def ai_validation(self, document_id: str) -> AIValidationResponse:
        directory = self._directory(document_id)
        if self.storage_backend == "s3":
            try:
                return AIValidationResponse.model_validate(self._get_document_json(document_id, "ai-validation.json"))
            except HTTPException as error:
                if error.status_code != 404:
                    raise
                return AIValidationResponse(document_id=document_id, enabled=is_enabled(), model=os.getenv("AUDITVISION_AI_MODEL", "google.gemma-4-e2b"))
        path = directory / "artifacts" / "ai-validation.json"
        if not path.is_file():
            return AIValidationResponse(
                document_id=document_id,
                enabled=is_enabled(),
                model=os.getenv("AUDITVISION_AI_MODEL", "google.gemma-4-e2b"),
            )
        try:
            return AIValidationResponse.model_validate_json(path.read_text(encoding="utf-8"))
        except (OSError, ValueError) as error:
            raise HTTPException(503, "AI validation artifact is unavailable.") from error

    def page_image(self, document_id: str, page_index: int, annotated: bool = False) -> Path:
        directory=self._directory(document_id); prefix="annotated-page" if annotated else "page"; path=directory / "artifacts" / f"{prefix}-{page_index:02d}.png"
        if page_index < 1 or not path.is_file(): raise HTTPException(404, f"No {'annotated ' if annotated else ''}image exists for sample PDF page {page_index}.")
        return path
