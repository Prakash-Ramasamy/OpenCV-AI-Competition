"""Idempotently seed the two demo dashboard records into configured JSON storage."""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from auditvision.api.services.json_storage import create_json_storage


def entries() -> list[dict]:
    common = {
        "document_id": "demo-document",
        "document_name": "AuditVision_Demo_Statement.pdf",
        "original_report_page_number": None,
        "rendered_image_file_name": "demo-page-01.png",
        "sample_page_number": 1,
        "data_source": "demo",
        "status": "Pending",
        "priority": "Medium",
        "text_association_verified": False,
        "note_reference": "Not available",
        "reviewer_comment": "",
    }
    return [
        {**common, "id": "demo-0001", "sample_pdf_page_index": 1, "rendered_image_page_index": 1, "annotation_type": "Highlight", "extracted_text": "Demo revenue value", "row_label": "Demo revenue line", "confidence": 0.9, "bounding_box": {"x": 10, "y": 10, "width": 120, "height": 24}, "detection_explanation": "S3-backed demonstration record."},
        {**common, "id": "demo-0002", "sample_pdf_page_index": 1, "rendered_image_page_index": 1, "annotation_type": "Circle", "extracted_text": "Demo total value", "row_label": "Demo total line", "confidence": 0.88, "bounding_box": {"x": 180, "y": 40, "width": 80, "height": 30}, "detection_explanation": "S3-backed demonstration record."},
    ]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="Overwrite an existing demo object.")
    args = parser.parse_args()
    key = os.getenv("AUDITVISION_S3_DEMO_KEY", "demo/default-dashboard.json")
    storage = create_json_storage()
    if storage.exists(key) and not args.force:
        print(f"Demo dashboard already exists: {key}. Use --force to overwrite.")
        return 2
    storage.put_json(key, {"source": "demo", "entries": entries()}, overwrite=args.force)
    print(f"Uploaded {len(entries())} demo entries to {key}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
