import cv2
import numpy as np

from auditvision.dataset_runner import detect_marks


def test_cross_requires_opposed_diagonal_strokes():
    image = np.full((220, 300, 3), 255, dtype=np.uint8)
    cv2.line(image, (76, 100), (92, 116), (0, 0, 255), 2)
    cv2.line(image, (92, 100), (76, 116), (0, 0, 255), 2)
    assert any(item["type"] == "cross" for item in detect_marks(image))


def test_red_rectangle_is_not_a_cross():
    image = np.full((220, 300, 3), 255, dtype=np.uint8)
    cv2.rectangle(image, (76, 100), (92, 116), (0, 0, 255), 2)
    assert not any(item["type"] == "cross" for item in detect_marks(image))


def test_highlight_and_tick_regression():
    image = np.full((300, 500, 3), 255, dtype=np.uint8)
    cv2.rectangle(image, (40, 80), (380, 105), (0, 220, 255), -1)
    cv2.line(image, (75, 190), (84, 200), (0, 180, 0), 3)
    cv2.line(image, (84, 200), (101, 176), (0, 180, 0), 3)
    types = [item["type"] for item in detect_marks(image)]
    assert "highlight" in types and "tick" in types


def test_detached_oval_strokes_form_one_circle_candidate():
    image = np.full((220, 1300, 3), 255, dtype=np.uint8)
    cv2.line(image, (980, 80), (1000, 80), (0, 0, 255), 2)
    cv2.line(image, (980, 112), (1000, 112), (0, 0, 255), 2)
    circles = [item for item in detect_marks(image) if item["type"] == "circle"]
    assert len(circles) == 1
