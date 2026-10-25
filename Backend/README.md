# AuditVision AI

Local-first MVP for detecting synthetic audit annotations in financial-statement PDFs. This is a competition proof of concept, not an audit tool and not a system for certifying financial statements.

## Milestone 1

The first vertical slice generates a labelled synthetic financial statement, renders page 1 at 144 DPI, detects a deliberately drawn circle with **OpenCV 5**, writes an image overlay and structured JSON, then calculates actual circle precision, recall, F1, and centre-coordinate error.

Synthetic highlights, ticks, crosses, and underlines are included in ground truth but are not yet detected; they are intentionally deferred to later milestones.

## Setup

Use a project-local environment only. The intended pinned environment is in `requirements.txt`. This workspace's Python distribution cannot seed `pip` in a new virtual environment, so the following command installs into the project `.venv` without installing packages globally.

```powershell
python -m pip --python .\.venv\Scripts\python.exe install -r requirements.txt
.\.venv\Scripts\python.exe -c "import cv2; assert cv2.__version__.startswith('5.'); print(cv2.__version__)"
$env:PYTHONPATH = "$PWD\src"
.\.venv\Scripts\python.exe -m pytest
.\.venv\Scripts\python.exe -m auditvision.run_demo
```

The last command produces `data/synthetic/ground_truth.json` and the following generated, ignored artifacts:

- `data/artifacts/milestone-1/original-page-1.png`
- `data/artifacts/milestone-1/annotated-page-1.png`
- `data/artifacts/milestone-1/detections.json`
- `data/artifacts/milestone-1/evaluation.json`

## Boundaries

- No AWS calls, uploads, credentials, or resources are used in Milestone 1.
- `ap-south-1` is recorded in `.env.example` for later, opt-in AWS adapters.
- A circled figure triggers investigation in a future agent workflow; it is never evidence of fraud or a confirmed discrepancy by itself.

## Local FastAPI foundation

The HTTP API is separate from the existing detector CLI. It currently exposes health and API documentation only; it does not accept documents, process PDFs, or call cloud services.

```powershell
cd Backend
$env:PYTHONPATH = "$PWD\src"
.\.venv\Scripts\python.exe -m uvicorn auditvision.api.app:app --host 127.0.0.1 --port 8000
```

Open `http://127.0.0.1:8000/docs` and call `GET /health`. Configure allowed local browser origins through the process environment, for example:

```powershell
$env:AUDITVISION_CORS_ORIGINS = "http://localhost:3000,http://127.0.0.1:3000"
```

`.env.example` records the supported variable names; never place cloud credentials in frontend configuration.

### Read-only Milestone 3 result API

With the local API running, these routes serve existing artifacts only; they do not rerun OpenCV or modify result files:

- `GET /api/v1/sample/results` — 46 saved detections, normalized for HTTP clients.
- `GET /api/v1/sample/summary` — saved-detection counts and stored evaluation metrics.
- `GET /api/v1/sample/pages/{sample_page_index}/image` — rendered image using a **1-based** sample PDF page index, for example `/pages/1/image`.

`AUDITVISION_SAMPLE_RESULTS_DIR` and `AUDITVISION_SAMPLE_GROUND_TRUTH_PATH` are optional paths relative to `Backend`; their defaults target the frozen Milestone 3 artifacts.

### Local PDF processing API

`POST /api/v1/documents` accepts a PDF and stores it privately under `data/documents/{document_id}`. `POST /api/v1/documents/{document_id}/process` synchronously invokes the existing OpenCV renderer and detectors for up to five selected 1-based pages. No ground truth, cloud upload, or AWS service is used for an uploaded document.

Artifacts are published only after successful processing. Use `GET /api/v1/documents/{document_id}/detections`, `/summary`, and `/pages/{sample_page_index}/image`; add `?annotated=true` to request the annotated page image.
## JSON storage and demo dashboard

The runtime dashboard reads exactly two entries from `demo/default-dashboard.json` through the configured storage backend; it does not fall back to frontend fixtures when the object is missing. Local development and tests default to the local backend. ECS can use S3 by setting `AUDITVISION_STORAGE_BACKEND=s3` and the S3 variables in `.env.example`.

Seed a local or configured S3 store with the idempotent utility (use `--force` only when intentionally replacing the object):

```powershell
$env:PYTHONPATH = "src"
python scripts/seed_demo_dashboard.py
```

For ECS, attach the least-privilege task-role policy in `../docs/ecs-s3-iam-policy.json` (the seed operation itself requires a separate, tightly scoped `s3:PutObject` permission for the demo key). No AWS resources are created by this repository.

### Local Docker S3/Bedrock workflow

Copy the previously tested Bedrock API key into the blank `AWS_BEARER_TOKEN_BEDROCK` value in the ignored `Backend/.env`. The local-only `compose.s3-local.yaml` override passes that file to the backend; it does not require an AWS profile, AWS CLI, or mounted credential cache.

```powershell
cd C:\D-Drive\Repo\DevPost\OpenCV
docker compose -f compose.yaml -f compose.s3-local.yaml up -d --build
docker compose -f compose.yaml -f compose.s3-local.yaml exec backend python scripts/diagnose_local_config.py
```

The diagnostic prints only sanitized configuration. When S3 mode is selected, Boto3 uses its standard credential chain; no credentials are printed. Stop the local stack with:

```powershell
docker compose -f compose.yaml -f compose.s3-local.yaml down
```
