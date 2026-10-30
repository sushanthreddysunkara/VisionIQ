"""
FastAPI Server for Hugging Face Inference Endpoint & Docker / Space Deployment
Wraps EndpointHandler to provide identical APIs locally, in Docker, and on Hugging Face.
"""

import os
from typing import Any, Dict
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .handler import EndpointHandler

app = FastAPI(
    title="VisionIQ Hugging Face Custom Inference Service",
    description="Unified AI model endpoint for Highway Detection (YOLOv8), Helmet Detection (YOLOv3), and Plate OCR",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize endpoint handler loading models once on startup
handler = None


@app.on_event("startup")
def startup_event():
    global handler
    model_dir = os.getenv("MODEL_DIR", ".")
    handler = EndpointHandler(path=model_dir)


class InferenceRequest(BaseModel):
    inputs: str
    parameters: Dict[str, Any] = {}


@app.get("/")
def root():
    return {
        "status": "online",
        "service": "VisionIQ Hugging Face Inference Endpoint",
        "repository": "Sushanthreddy03/vizioniq-ai-models",
        "models": {
            "model_a": "Ultralytics YOLOv8n (nh5_yolov8n_960.pt - 12 classes)",
            "model_b": "Darknet YOLOv3 (yolov3-obj_2400.weights - helmet)",
            "model_c": "RapidOCR + PlateVoter (plate_ocr)",
        },
        "tasks": ["process_frame", "highway_detection", "helmet_detection", "plate_ocr"],
    }


@app.post("/")
async def hf_predict(request: InferenceRequest):
    """Native Hugging Face Inference Endpoint format."""
    if handler is None:
        raise HTTPException(status_code=503, detail="Model handler initializing.")
    return handler(request.dict())


@app.post("/predict")
async def predict_json(request: InferenceRequest):
    if handler is None:
        raise HTTPException(status_code=503, detail="Model handler initializing.")
    return handler(request.dict())


@app.post("/api/live-feed/analyze-frame")
async def analyze_frame_multipart(
    frame: UploadFile = File(...),
    task: str = Form("process_frame"),
    sourceId: str = Form("upload"),
):
    """Direct multipart file upload route matching VisionIQ Django format."""
    if handler is None:
        raise HTTPException(status_code=503, detail="Model handler initializing.")
    content = await frame.read()
    return handler({
        "inputs": content,
        "parameters": {
            "task": task,
            "sourceId": sourceId,
        },
    })


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("deployment.hf_endpoint.app:app", host="0.0.0.0", port=8080, reload=True)

