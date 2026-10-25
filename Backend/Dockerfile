FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/src \
    AUDITVISION_DOCUMENTS_DIR=/app/data/documents

WORKDIR /app

# Headless OpenCV and PyMuPDF wheels carry their Python extensions; these
# runtime libraries cover their minimal Debian graphics/font dependencies.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libglib2.0-0 libgl1 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system auditvision \
    && useradd --system --gid auditvision --home-dir /app auditvision

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt \
    && python -c "import cv2; assert cv2.__version__.startswith('5.'), cv2.__version__"

COPY src ./src
# Only immutable sample artifacts required by the sample API are included.
COPY data/results/milestone-3-improved ./data/results/milestone-3-improved
COPY ["Sample Docs/Infosys_AuditVision_Synthetic_Test_Dataset/Infosys_AuditVision_Synthetic_Ground_Truth.json", "./Sample Docs/Infosys_AuditVision_Synthetic_Test_Dataset/Infosys_AuditVision_Synthetic_Ground_Truth.json"]

RUN mkdir -p /app/data/documents \
    && chown -R auditvision:auditvision /app

USER auditvision
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3).read()" || exit 1
CMD ["python", "-m", "uvicorn", "auditvision.api.app:app", "--host", "0.0.0.0", "--port", "8000"]
