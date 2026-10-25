from __future__ import annotations

import cv2
from fastapi import APIRouter

from ..schemas import HealthResponse

router = APIRouter(tags=["system"])


@router.get("/health", response_model=HealthResponse, summary="Check service and OpenCV availability")
def health() -> HealthResponse:
    return HealthResponse(status="ok", service="auditvision-api", opencv_version=cv2.__version__)
