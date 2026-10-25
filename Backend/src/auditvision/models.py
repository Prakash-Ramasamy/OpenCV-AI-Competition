from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any


@dataclass(frozen=True)
class CircleDetection:
    document_id: str
    page_number: int
    center_x: float
    center_y: float
    radius: float
    score: float
    method: str
    parameters: dict[str, Any]
    associated_text: str | None = None

    @property
    def bounding_box(self) -> dict[str, float]:
        return {
            "x": self.center_x - self.radius,
            "y": self.center_y - self.radius,
            "width": self.radius * 2,
            "height": self.radius * 2,
        }

    def to_dict(self, page_width: int, page_height: int) -> dict[str, Any]:
        data = asdict(self)
        data["bounding_box"] = self.bounding_box
        data["normalized_center"] = {
            "x": self.center_x / page_width,
            "y": self.center_y / page_height,
        }
        return data
