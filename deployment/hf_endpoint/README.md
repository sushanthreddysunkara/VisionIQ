# VisionIQ AI Models - Hugging Face Custom Inference Endpoint

This directory contains the custom inference implementation for serving all VisionIQ AI models from **ONE Hugging Face Repository**:
`Sushanthreddy03/vizioniq-ai-models`

---

## 1. AI Models Served in One Endpoint

| Model | Weights / Artifacts | Framework | Task |
|---|---|---|---|
| **Model A: Highway Detection** | `nh5_yolov8n_960.pt` | Ultralytics YOLOv8n (imgsz 960) | 12 classes: person, bicycle, car, motorcycle, bus, truck, pothole, license_plate, auto, road_construction, accident_scene, fire_accident |
| **Model B: Helmet Violation** | `yolov3-obj.cfg`, `yolov3-obj_2400.weights`, `obj.names` | OpenCV DNN / Darknet | Single-class: `helmet` (detects helmet compliance on two-wheelers) |
| **Model C: License Plate OCR** | `plate_ocr/`, `read_plates_example.py` | RapidOCR + Indian Regex + PlateVoter | High-accuracy ANPR extraction and format validation |

---

## 2. Deploying to Hugging Face Inference Endpoints

1. Navigate to [Hugging Face Inference Endpoints](https://ui.endpoints.huggingface.co/).
2. Click **Create New Endpoint**.
3. Select your repository: `Sushanthreddy03/vizioniq-ai-models`.
4. Choose **Custom Task** (using `handler.py` at repository root).
5. Copy `deployment/hf_endpoint/handler.py` and `deployment/hf_endpoint/requirements.txt` into the root of your Hugging Face model repository `Sushanthreddy03/vizioniq-ai-models`.
6. Select Hardware (e.g. 1x Nvidia T4 or CPU depending on throughput needs).
7. Once deployed, copy your endpoint URL (e.g., `https://xyz.endpoints.huggingface.cloud`).

---

## 3. Configuring VisionIQ Django Backend

In `backend/.env`:

```env
HF_TOKEN=hf_your_user_access_token_here
HF_MODEL_REPO=Sushanthreddy03/vizioniq-ai-models
HF_INFERENCE_URL=https://xyz.endpoints.huggingface.cloud
```

---

## 4. API Request / Response Schema

### POST `/` (or `HF_INFERENCE_URL`)

**Request Payload:**
```json
{
  "inputs": "<base64_encoded_jpeg_or_png_frame>",
  "parameters": {
    "task": "process_frame",
    "conf": 0.50,
    "iou": 0.35,
    "sourceId": "CAM-LIVE-01",
    "timestamp": 14.5
  }
}
```

**Response Payload:**
```json
{
  "success": true,
  "task": "process_frame",
  "model": "vizioniq-ai-models (unified)",
  "sourceId": "CAM-LIVE-01",
  "timestamp": 14.5,
  "counts": {
    "total": 5,
    "vehicles": 4,
    "plates": 3,
    "incidents": 0,
    "violations": 1
  },
  "detections": [
    {
      "label": "car",
      "confidence": 0.965,
      "box": [0.28, 0.38, 0.22, 0.26],
      "classId": 2
    }
  ],
  "vehicles": [
    {
      "label": "car",
      "confidence": 0.965,
      "box": [0.28, 0.38, 0.22, 0.26],
      "plate": "TS 09 EA 4129",
      "plateConfidence": 0.94,
      "isPlateRecognized": true
    }
  ],
  "incidents": [],
  "violations": []
}
```

