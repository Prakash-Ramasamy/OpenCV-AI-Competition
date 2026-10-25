import json

from fastapi.testclient import TestClient

from auditvision.api.app import create_app
from auditvision.api.routes.sample import get_sample_store
from auditvision.api.services.sample_results import SampleResultsStore


def _client(tmp_path, detections=None, valid_evaluation=True):
    results = tmp_path / "milestone-3-improved"
    results.mkdir()
    if detections is not None:
        (results / "detections.json").write_text(json.dumps(detections), encoding="utf-8")
    if valid_evaluation:
        (results / "evaluation_report.json").write_text(json.dumps({"metrics": [{"type": "circle", "true_positives": 1, "false_positives": 0, "false_negatives": 0, "precision": 1, "recall": 1, "f1": 1}]}), encoding="utf-8")
    ground_truth = tmp_path / "ground_truth.json"
    ground_truth.write_text(json.dumps({"selected_pages": [{"excerpt_pdf_page": 1, "source_report_page": 222, "source_pdf_page": 194}]}), encoding="utf-8")
    app = create_app()
    app.dependency_overrides[get_sample_store] = lambda: SampleResultsStore(results, ground_truth)
    return TestClient(app), results


def _detection():
    return [{"type": "circle", "bbox_pixels": [10, 20, 30, 40], "confidence": 0.8, "excerpt_pdf_page": 1, "center_pixels": [20, 30], "associated_text": "14,265", "bbox_pdf_points": [4.8, 9.6, 14.4, 19.2]}]


def test_results_and_summary_adapt_saved_artifacts(tmp_path):
    client, _ = _client(tmp_path, _detection())
    result = client.get("/api/v1/sample/results")
    assert result.status_code == 200
    item = result.json()["detections"][0]
    assert item["id"] == "m3-0001" and item["page"]["source_report_page_number"] == 222
    assert item["bounding_box"] == {"x": 10.0, "y": 20.0, "width": 20.0, "height": 20.0}
    assert item["radius_pixels"] is None
    summary = client.get("/api/v1/sample/summary").json()
    assert summary["total_detections"] == 1 and summary["detections_by_type"] == {"circle": 1}
    assert summary["evaluation_metrics"][0]["f1"] == 1.0


def test_missing_or_malformed_results_are_reported(tmp_path):
    client, results = _client(tmp_path, None)
    assert client.get("/api/v1/sample/results").status_code == 404
    (results / "detections.json").write_text("{not-json", encoding="utf-8")
    assert client.get("/api/v1/sample/results").status_code == 503


def test_page_image_uses_one_based_index_and_returns_404_for_missing(tmp_path):
    client, results = _client(tmp_path, _detection())
    expected = b"not-a-real-png-but-a-real-artifact-response"
    (results / "page-01.png").write_bytes(expected)
    response = client.get("/api/v1/sample/pages/1/image")
    assert response.status_code == 200 and response.content == expected
    assert client.get("/api/v1/sample/pages/2/image").status_code == 404
    assert client.get("/api/v1/sample/pages/0/image").status_code == 404
