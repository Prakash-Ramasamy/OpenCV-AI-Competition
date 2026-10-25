from __future__ import annotations

import json

from fastapi.testclient import TestClient

from auditvision.api.app import create_app
from auditvision.api.services import dashboard as dashboard_module
from auditvision.api.services.json_storage import LocalJsonStorage


def _entry(identifier: str) -> dict:
    return {
        "id": identifier,
        "document_id": "demo-document",
        "document_name": "demo.pdf",
        "sample_pdf_page_index": 1,
        "rendered_image_page_index": 1,
        "sample_page_number": 1,
        "annotation_type": "Circle",
        "extracted_text": "value",
        "row_label": "row",
        "note_reference": "none",
        "text_association_verified": False,
        "confidence": 0.8,
        "priority": "Medium",
        "status": "Pending",
        "bounding_box": {"x": 1, "y": 2, "width": 3, "height": 4},
        "data_source": "demo",
    }


def test_dashboard_reads_exactly_two_entries_from_configured_storage(tmp_path, monkeypatch):
    storage = LocalJsonStorage(tmp_path)
    storage.put_json("demo/default-dashboard.json", {"source": "demo", "entries": [_entry("one"), _entry("two")]})
    monkeypatch.setattr(dashboard_module, "create_json_storage", lambda: storage)
    response = TestClient(create_app()).get("/api/v1/sample/dashboard")
    assert response.status_code == 200
    assert [entry["id"] for entry in response.json()["entries"]] == ["one", "two"]


def test_dashboard_missing_object_is_an_explicit_error_without_fallback(tmp_path, monkeypatch):
    monkeypatch.setattr(dashboard_module, "create_json_storage", lambda: LocalJsonStorage(tmp_path))
    response = TestClient(create_app()).get("/api/v1/sample/dashboard")
    assert response.status_code == 503
