from __future__ import annotations

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = Field(description="Service health state.")
    service: str = Field(description="Stable API service name.")
    opencv_version: str = Field(description="OpenCV version imported by the running API.")


class PageMapping(BaseModel):
    """Page identities are deliberately separate and must not be inferred from one another."""

    source_report_page_number: int | None = Field(default=None, ge=1)
    sample_pdf_page_index: int = Field(ge=1)
    rendered_image_page_index: int = Field(ge=1)


class BoundingBox(BaseModel):
    x: float
    y: float
    width: float = Field(ge=0)
    height: float = Field(ge=0)


class DetectionResponse(BaseModel):
    """Read-only normalized representation of an existing detector record."""

    id: str
    annotation_type: str
    page: PageMapping
    bounding_box: BoundingBox
    confidence: float | None = Field(default=None, ge=0, le=1)
    associated_text: str | None = None
    center_pixels: tuple[float, float] | None = None
    radius_pixels: float | None = Field(default=None, ge=0)
    metadata: dict[str, object] = Field(default_factory=dict)
    status: str = "Pending"
    reviewer_comment: str = ""


class EvaluationMetric(BaseModel):
    annotation_type: str
    true_positives: int
    false_positives: int
    false_negatives: int
    precision: float
    recall: float
    f1: float


class SampleResultsResponse(BaseModel):
    result_set: str
    total_detections: int
    detections: list[DetectionResponse]


class SampleSummaryResponse(BaseModel):
    result_set: str
    total_detections: int
    detections_by_type: dict[str, int]
    evaluation_metrics: list[EvaluationMetric] = Field(default_factory=list)


class DocumentUploadResponse(BaseModel):
    document_id: str
    original_filename: str
    page_count: int
    file_size_bytes: int
    status: str


class DocumentListItem(BaseModel):
    document_id: str
    original_filename: str
    page_count: int
    file_size_bytes: int
    status: str
    processed_page_indexes: list[int] = Field(default_factory=list)
    total_detections: int = 0


class ProcessRequest(BaseModel):
    page_indexes: list[int] | None = Field(default=None, description="Optional 1-based PDF page indexes.")
    annotation_types: list[str] | None = Field(default=None, description="Optional detector type filter.")


class DocumentProcessResponse(BaseModel):
    document_id: str
    status: str
    processed_page_indexes: list[int]
    total_detections: int


class DocumentSummaryResponse(BaseModel):
    document_id: str
    status: str
    total_detections: int
    detections_by_type: dict[str, int]
    processed_page_indexes: list[int]


class ReviewUpdateRequest(BaseModel):
    detection_id: str
    status: str
    reviewer_comment: str = ""


class AIValidationResult(BaseModel):
    detection_id: str
    is_valid_annotation: bool | None = None
    annotation_type: str | None = None
    confidence: float | None = Field(default=None, ge=0, le=1)
    associated_text: str | None = None
    priority: str | None = None
    explanation: str | None = None
    requires_human_review: bool = True
    error: str | None = None


class AIValidationResponse(BaseModel):
    document_id: str
    enabled: bool
    model: str | None = None
    results: list[AIValidationResult] = Field(default_factory=list)


class DashboardEntry(BaseModel):
    id: str
    document_id: str
    document_name: str
    original_report_page_number: int | None = None
    sample_pdf_page_index: int = Field(ge=1)
    rendered_image_page_index: int = Field(ge=1)
    rendered_image_file_name: str | None = None
    sample_page_number: int = Field(ge=1)
    annotation_type: str
    extracted_text: str
    row_label: str
    note_reference: str
    text_association_verified: bool
    confidence: float | None = Field(default=None, ge=0, le=1)
    priority: str
    status: str
    bounding_box: BoundingBox
    detection_explanation: str | None = None
    data_source: str
    reviewer_comment: str = ""


class DashboardResponse(BaseModel):
    source: str
    entries: list[DashboardEntry]


class DocumentProcessingResponse(BaseModel):
    """Future document-processing job contract; processing is intentionally not implemented yet."""

    document_id: str
    status: str
    detections: list[DetectionResponse] = Field(default_factory=list)
