from __future__ import annotations

from dataclasses import asdict, dataclass

from .models import CircleDetection


@dataclass(frozen=True)
class CircleMetrics:
    true_positives: int
    false_positives: int
    false_negatives: int
    precision: float
    recall: float
    f1: float
    mean_center_error_px: float | None

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


def evaluate_circles(detections: list[CircleDetection], ground_truth: list[dict], max_center_error_px: float = 45) -> CircleMetrics:
    expected = [item for item in ground_truth if item["type"] == "circle"]
    unmatched = set(range(len(expected)))
    errors: list[float] = []
    true_positives = 0
    for detection in detections:
        choices = []
        for index in unmatched:
            x, y = expected[index]["pixel_coordinates"]["center"]
            error = ((detection.center_x - x) ** 2 + (detection.center_y - y) ** 2) ** 0.5
            choices.append((error, index))
        if choices:
            error, matched_index = min(choices)
            if error <= max_center_error_px:
                unmatched.remove(matched_index)
                errors.append(error)
                true_positives += 1
    false_positives = len(detections) - true_positives
    false_negatives = len(expected) - true_positives
    precision = true_positives / len(detections) if detections else 0.0
    recall = true_positives / len(expected) if expected else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return CircleMetrics(true_positives, false_positives, false_negatives, precision, recall, f1, sum(errors) / len(errors) if errors else None)
