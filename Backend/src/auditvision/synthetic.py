from __future__ import annotations

import json
from pathlib import Path

import fitz


PAGE_WIDTH, PAGE_HEIGHT, RENDER_DPI = 595, 842, 144
SCALE = RENDER_DPI / 72


def _pixels(value: float) -> float:
    return round(value * SCALE, 2)


def build_synthetic_statement(output_dir: Path) -> tuple[Path, Path]:
    """Create a labelled test PDF; every audit mark is deliberately synthetic."""
    output_dir.mkdir(parents=True, exist_ok=True)
    pdf_path = output_dir / "synthetic_audited_statement.pdf"
    ground_truth_path = output_dir / "ground_truth.json"
    doc = fitz.open()
    page = doc.new_page(width=PAGE_WIDTH, height=PAGE_HEIGHT)
    page.insert_text((70, 55), "AuditVision AI — Synthetic Financial Statement", fontsize=16)
    page.insert_text((70, 78), "For computer-vision evaluation only; not an audited financial statement.", fontsize=8)

    rows = [
        ("BALANCE SHEET", "", ""),
        ("Assets", "Cash and cash equivalents", "1,250,000"),
        ("", "Trade receivables (Note 4)", "890,000"),
        ("", "Property and equipment (Note 6)", "2,600,000"),
        ("Liabilities", "Trade payables (Note 9)", "720,000"),
        ("Equity", "Retained earnings", "3,020,000"),
        ("PROFIT AND LOSS", "", ""),
        ("", "Revenue (Note 12)", "5,400,000"),
        ("", "Operating expenses", "(3,850,000)"),
        ("", "Profit for the year", "1,550,000"),
    ]
    y = 120
    for heading, label, value in rows:
        if heading and not label:
            page.insert_text((70, y), heading, fontsize=11)
        else:
            page.insert_text((90, y), label, fontsize=10)
            page.insert_text((430, y), value, fontsize=10)
        y += 38
    page.draw_rect(fitz.Rect(60, 95, 535, 495), color=(0.2, 0.2, 0.2), width=0.7)
    for line_y in range(133, 495, 38):
        page.draw_line((60, line_y), (535, line_y), color=(0.75, 0.75, 0.75), width=0.3)

    # Deliberate synthetic review marks. PDF coordinates are converted to pixels in the truth file.
    annotations = [
        {"id": "circle-cash", "type": "circle", "center": [464, 158], "radius": 55,
         "associated_financial_value": "1,250,000", "associated_text": "Cash and cash equivalents"},
        {"id": "highlight-receivables", "type": "highlight", "bbox": [88, 175, 275, 192],
         "associated_financial_value": "890,000"},
        {"id": "tick-ppe", "type": "tick", "bbox": [365, 211, 390, 234],
         "associated_financial_value": "2,600,000"},
        {"id": "cross-payables", "type": "cross", "bbox": [365, 249, 390, 272],
         "associated_financial_value": "720,000"},
        {"id": "underline-profit", "type": "underline", "bbox": [428, 455, 515, 460],
         "associated_financial_value": "1,550,000"},
    ]
    page.draw_circle((464, 158), 55, color=(0.9, 0.05, 0.05), width=2.5)
    page.draw_rect(fitz.Rect(88, 175, 275, 192), color=None, fill=(1, 0.9, 0.1), fill_opacity=0.35, overlay=True)
    page.draw_line((365, 222), (374, 232), color=(0.05, 0.35, 0.9), width=2)
    page.draw_line((374, 232), (389, 211), color=(0.05, 0.35, 0.9), width=2)
    page.draw_line((366, 250), (389, 271), color=(0.9, 0.05, 0.05), width=2)
    page.draw_line((389, 250), (366, 271), color=(0.9, 0.05, 0.05), width=2)
    page.draw_line((428, 458), (515, 458), color=(0.05, 0.35, 0.9), width=2)
    doc.save(pdf_path)
    doc.close()

    for annotation in annotations:
        annotation["synthetic"] = True
        annotation["page_number"] = 1
        annotation["pdf_coordinates"] = {key: value for key, value in annotation.items() if key in {"center", "radius", "bbox"}}
        if "center" in annotation:
            annotation["pixel_coordinates"] = {
                "center": [_pixels(annotation["center"][0]), _pixels(annotation["center"][1])],
                "radius": _pixels(annotation["radius"]),
            }
        else:
            annotation["pixel_coordinates"] = {"bbox": [_pixels(v) for v in annotation["bbox"]]}
    ground_truth_path.write_text(json.dumps({
        "document_id": "synthetic-audit-statement-v1",
        "render_dpi": RENDER_DPI,
        "annotations": annotations,
    }, indent=2), encoding="utf-8")
    return pdf_path, ground_truth_path
