from fastapi.testclient import TestClient

from auditvision.api.app import create_app
from auditvision.api.routes.documents import get_document_service
from auditvision.api.services.documents import DocumentService
from auditvision.synthetic import build_synthetic_statement


def _client(tmp_path):
    app = create_app()
    app.dependency_overrides[get_document_service] = lambda: DocumentService(root=tmp_path / "documents", max_upload_bytes=2_000_000, max_page_count=5, max_pages_per_request=2)
    return TestClient(app)


def _upload(client, pdf_path):
    return client.post("/api/v1/documents", files={"file": (pdf_path.name, pdf_path.read_bytes(), "application/pdf")})


def test_upload_and_real_processing_without_ground_truth(tmp_path):
    pdf_path, _ = build_synthetic_statement(tmp_path / "fixture")
    client = _client(tmp_path)
    uploaded = _upload(client, pdf_path)
    assert uploaded.status_code == 201
    document_id = uploaded.json()["document_id"]
    processed = client.post(f"/api/v1/documents/{document_id}/process", json={"page_indexes": [1]})
    assert processed.status_code == 200 and processed.json()["processed_page_indexes"] == [1]
    detections = client.get(f"/api/v1/documents/{document_id}/detections").json()
    assert detections["total_detections"] > 0
    assert detections["detections"][0]["page"]["source_report_page_number"] is None
    summary = client.get(f"/api/v1/documents/{document_id}/summary").json()
    assert summary["total_detections"] == detections["total_detections"]
    assert client.get(f"/api/v1/documents/{document_id}/pages/1/image").status_code == 200
    assert client.get(f"/api/v1/documents/{document_id}/pages/2/image").status_code == 404


def test_invalid_upload_and_missing_document_errors(tmp_path):
    client = _client(tmp_path)
    invalid = client.post("/api/v1/documents", files={"file": ("not.pdf", b"not a pdf", "application/pdf")})
    assert invalid.status_code == 415
    assert client.get("/api/v1/documents/doc-missing/detections").status_code == 404


def test_invalid_page_selection_is_rejected(tmp_path):
    pdf_path, _ = build_synthetic_statement(tmp_path / "fixture")
    client = _client(tmp_path); document_id = _upload(client, pdf_path).json()["document_id"]
    assert client.post(f"/api/v1/documents/{document_id}/process", json={"page_indexes": [2]}).status_code == 422
