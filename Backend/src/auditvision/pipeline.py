from __future__ import annotations

import cv2
import fitz
import numpy as np

from .models import CircleDetection


def render_pdf_page(pdf_path: str, page_number: int = 1, dpi: int = 144) -> np.ndarray:
    document = fitz.open(pdf_path)
    try:
        page = document.load_page(page_number - 1)
        pixmap = page.get_pixmap(matrix=fitz.Matrix(dpi / 72, dpi / 72), alpha=False)
        image = np.frombuffer(pixmap.samples, dtype=np.uint8).reshape(pixmap.height, pixmap.width, 3)
        return cv2.cvtColor(image, cv2.COLOR_RGB2BGR)
    finally:
        document.close()


def detect_circles(image: np.ndarray, document_id: str, page_number: int) -> list[CircleDetection]:
    """Detect pen-like circles using grayscale Hough transform and conservative filters."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.medianBlur(gray, 7)
    raw = cv2.HoughCircles(
        blurred, cv2.HOUGH_GRADIENT, dp=1.2, minDist=120,
        param1=120, param2=34, minRadius=70, maxRadius=145,
    )
    if raw is None:
        return []
    results: list[CircleDetection] = []
    for x, y, radius in np.round(raw[0]).astype(int):
        if x - radius < 0 or y - radius < 0 or x + radius >= image.shape[1] or y + radius >= image.shape[0]:
            continue
        # A candidate must have enough dark/red edge pixels around its circumference.
        mask = np.zeros(gray.shape, dtype=np.uint8)
        cv2.circle(mask, (x, y), radius, 255, 5)
        ink_fraction = float(np.mean(gray[mask > 0] < 180))
        # Text and table intersections create sparse Hough candidates; a deliberately
        # drawn review circle has a substantially continuous inky circumference.
        if ink_fraction < 0.30:
            continue
        results.append(CircleDetection(
            document_id=document_id, page_number=page_number, center_x=float(x), center_y=float(y),
            radius=float(radius), score=round(min(0.99, ink_fraction), 3), method="hough_circle",
            parameters={"dp": 1.2, "param1": 120, "param2": 34, "min_radius": 70, "max_radius": 145},
        ))
    return results


def annotate_circles(image: np.ndarray, detections: list[CircleDetection]) -> np.ndarray:
    overlay = image.copy()
    for index, item in enumerate(detections, start=1):
        center = (round(item.center_x), round(item.center_y))
        cv2.circle(overlay, center, round(item.radius), (0, 180, 0), 4)
        cv2.circle(overlay, center, 4, (0, 180, 0), -1)
        cv2.putText(overlay, f"circle-{index} {item.score:.2f}", (center[0] - round(item.radius), center[1] - round(item.radius) - 12), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 120, 0), 2, cv2.LINE_AA)
    return overlay
