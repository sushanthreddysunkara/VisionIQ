FROM python:3.10-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download model repository snapshot if deploying independently
ARG HF_MODEL_REPO=Sushanthreddy03/vizioniq-ai-models
ENV HF_MODEL_REPO=${HF_MODEL_REPO}
ENV MODEL_DIR=/app

COPY . /app

EXPOSE 8080

CMD ["uvicorn", "deployment.hf_endpoint.app:app", "--host", "0.0.0.0", "--port", "8080"]

