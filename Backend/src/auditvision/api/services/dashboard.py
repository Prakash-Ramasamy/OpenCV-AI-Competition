from __future__ import annotations

import logging
import os

from fastapi import HTTPException

from ..schemas import DashboardEntry, DashboardResponse
from .json_storage import JsonObjectMissing, JsonStorageError, create_json_storage

logger = logging.getLogger(__name__)


def dashboard() -> DashboardResponse:
    if os.getenv("AUDITVISION_DEMO_ENTRIES_ENABLED", "false").lower() not in {"1", "true", "yes", "on"}:
        return DashboardResponse(source="disabled", entries=[])
    key = os.getenv("AUDITVISION_S3_DEMO_KEY", "demo/default-dashboard.json")
    try:
        payload = create_json_storage().get_json(key)
    except JsonObjectMissing as error:
        logger.error("Configured dashboard demo object is missing: key=%s", key)
        raise HTTPException(503, "Dashboard demo data is unavailable in configured storage.") from error
    except JsonStorageError as error:
        logger.error("Configured dashboard storage could not be read: key=%s", key)
        raise HTTPException(503, "Dashboard data storage is unavailable.") from error
    try:
        entries = [DashboardEntry.model_validate(item) for item in payload["entries"]]
    except (KeyError, TypeError, ValueError) as error:
        logger.error("Configured dashboard object has an invalid schema: key=%s", key)
        raise HTTPException(503, "Dashboard data is malformed.") from error
    if len(entries) != 2:
        logger.error("Configured dashboard object must contain exactly two entries: key=%s count=%s", key, len(entries))
        raise HTTPException(503, "Dashboard demo data must contain exactly two entries.")
    return DashboardResponse(source="demo", entries=entries)
