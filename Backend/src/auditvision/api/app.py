from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi

from .routes.health import router as health_router
from .routes.documents import router as documents_router
from .routes.sample import router as sample_router
from .schemas import AIValidationResponse, AIValidationResult, BoundingBox, DashboardEntry, DashboardResponse, DetectionResponse, DocumentListItem, DocumentProcessResponse, DocumentProcessingResponse, DocumentSummaryResponse, DocumentUploadResponse, PageMapping, ProcessRequest, ReviewUpdateRequest, SampleResultsResponse, SampleSummaryResponse


def _cors_origins() -> list[str]:
    configured = os.getenv("AUDITVISION_CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
    return [origin.strip() for origin in configured.split(",") if origin.strip()]


def create_app() -> FastAPI:
    app = FastAPI(
        title="AuditVision AI API",
        version="0.1.0",
        description="Local API boundary for the existing OpenCV 5 vision engine. Document processing is not enabled yet.",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins(),
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )
    app.include_router(health_router)
    app.include_router(sample_router)
    app.include_router(documents_router)

    def custom_openapi() -> dict:
        if app.openapi_schema:
            return app.openapi_schema
        schema = get_openapi(title=app.title, version=app.version, description=app.description, routes=app.routes)
        components = schema.setdefault("components", {}).setdefault("schemas", {})
        # Keep future HTTP contracts visible in /docs without exposing unfinished routes.
        for model in (AIValidationResult, AIValidationResponse, DashboardEntry, DashboardResponse, BoundingBox, PageMapping, DetectionResponse, DocumentProcessingResponse, DocumentListItem, DocumentUploadResponse, ProcessRequest, ReviewUpdateRequest, DocumentProcessResponse, DocumentSummaryResponse, SampleResultsResponse, SampleSummaryResponse):
            model_schema = model.model_json_schema(ref_template="#/components/schemas/{model}")
            components[model.__name__] = model_schema
            components.update(model_schema.pop("$defs", {}))
        app.openapi_schema = schema
        return app.openapi_schema

    app.openapi = custom_openapi
    return app


app = create_app()
