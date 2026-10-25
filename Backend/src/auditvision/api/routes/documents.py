from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, File, UploadFile
from fastapi.responses import FileResponse

from ..schemas import AIValidationResponse, DocumentListItem, DocumentProcessResponse, DocumentSummaryResponse, DocumentUploadResponse, ProcessRequest, ReviewUpdateRequest, SampleResultsResponse
from ..services.documents import DocumentService
from ..services.ai_validation import is_enabled

router = APIRouter(prefix="/api/v1/documents", tags=["documents"])

def get_document_service() -> DocumentService: return DocumentService()

@router.post("", response_model=DocumentUploadResponse, status_code=201, summary="Upload a PDF for local processing")
async def upload_document(file: UploadFile = File(...), service: DocumentService = Depends(get_document_service)) -> DocumentUploadResponse:
    return await service.upload(file)

@router.get("", response_model=list[DocumentListItem], summary="List persisted uploaded documents")
def list_documents(service: DocumentService = Depends(get_document_service)) -> list[DocumentListItem]:
    return service.list_documents()

@router.post("/{document_id}/process", response_model=DocumentProcessResponse, summary="Synchronously process a small selected PDF scope")
def process_document(document_id: str, request: ProcessRequest, background_tasks: BackgroundTasks, service: DocumentService = Depends(get_document_service)) -> DocumentProcessResponse:
    response = service.process(document_id, request)
    if is_enabled():
        background_tasks.add_task(service.auto_validate, document_id)
    return response

@router.get("/{document_id}/detections", response_model=SampleResultsResponse)
def document_detections(document_id: str, service: DocumentService = Depends(get_document_service)) -> SampleResultsResponse:
    return service.results(document_id)

@router.get("/{document_id}/summary", response_model=DocumentSummaryResponse)
def document_summary(document_id: str, service: DocumentService = Depends(get_document_service)) -> DocumentSummaryResponse:
    return service.summary(document_id)

@router.post("/{document_id}/review", response_model=SampleResultsResponse, summary="Persist a review decision for one detection")
def update_review(document_id: str, request: ReviewUpdateRequest, service: DocumentService = Depends(get_document_service)) -> SampleResultsResponse:
    return service.update_review(document_id, request)

@router.get("/{document_id}/ai-validation", response_model=AIValidationResponse, summary="Read asynchronous AI validation results")
def document_ai_validation(document_id: str, service: DocumentService = Depends(get_document_service)) -> AIValidationResponse:
    return service.ai_validation(document_id)

@router.post("/{document_id}/ai-validate", response_model=AIValidationResponse, summary="Optionally validate OpenCV annotations with Bedrock")
def validate_annotations(document_id: str, service: DocumentService = Depends(get_document_service)) -> AIValidationResponse:
    return service.validate_now(document_id)

@router.get("/{document_id}/pages/{sample_page_index}/image")
def document_page_image(document_id: str, sample_page_index: int, annotated: bool = False, service: DocumentService = Depends(get_document_service)) -> FileResponse:
    return FileResponse(service.page_image(document_id, sample_page_index, annotated), media_type="image/png")
