from __future__ import annotations

import base64
import json
import os
import logging
from pathlib import Path
from typing import Any

import cv2
from openai import OpenAI
from pydantic import BaseModel, Field

from ..schemas import AIValidationResult, AIValidationResponse


DEFAULT_MODEL = "google.gemma-4-e2b"
DEFAULT_BASE_URL = "https://bedrock-mantle.us-east-1.api.aws/openai/v1"
logger = logging.getLogger(__name__)


class _ModelVerdict(BaseModel):
    is_valid_annotation: bool
    annotation_type: str
    confidence: float = Field(ge=0, le=1)
    associated_text: str | None = None
    priority: str
    explanation: str
    requires_human_review: bool = True


def is_enabled() -> bool:
    return os.getenv("AUDITVISION_AI_VALIDATION_ENABLED", "false").lower() in {"1", "true", "yes", "on"}


def _max_candidates() -> int:
    try:
        return max(1, min(100, int(os.getenv("AUDITVISION_AI_MAX_CANDIDATES", "20"))))
    except ValueError:
        return 20


def _crop_data_url(image_path: Path, bbox: list[float]) -> str:
    image = cv2.imread(str(image_path))
    if image is None:
        raise ValueError("Rendered page image is unavailable.")
    height, width = image.shape[:2]
    x0, y0, x1, y1 = map(round, bbox)
    padding = 80
    x0, y0 = max(0, x0 - padding), max(0, y0 - padding)
    x1, y1 = min(width, x1 + padding), min(height, y1 + padding)
    if x1 <= x0 or y1 <= y0:
        raise ValueError("Detection bounding box is invalid.")
    ok, encoded = cv2.imencode(".jpg", image[y0:y1, x0:x1], [cv2.IMWRITE_JPEG_QUALITY, 85])
    if not ok:
        raise ValueError("Detection crop could not be encoded.")
    return "data:image/jpeg;base64," + base64.b64encode(encoded.tobytes()).decode("ascii")


def _parse_verdict(content: str) -> _ModelVerdict:
    candidate = content.strip()
    if candidate.startswith("```"):
        candidate = candidate.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    return _ModelVerdict.model_validate(json.loads(candidate))


def validate_document(directory: Path, document_id: str) -> AIValidationResponse:
    model = os.getenv("AUDITVISION_AI_MODEL", DEFAULT_MODEL)
    if not is_enabled():
        logger.info("AI validation disabled: document_id=%s model=%s", document_id, model)
        return AIValidationResponse(document_id=document_id, enabled=False, model=model)
    token = os.getenv("AWS_BEARER_TOKEN_BEDROCK")
    if not token:
        logger.warning("AI validation enabled but Bedrock token is unavailable: document_id=%s model=%s", document_id, model)
        return AIValidationResponse(document_id=document_id, enabled=True, model=model, results=[AIValidationResult(detection_id="*", error="AI validation is enabled but AWS_BEARER_TOKEN_BEDROCK is not configured.")])

    try:
        raw_detections: Any = json.loads((directory / "artifacts" / "detections.json").read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError) as error:
        return AIValidationResponse(document_id=document_id, enabled=True, model=model, results=[AIValidationResult(detection_id="*", error=f"Detection artifacts are unavailable: {error}")])
    if not isinstance(raw_detections, list):
        return AIValidationResponse(document_id=document_id, enabled=True, model=model, results=[AIValidationResult(detection_id="*", error="Detection artifacts must contain a JSON array.")])

    candidates = min(len(raw_detections), _max_candidates())
    logger.info("AI validation started: document_id=%s model=%s candidates=%s", document_id, model, candidates)

    client = OpenAI(
        api_key=token,
        base_url=os.getenv("AUDITVISION_AI_BASE_URL", DEFAULT_BASE_URL).rstrip("/"),
        max_retries=0,
        timeout=float(os.getenv("AUDITVISION_AI_TIMEOUT_SECONDS", "60")),
    )
    results: list[AIValidationResult] = []
    for index, detection in enumerate(raw_detections[:_max_candidates()], start=1):
        detection_id = f"opencv-{index:04d}"
        try:
            page_index = int(detection["excerpt_pdf_page"])
            bbox = [float(value) for value in detection["bbox_pixels"]]
            image_path = directory / "artifacts" / f"page-{page_index:02d}.png"
            crop_url = _crop_data_url(image_path, bbox)
            prompt = {
                "detected_type": detection.get("type", "unknown"),
                "associated_text": detection.get("associated_text"),
                "page_index": page_index,
                "instruction": "Review the OpenCV candidate crop. Return JSON only with keys: is_valid_annotation (boolean), annotation_type (string), confidence (0..1), associated_text (string or null), priority (low|medium|high), explanation (string), requires_human_review (boolean). Do not invent text that is not visible.",
            }
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": "You are an audit annotation verification assistant. OpenCV supplies candidate geometry; you verify meaning and context."},
                    {"role": "user", "content": [{"type": "text", "text": json.dumps(prompt)}, {"type": "image_url", "image_url": {"url": crop_url}}]},
                ],
            )
            verdict = _parse_verdict(response.choices[0].message.content or "")
            results.append(AIValidationResult(detection_id=detection_id, **verdict.model_dump()))
            logger.info("AI validation candidate completed: document_id=%s candidate=%s", document_id, detection_id)
        except Exception as error:
            logger.warning("AI validation candidate failed: document_id=%s candidate=%s error_type=%s", document_id, detection_id, type(error).__name__)
            results.append(AIValidationResult(detection_id=detection_id, error=f"AI validation unavailable for this detection: {error}"))
    logger.info("AI validation finished: document_id=%s model=%s results=%s", document_id, model, len(results))
    return AIValidationResponse(document_id=document_id, enabled=True, model=model, results=results)
