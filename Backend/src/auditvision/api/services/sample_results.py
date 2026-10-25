from __future__ import annotations

import json
import os
from collections import Counter
from pathlib import Path
from typing import Any

from fastapi import HTTPException

from ..schemas import BoundingBox, DetectionResponse, EvaluationMetric, PageMapping, SampleResultsResponse, SampleSummaryResponse

BACKEND_ROOT = Path(__file__).resolve().parents[4]
DEFAULT_RESULTS_DIR = BACKEND_ROOT / "data" / "results" / "milestone-3-improved"
DEFAULT_GROUND_TRUTH = BACKEND_ROOT / "Sample Docs" / "Infosys_AuditVision_Synthetic_Test_Dataset" / "Infosys_AuditVision_Synthetic_Ground_Truth.json"


def _configured_path(variable: str, default: Path) -> Path:
    raw_value = Path(os.getenv(variable, str(default)))
    candidate = (raw_value if raw_value.is_absolute() else BACKEND_ROOT / raw_value).resolve()
    try:
        candidate.relative_to(BACKEND_ROOT.resolve())
    except ValueError as error:
        raise RuntimeError(f"{variable} must resolve inside the Backend directory.") from error
    return candidate


class SampleResultsStore:
    """Adapts frozen result artifacts; it never invokes or modifies the vision pipeline."""

    def __init__(self, results_dir: Path | None = None, ground_truth_path: Path | None = None):
        self.results_dir = results_dir or _configured_path("AUDITVISION_SAMPLE_RESULTS_DIR", DEFAULT_RESULTS_DIR)
        self.ground_truth_path = ground_truth_path or _configured_path("AUDITVISION_SAMPLE_GROUND_TRUTH_PATH", DEFAULT_GROUND_TRUTH)

    def _load_json(self, path: Path) -> Any:
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except FileNotFoundError as error:
            raise HTTPException(404, f"Saved artifact not found: {path.name}") from error
        except json.JSONDecodeError as error:
            raise HTTPException(503, f"Saved artifact is malformed: {path.name}") from error

    def _page_mapping(self) -> dict[int, dict[str, int]]:
        if not self.ground_truth_path.exists():
            return {}
        document = self._load_json(self.ground_truth_path)
        return {
            int(page["excerpt_pdf_page"]): {
                "source_report_page_number": int(page["source_report_page"]),
                "source_pdf_page_index": int(page["source_pdf_page"]),
            }
            for page in document.get("selected_pages", [])
            if "excerpt_pdf_page" in page and "source_report_page" in page and "source_pdf_page" in page
        }

    def detections(self) -> list[DetectionResponse]:
        raw = self._load_json(self.results_dir / "detections.json")
        return self.detections_from_raw(raw)

    def detections_from_raw(self, raw: Any) -> list[DetectionResponse]:
        if not isinstance(raw, list):
            raise HTTPException(503, "Saved detections artifact must contain a JSON array.")
        mapping = self._page_mapping()
        output: list[DetectionResponse] = []
        for index, item in enumerate(raw, start=1):
            if not isinstance(item, dict):
                raise HTTPException(503, f"Saved detection #{index} is not an object.")
            box = item.get("bbox_pixels")
            page_index = item.get("excerpt_pdf_page")
            if not (isinstance(box, list) and len(box) == 4 and isinstance(page_index, int)):
                raise HTTPException(503, f"Saved detection #{index} lacks bbox_pixels or excerpt_pdf_page.")
            x0, y0, x1, y1 = map(float, box)
            known_page = mapping.get(page_index, {})
            metadata = {key: item[key] for key in ("bbox_pdf_points", "bbox_normalized") if key in item}
            if "source_pdf_page_index" in known_page:
                metadata["source_pdf_page_index"] = known_page["source_pdf_page_index"]
            center = item.get("center_pixels")
            output.append(DetectionResponse(
                id=f"m3-{index:04d}", annotation_type=str(item.get("type", "unknown")),
                page=PageMapping(source_report_page_number=known_page.get("source_report_page_number"), sample_pdf_page_index=page_index, rendered_image_page_index=page_index),
                bounding_box=BoundingBox(x=x0, y=y0, width=x1-x0, height=y1-y0),
                confidence=float(item["confidence"]) if isinstance(item.get("confidence"), (int, float)) else None,
                associated_text=item.get("associated_text") if isinstance(item.get("associated_text"), str) else None,
                center_pixels=tuple(map(float, center)) if isinstance(center, list) and len(center) == 2 else None,
                radius_pixels=None, metadata=metadata,
                status=str(item.get("status", "Pending")),
                reviewer_comment=str(item.get("reviewer_comment", "")),
            ))
        return output

    def results(self) -> SampleResultsResponse:
        detections = self.detections()
        return SampleResultsResponse(result_set=self.results_dir.name, total_detections=len(detections), detections=detections)

    def summary(self) -> SampleSummaryResponse:
        detections = self.detections()
        metrics_doc = self._load_json(self.results_dir / "evaluation_report.json")
        metrics = [EvaluationMetric(annotation_type=str(row["type"]), true_positives=int(row["true_positives"]), false_positives=int(row["false_positives"]), false_negatives=int(row["false_negatives"]), precision=float(row["precision"]), recall=float(row["recall"]), f1=float(row["f1"])) for row in metrics_doc.get("metrics", [])]
        return SampleSummaryResponse(result_set=self.results_dir.name, total_detections=len(detections), detections_by_type=dict(sorted(Counter(item.annotation_type for item in detections).items())), evaluation_metrics=metrics)

    def page_image(self, page_index: int) -> Path:
        if page_index < 1:
            raise HTTPException(404, "Sample PDF page indexes are 1-based.")
        path = (self.results_dir / f"page-{page_index:02d}.png").resolve()
        try:
            path.relative_to(self.results_dir.resolve())
        except ValueError as error:
            raise HTTPException(404, "Page image path is invalid.") from error
        if not path.is_file():
            raise HTTPException(404, f"No rendered image exists for sample PDF page {page_index}.")
        return path
