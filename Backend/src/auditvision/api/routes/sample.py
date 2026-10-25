from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse

from ..schemas import DashboardResponse, SampleResultsResponse, SampleSummaryResponse
from ..services.dashboard import dashboard
from ..services.sample_results import SampleResultsStore

router = APIRouter(prefix="/api/v1/sample", tags=["sample results"])

@router.get("/dashboard", response_model=DashboardResponse, summary="Read the two S3-backed demo dashboard entries")
def demo_dashboard() -> DashboardResponse:
    return dashboard()


def get_sample_store() -> SampleResultsStore:
    return SampleResultsStore()


@router.get("/results", response_model=SampleResultsResponse, summary="Read frozen Milestone 3 detections")
def results(store: SampleResultsStore = Depends(get_sample_store)) -> SampleResultsResponse:
    return store.results()


@router.get("/summary", response_model=SampleSummaryResponse, summary="Read detection counts and saved evaluation metrics")
def summary(store: SampleResultsStore = Depends(get_sample_store)) -> SampleSummaryResponse:
    return store.summary()


@router.get("/pages/{sample_page_index}/image", summary="Get a rendered page by 1-based sample PDF page index")
def page_image(sample_page_index: int, store: SampleResultsStore = Depends(get_sample_store)) -> FileResponse:
    return FileResponse(store.page_image(sample_page_index), media_type="image/png")
