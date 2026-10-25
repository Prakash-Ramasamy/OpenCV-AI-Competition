from auditvision.evaluate import evaluate_circles
from auditvision.models import CircleDetection


def test_circle_evaluation_calculates_precision_recall_and_center_error():
    detection = CircleDetection("test", 1, 101, 199, 30, 0.9, "test", {})
    truth = [{"type": "circle", "pixel_coordinates": {"center": [100, 200], "radius": 30}}]
    result = evaluate_circles([detection], truth, max_center_error_px=10)
    assert result.precision == result.recall == result.f1 == 1.0
    assert result.mean_center_error_px is not None
