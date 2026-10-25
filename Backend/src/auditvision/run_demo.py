from __future__ import annotations

import json
from pathlib import Path

import cv2

from .evaluate import evaluate_circles
from .pipeline import annotate_circles, detect_circles, render_pdf_page
from .synthetic import build_synthetic_statement


def main() -> None:
    artifact_dir = Path("data/artifacts/milestone-1")
    pdf_path, truth_path = build_synthetic_statement(Path("data/synthetic"))
    image = render_pdf_page(str(pdf_path), dpi=144)
    detections = detect_circles(image, "synthetic-audit-statement-v1", 1)
    artifact_dir.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(artifact_dir / "original-page-1.png"), image)
    cv2.imwrite(str(artifact_dir / "annotated-page-1.png"), annotate_circles(image, detections))
    truth = json.loads(truth_path.read_text(encoding="utf-8"))
    metrics = evaluate_circles(detections, truth["annotations"])
    (artifact_dir / "detections.json").write_text(json.dumps([item.to_dict(image.shape[1], image.shape[0]) for item in detections], indent=2), encoding="utf-8")
    (artifact_dir / "evaluation.json").write_text(json.dumps(metrics.to_dict(), indent=2), encoding="utf-8")
    print(json.dumps(metrics.to_dict(), indent=2))


if __name__ == "__main__":
    main()
