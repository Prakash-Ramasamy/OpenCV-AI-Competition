import json

from auditvision.pipeline import detect_circles, render_pdf_page
from auditvision.synthetic import build_synthetic_statement


def test_synthetic_pdf_has_complete_labelled_ground_truth(tmp_path):
    pdf_path, truth_path = build_synthetic_statement(tmp_path)
    truth = json.loads(truth_path.read_text(encoding="utf-8"))
    assert pdf_path.exists()
    assert truth["render_dpi"] == 144
    assert {item["type"] for item in truth["annotations"]} == {"circle", "highlight", "tick", "cross", "underline"}
    image = render_pdf_page(str(pdf_path), dpi=truth["render_dpi"])
    assert image.shape[0] > 1000 and image.shape[1] > 800
    circles = detect_circles(image, truth["document_id"], 1)
    assert len(circles) == 1
