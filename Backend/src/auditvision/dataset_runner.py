"""Dataset-driven, classical-CV baseline.  Ground truth is used only after detection."""
from __future__ import annotations

import json
import math
from collections import defaultdict
from pathlib import Path

import cv2
import fitz
import numpy as np
import pandas as pd

from .pipeline import render_pdf_page

SCALE = 150 / 72


def _box(x: int, y: int, w: int, h: int, kind: str, score: float) -> dict:
    return {"type": kind, "bbox_pixels": [int(x), int(y), int(x + w), int(y + h)], "confidence": score}


def _crosses_from_diagonals(red_mask: np.ndarray) -> list[dict]:
    """Require two opposed diagonal strokes sharing a centre; red ink alone is insufficient."""
    roi = red_mask[:, :150]
    lines = cv2.HoughLinesP(roi, 1, np.pi / 180, threshold=7, minLineLength=7, maxLineGap=2)
    if lines is None: return []
    segments = []
    for x1, y1, x2, y2 in lines.reshape(-1, 4):
        angle = math.degrees(math.atan2(y2-y1, x2-x1)) % 180
        if 20 <= angle <= 70 or 110 <= angle <= 160: segments.append((x1,y1,x2,y2,angle))
    found=[]
    for i, a in enumerate(segments):
        for b in segments[i+1:]:
            if abs(abs(a[4]-b[4])-90) > 28: continue
            ax,ay=(a[0]+a[2])/2,(a[1]+a[3])/2; bx,by=(b[0]+b[2])/2,(b[1]+b[3])/2
            if math.hypot(ax-bx,ay-by) > 6: continue
            x0,y0=min(a[0],a[2],b[0],b[2])-2,min(a[1],a[3],b[1],b[3])-2; x1,y1=max(a[0],a[2],b[0],b[2])+3,max(a[1],a[3],b[1],b[3])+3
            if not (8 <= x1-x0 <= 32 and 8 <= y1-y0 <= 32): continue
            if any(math.hypot((x0+x1)/2-(q["bbox_pixels"][0]+q["bbox_pixels"][2])/2,(y0+y1)/2-(q["bbox_pixels"][1]+q["bbox_pixels"][3])/2)<8 for q in found): continue
            found.append(_box(x0,y0,x1-x0,y1-y0,"cross",0.85))
    return found


def _ovals_from_detached_strokes(red_mask: np.ndarray) -> list[dict]:
    """Recover a flattened oval when only its top and bottom red arcs survive rasterisation."""
    _, _, stats, _ = cv2.connectedComponentsWithStats(red_mask, 8)
    strokes=[]
    for x, y, w, h, area in stats[1:]:
        if 12 <= w <= 32 and h <= 3 and area >= 15:
            strokes.append((int(x), int(y), int(w), int(h)))
    output=[]
    for i, top in enumerate(strokes):
        for bottom in strokes[i+1:]:
            tx,ty,tw,th=top; bx,by,bw,bh=bottom
            if not (18 <= abs(by-ty) <= 45): continue
            if abs((tx+tw/2)-(bx+bw/2)) > 8: continue
            x0,y0=min(tx,bx)-2,min(ty,by)-2; x1,y1=max(tx+tw,bx+bw)+2,max(ty+th,by+bh)+2
            output.append(_box(x0,y0,x1-x0,y1-y0,"circle",0.65))
    return output


def detect_marks(image: np.ndarray) -> list[dict]:
    """Colour/geometry baseline for synthetic ink; intentionally does not read truth data."""
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    red = ((((hsv[:, :, 0] <= 8) | (hsv[:, :, 0] >= 170)) & (hsv[:, :, 1] > 80) & (hsv[:, :, 2] > 80)).astype(np.uint8) * 255)
    yellow = (((hsv[:, :, 0] >= 15) & (hsv[:, :, 0] <= 35) & (hsv[:, :, 1] > 50) & (hsv[:, :, 2] > 100)).astype(np.uint8) * 255)
    green = (((hsv[:, :, 0] >= 45) & (hsv[:, :, 0] <= 100) & (hsv[:, :, 1] > 50) & (hsv[:, :, 2] > 50)).astype(np.uint8) * 255)
    output: list[dict] = []
    for mask, kind, predicate in (
        (yellow, "highlight", lambda x, y, w, h, a: a > 1000 and w > 200 and 10 <= h <= 70),
        (green, "tick", lambda x, y, w, h, a: a > 20 and x < 160 and 6 <= w <= 50 and 6 <= h <= 50),
    ):
        _, _, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
        for x, y, w, h, area in stats[1:]:
            if predicate(x, y, w, h, area): output.append(_box(x, y, w, h, kind, 0.85))
    _, _, stats, _ = cv2.connectedComponentsWithStats(red, 8)
    for x, y, w, h, area in stats[1:]:
        ratio = w / max(h, 1)
        if 35 <= w <= 110 and 18 <= h <= 60 and 1.5 <= ratio <= 4.0 and area > 100:
            output.append(_box(x, y, w, h, "circle", 0.80))
        elif x < 90 and 50 <= w <= 90 and 6 <= h <= 20 and ratio >= 3.5 and area > 50:
            output.append(_box(x, y, w, h, "arrow", 0.80))
        elif x > 850 and 20 <= w <= 100 and h <= 5 and area > 20:
            output.append(_box(x, y, w, h, "underline", 0.80))
    output.extend(_crosses_from_diagonals(red))
    output.extend(_ovals_from_detached_strokes(red))
    return output


def _iou(a: list[float], b: list[float]) -> float:
    x0, y0, x1, y1 = max(a[0], b[0]), max(a[1], b[1]), min(a[2], b[2]), min(a[3], b[3])
    inter = max(0, x1-x0) * max(0, y1-y0)
    union = (a[2]-a[0])*(a[3]-a[1]) + (b[2]-b[0])*(b[3]-b[1]) - inter
    return inter / union if union else 0.0


def evaluate(predictions: list[dict], truth: list[dict]) -> tuple[list[dict], list[dict]]:
    expected = [a for a in truth if a["type"] != "reviewer_note"]
    used: set[int] = set(); rows: list[dict] = []
    for pred in predictions:
        candidates = []
        pc = ((pred["bbox_pixels"][0]+pred["bbox_pixels"][2])/2, (pred["bbox_pixels"][1]+pred["bbox_pixels"][3])/2)
        for i, gt in enumerate(expected):
            if i in used or gt["type"] != pred["type"]: continue
            box = gt["bbox_pixels_at_150dpi"]
            gc = ((box[0]+box[2])/2, (box[1]+box[3])/2)
            distance = float(np.hypot(pc[0]-gc[0], pc[1]-gc[1]))
            diag = float(np.hypot(box[2]-box[0], box[3]-box[1]))
            overlap = _iou(pred["bbox_pixels"], box)
            if overlap >= .15 or distance <= max(12, diag * .65): candidates.append((distance, i, overlap))
        if candidates:
            distance, i, overlap = min(candidates); used.add(i)
            rows.append({"status":"true_positive", "type":pred["type"], "confidence":pred["confidence"], "iou":overlap, "center_error_px":distance, "prediction":pred, "ground_truth":expected[i]})
        else: rows.append({"status":"false_positive", "type":pred["type"], "confidence":pred["confidence"], "iou":0, "center_error_px":None, "prediction":pred})
    for i, gt in enumerate(expected):
        if i not in used: rows.append({"status":"false_negative", "type":gt["type"], "confidence":None, "iou":0, "center_error_px":None, "ground_truth":gt})
    summary=[]
    for kind in sorted({r["type"] for r in rows}):
        group=[r for r in rows if r["type"]==kind]; tp=sum(r["status"]=="true_positive" for r in group); fp=sum(r["status"]=="false_positive" for r in group); fn=sum(r["status"]=="false_negative" for r in group)
        precision=tp/(tp+fp) if tp+fp else 0; recall=tp/(tp+fn) if tp+fn else 0
        summary.append({"type":kind,"true_positives":tp,"false_positives":fp,"false_negatives":fn,"precision":precision,"recall":recall,"f1":2*precision*recall/(precision+recall) if precision+recall else 0})
    return rows, summary


def run(pdf_path: Path, truth_path: Path, output_dir: Path) -> list[dict]:
    truth_doc=json.loads(truth_path.read_text(encoding="utf-8")); output_dir.mkdir(parents=True, exist_ok=True)
    predictions=[]; pdf=fitz.open(pdf_path)
    print(f"Loaded {pdf_path.name}: {len(pdf)} pages; rendering at 150 DPI.", flush=True)
    for page_number in range(1, len(pdf)+1):
        print(f"[{page_number:02}/{len(pdf):02}] Rendering and detecting marks...", end=" ", flush=True)
        image=render_pdf_page(str(pdf_path), page_number, 150); cv2.imwrite(str(output_dir/f"page-{page_number:02}.png"), image)
        words=pdf.load_page(page_number-1).get_text("words")
        page_predictions = detect_marks(image)
        for p in page_predictions:
            b=p["bbox_pixels"]; cx,cy=(b[0]+b[2])/2,(b[1]+b[3])/2
            p.update({"excerpt_pdf_page":page_number,"bbox_pdf_points":[round(v/SCALE,2) for v in b],"bbox_normalized":[round(b[0]/image.shape[1],6),round(b[1]/image.shape[0],6),round(b[2]/image.shape[1],6),round(b[3]/image.shape[0],6)],"center_pixels":[cx,cy],"associated_text":min(words,key=lambda w:(((w[0]+w[2])/2-cx/SCALE)**2+((w[1]+w[3])/2-cy/SCALE)**2),default=["", "", "", "", ""])[4]})
            predictions.append(p)
        preview=image.copy()
        for p in page_predictions:
            x0,y0,x1,y1=p["bbox_pixels"]; cv2.rectangle(preview,(x0,y0),(x1,y1),(0,180,0),2); cv2.putText(preview,f"{p['type']} {p['confidence']:.2f}",(x0,max(15,y0-4)),cv2.FONT_HERSHEY_SIMPLEX,.35,(0,120,0),1)
        cv2.imwrite(str(output_dir/f"annotated-page-{page_number:02}.png"), preview)
        counts=defaultdict(int)
        for prediction in page_predictions: counts[prediction["type"]] += 1
        print(f"{len(page_predictions)} candidates ({dict(sorted(counts.items()))}).", flush=True)
    pdf.close(); rows, summary=evaluate(predictions,truth_doc["annotations"])
    print("Matching predictions to ground truth and writing reports...", flush=True)
    (output_dir/"detections.json").write_text(json.dumps(predictions,indent=2),encoding="utf-8")
    (output_dir/"evaluation_report.json").write_text(json.dumps({"metrics":summary,"matches":rows},indent=2),encoding="utf-8")
    pd.DataFrame(summary).to_csv(output_dir/"evaluation_report.csv",index=False)
    # Post-detection comparison: green=matched prediction, red=false positive, orange=missed target.
    for page_number in range(1, 11):
        comparison=render_pdf_page(str(pdf_path),page_number,150)
        for row in rows:
            record=row.get("prediction") or row.get("ground_truth"); page=record.get("excerpt_pdf_page")
            if page != page_number: continue
            box=(record.get("bbox_pixels") or record.get("bbox_pixels_at_150dpi")); x0,y0,x1,y1=map(round,box)
            color=(0,180,0) if row["status"]=="true_positive" else ((0,0,255) if row["status"]=="false_positive" else (0,140,255))
            cv2.rectangle(comparison,(x0,y0),(x1,y1),color,2)
        cv2.imwrite(str(output_dir/f"comparison-page-{page_number:02}.png"),comparison)
    table = ["| Type | TP | FP | FN | Precision | Recall | F1 |", "|---|---:|---:|---:|---:|---:|---:|"]
    table += [f"| {r['type']} | {r['true_positives']} | {r['false_positives']} | {r['false_negatives']} | {r['precision']:.3f} | {r['recall']:.3f} | {r['f1']:.3f} |" for r in summary]
    (output_dir/"summary.md").write_text("# Baseline evaluation\n\n"+"\n".join(table),encoding="utf-8")
    print(f"Done. Wrote {len(predictions)} predictions and reports to {output_dir}.", flush=True)
    return summary
