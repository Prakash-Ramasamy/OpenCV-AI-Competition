from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any, Protocol

logger = logging.getLogger(__name__)


class JsonStorageError(RuntimeError):
    pass


class JsonObjectMissing(JsonStorageError):
    pass


class JsonStorage(Protocol):
    def get_json(self, key: str) -> Any: ...
    def put_json(self, key: str, payload: Any, *, overwrite: bool = True) -> None: ...
    def exists(self, key: str) -> bool: ...
    def list_keys(self, prefix: str) -> list[str]: ...


def _safe_key(key: str) -> str:
    normalized = key.strip().replace("\\", "/")
    if not normalized or normalized.startswith("/") or any(part in {"", ".", ".."} for part in normalized.split("/")):
        raise JsonStorageError("Invalid JSON storage key.")
    return normalized


class LocalJsonStorage:
    def __init__(self, root: Path):
        self.root = root.resolve()

    def _path(self, key: str) -> Path:
        path = (self.root / _safe_key(key)).resolve()
        try:
            path.relative_to(self.root)
        except ValueError as error:
            raise JsonStorageError("JSON storage key escapes local storage root.") from error
        return path

    def get_json(self, key: str) -> Any:
        path = self._path(key)
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except FileNotFoundError as error:
            raise JsonObjectMissing(key) from error
        except json.JSONDecodeError as error:
            raise JsonStorageError(f"Stored JSON is malformed for key {key}.") from error

    def put_json(self, key: str, payload: Any, *, overwrite: bool = True) -> None:
        path = self._path(key)
        if path.exists() and not overwrite:
            raise FileExistsError(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(path.suffix + ".tmp")
        temporary.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        temporary.replace(path)

    def exists(self, key: str) -> bool:
        return self._path(key).is_file()

    def list_keys(self, prefix: str) -> list[str]:
        safe_prefix = _safe_key(prefix.rstrip("/"))
        root = self._path(safe_prefix)
        if not root.exists():
            return []
        return [path.relative_to(self.root).as_posix() for path in root.rglob("*") if path.is_file()]


class S3JsonStorage:
    def __init__(self, bucket: str, region: str):
        import boto3
        from botocore.config import Config

        self.bucket = bucket
        self.client = boto3.client("s3", region_name=region, config=Config(retries={"max_attempts": 3, "mode": "standard"}))

    def get_json(self, key: str) -> Any:
        key = _safe_key(key)
        try:
            body = self.client.get_object(Bucket=self.bucket, Key=key)["Body"].read()
            return json.loads(body.decode("utf-8"))
        except self.client.exceptions.ClientError as error:
            code = error.response.get("Error", {}).get("Code")
            if code in {"404", "NoSuchKey", "NotFound"}:
                raise JsonObjectMissing(key) from error
            raise JsonStorageError(f"Unable to read stored JSON object {key}.") from error
        except Exception as error:
            logger.exception("Unable to read JSON object from configured storage: bucket=%s key=%s", self.bucket, key)
            raise JsonStorageError(f"Unable to read stored JSON object {key}.") from error

    def put_json(self, key: str, payload: Any, *, overwrite: bool = True) -> None:
        key = _safe_key(key)
        if not overwrite and self.exists(key):
            raise FileExistsError(key)
        try:
            self.client.put_object(Bucket=self.bucket, Key=key, Body=json.dumps(payload, indent=2).encode("utf-8"), ContentType="application/json")
        except self.client.exceptions.ClientError as error:
            code = error.response.get("Error", {}).get("Code", "unknown")
            logger.exception("Unable to write JSON object to configured storage: bucket=%s key=%s code=%s", self.bucket, key, code)
            raise JsonStorageError(f"Unable to write stored JSON object {key} ({code}).") from error
        except Exception as error:
            logger.exception("Unable to write JSON object to configured storage: bucket=%s key=%s", self.bucket, key)
            raise JsonStorageError(f"Unable to write stored JSON object {key}.") from error

    def exists(self, key: str) -> bool:
        key = _safe_key(key)
        try:
            self.client.head_object(Bucket=self.bucket, Key=key)
            return True
        except self.client.exceptions.ClientError as error:
            if error.response.get("Error", {}).get("Code") in {"404", "NoSuchKey", "NotFound"}:
                return False
            raise JsonStorageError(f"Unable to inspect stored JSON object {key}.") from error

    def list_keys(self, prefix: str) -> list[str]:
        prefix = prefix.strip("/") + "/"
        try:
            keys: list[str] = []
            paginator = self.client.get_paginator("list_objects_v2")
            for page in paginator.paginate(Bucket=self.bucket, Prefix=prefix):
                keys.extend(item["Key"] for item in page.get("Contents", []) if "Key" in item)
            return keys
        except Exception as error:
            logger.exception("Unable to list JSON objects from configured storage: bucket=%s prefix=%s", self.bucket, prefix)
            raise JsonStorageError(f"Unable to list stored JSON objects under {prefix}.") from error


def create_json_storage() -> JsonStorage:
    backend = os.getenv("AUDITVISION_STORAGE_BACKEND", "local").lower()
    if backend == "local":
        from .sample_results import BACKEND_ROOT
        return LocalJsonStorage(BACKEND_ROOT)
    if backend == "s3":
        bucket = os.getenv("AUDITVISION_S3_BUCKET")
        region = os.getenv("AUDITVISION_S3_REGION", os.getenv("AWS_DEFAULT_REGION", "us-east-1"))
        if not bucket:
            raise JsonStorageError("AUDITVISION_S3_BUCKET is required when AUDITVISION_STORAGE_BACKEND=s3.")
        return S3JsonStorage(bucket, region)
    raise JsonStorageError("AUDITVISION_STORAGE_BACKEND must be local or s3.")
