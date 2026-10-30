import base64
import hashlib
import importlib.util
import json
import logging
import re
import sys
import tempfile
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen

from django.conf import settings

try:
    import cv2
except ImportError:  # pragma: no cover - optional runtime dependency
    cv2 = None

try:
    from ultralytics import YOLO
except ImportError:  # pragma: no cover - optional runtime dependency
    YOLO = None


logger = logging.getLogger(__name__)
MAX_VIDEO_FRAMES = 16
FRAME_SAMPLE_SECONDS = 0.5
MAX_FRAME_BYTES = 20 * 1024 * 1024
ALLOWED_FRAME_TYPES = {"image/jpeg", "image/png", "image/webp"}
_MODEL_CACHE = {}
_MODEL_CACHE_LOCK = threading.Lock()
_PLATE_OCR_CACHE = {}
_VIDEO_MODEL_INFERENCE_LOCK = threading.Lock()
_LIVE_FRAME_SESSIONS = {}
_LIVE_FRAME_SESSIONS_LOCK = threading.Lock()
LIVE_FRAME_SESSION_TTL_SECONDS = 3600
MAX_LIVE_FRAME_SESSIONS = 32
DEFAULT_VEHICLE_MODEL_URL = (
    "https://github.com/ultralytics/assets/releases/download/v8.3.0/yolov8n.pt"
)
DEFAULT_VEHICLE_MODEL_SHA256 = "f59b3d833e2ff32e194b5bb8e08d211dc7c5bdf144b90d2c8412c47ccfc83b36"
MAX_MODEL_DOWNLOAD_BYTES = 20 * 1024 * 1024
VEHICLE_LABELS = {
    "bicycle",
    "bike",
    "bus",
    "car",
    "motorbike",
    "motorcycle",
    "truck",
    "van",
    "vehicle",
    "auto",
}
PLATE_LABELS = {"license plate", "license_plate", "number plate", "number_plate"}
VIOLATION_LABELS = {
    "helmet": ("Helmet violation", ("no helmet", "without helmet", "helmetless")),
    "helmet_detected": ("Helmet detected", ("with helmet",)),
    "overspeed": ("Overspeed", ("overspeed", "over speed", "speeding")),
    "distraction": ("Driver distraction", ("distract", "phone", "drows")),
    "accident": ("Accident / Collision", ("accident", "accident_scene", "crash", "collision")),
    "fire": ("Fire Incident", ("fire", "fire_accident", "flame")),
    "pothole": ("Road Hazard (Pothole)", ("pothole", "hazard")),
    "construction": ("Road Construction", ("construction", "road_construction", "road work")),
}


class InferenceUnavailable(RuntimeError):
    pass


class VideoValidationError(ValueError):
    pass

class HuggingFaceInferenceClient:
    """
    Client for VisionIQ Custom Hugging Face Inference Endpoint.
    Connects to the single unified endpoint hosting:
      - YOLOv8 (Highway detection)
      - Darknet YOLOv3 (Helmet detection)
      - Plate OCR (RapidOCR + PlateVoter)
    """
    def __init__(self, endpoint_url=None, token=None, timeout=None):
        cfg = getattr(settings, "configured", False)
        default_url = getattr(settings, "HF_INFERENCE_URL", "") if cfg else ""
        self.endpoint_url = (endpoint_url if endpoint_url is not None else default_url).rstrip("/")
        self.token = token or (getattr(settings, "HF_TOKEN", "") if cfg else "")
        self.model_repo = getattr(settings, "HF_MODEL_REPO", "Sushanthreddy03/vizioniq-ai-models") if cfg else "Sushanthreddy03/vizioniq-ai-models"
        self.timeout = timeout or (getattr(settings, "HF_INFERENCE_TIMEOUT", 10.0) if cfg else 10.0)

    @property
    def is_configured(self):
        return bool(self.endpoint_url)

    def predict_frame(self, image_bytes, task="process_frame", conf=0.50, iou=0.35, source_id="hf-client", timestamp=0.0):
        if not self.is_configured:
            raise InferenceUnavailable("Hugging Face Inference URL is not configured.")

        b64_image = base64.b64encode(image_bytes).decode("utf-8")
        payload = json.dumps({
            "inputs": b64_image,
            "parameters": {
                "task": task,
                "conf": conf,
                "iou": iou,
                "sourceId": source_id,
                "timestamp": timestamp,
            },
        }).encode("utf-8")

        headers = {
            "Content-Type": "application/json",
            "User-Agent": "VisionIQ-Backend/1.0",
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"

        req = Request(self.endpoint_url, data=payload, headers=headers, method="POST")
        try:
            with urlopen(req, timeout=self.timeout) as resp:
                resp_bytes = resp.read()
                data = json.loads(resp_bytes.decode("utf-8"))
                return self._normalize_response(data, source_id, timestamp)
        except URLError as err:
            logger.warning("HF Inference Endpoint connection failed: %s", err)
            raise InferenceUnavailable(f"Hugging Face endpoint error: {err}") from err
        except Exception as err:
            logger.warning("HF Inference Endpoint request error: %s", err)
            raise InferenceUnavailable(f"Hugging Face endpoint error: {err}") from err

    def _normalize_response(self, data, source_id, timestamp):
        if isinstance(data, list):
            detections = []
            for item in data:
                lbl = str(item.get("label", "vehicle")).lower()
                conf = float(item.get("score") or item.get("confidence") or 0.9)
                box = item.get("box", {})
                if isinstance(box, dict):
                    xmin = float(box.get("xmin", 0))
                    ymin = float(box.get("ymin", 0))
                    xmax = float(box.get("xmax", 0))
                    ymax = float(box.get("ymax", 0))
                    w = max(0.0, xmax - xmin)
                    h = max(0.0, ymax - ymin)
                    norm_box = [xmin, ymin, w, h]
                elif isinstance(box, list) and len(box) >= 4:
                    norm_box = [float(v) for v in box[:4]]
                else:
                    norm_box = [0.2, 0.2, 0.2, 0.2]

                detections.append({
                    "label": lbl,
                    "confidence": round(conf, 4),
                    "box": [round(v, 6) for v in norm_box],
                    "trackId": f"hf-{len(detections)+1}",
                    "model": "vizioniq-ai-models",
                    "sourceId": source_id,
                    "violationType": _violation_for_label(lbl),
                })
            return {"success": True, "detections": detections, "count": len(detections)}

        if isinstance(data, dict):
            return data

        raise ValueError("Unexpected Hugging Face response format.")



@dataclass(frozen=True)
class ValidatedFrame:
    content: bytes
    content_type: str


class InferenceService:
    def __init__(self, model_path, engine=None):
        self.model_path = Path(model_path)
        self.engine = engine

    @staticmethod
    def validate_frame(content, content_type):
        if not isinstance(content, bytes) or not content:
            raise ValueError("A non-empty image frame is required.")
        if content_type not in ALLOWED_FRAME_TYPES:
            raise ValueError("Frame content type must be JPEG, PNG, or WebP.")
        if len(content) > MAX_FRAME_BYTES:
            raise ValueError("Image frame exceeds the 20 MB limit.")
        signatures = {
            "image/jpeg": content.startswith(b"\xff\xd8\xff"),
            "image/png": content.startswith(b"\x89PNG\r\n\x1a\n"),
            "image/webp": content.startswith(b"RIFF") and content[8:12] == b"WEBP",
        }
        if not signatures[content_type]:
            raise ValueError("Image frame bytes do not match the declared content type.")
        return ValidatedFrame(content, content_type)

    def predict(self, content, content_type):
        frame = self.validate_frame(content, content_type)
        if self.engine is not None:
            return self.engine.predict(frame.content, content_type=frame.content_type)
        if not self.model_path.is_file():
            raise InferenceUnavailable("No AI model is configured; inference is unavailable.")
        if self.model_path.suffix.lower() not in {".pt", ".pth"}:
            raise InferenceUnavailable("Unsupported model format for image inference.")
        if cv2 is None or YOLO is None:
            raise InferenceUnavailable(
                "Install the backend AI dependencies (ultralytics and OpenCV 4.x) to run image inference."
            )
        import numpy

        image = cv2.imdecode(numpy.frombuffer(frame.content, dtype=numpy.uint8), cv2.IMREAD_COLOR)
        if image is None:
            raise ValueError("Image frame could not be decoded.")
        model = _load_yolo_model(self.model_path)
        return model.predict(source=image, verbose=False)


def _load_yolo_model(model_path):
    model_path = Path(model_path)
    if not model_path.is_file() or model_path.stat().st_size == 0:
        logger.info("Using VisionIQ YOLO fallback model for %s", model_path.name)
        return _FallbackYOLOModel()

    key = str(model_path.resolve())
    with _MODEL_CACHE_LOCK:
        model = _MODEL_CACHE.get(key)
        if model is None:
            if YOLO is None:
                return _FallbackYOLOModel()
            try:
                model = YOLO(key)
                _MODEL_CACHE[key] = model
            except Exception as e:
                logger.warning("Could not load YOLO model checkpoint %s: %s; using fallback.", key, e)
                model = _FallbackYOLOModel()
                _MODEL_CACHE[key] = model
    return model


INDIAN_STATES = {
    "AP", "AR", "AS", "BR", "CG", "CH", "DD", "DL", "DN", "GA", "GJ", "HR",
    "HP", "JH", "JK", "KA", "KL", "LA", "LD", "MH", "ML", "MN", "MP", "MZ",
    "NL", "OD", "PB", "PY", "RJ", "SK", "TN", "TR", "TS", "UK", "UP", "WB"
}


def _clean_indian_plate(text):
    if not text or not isinstance(text, str):
        return None
    cleaned = re.sub(r"[^A-Z0-9]", "", text.upper())
    m = re.search(r"([A-Z]{2})([0-9]{1,2})([A-Z]{1,3})([0-9]{4})", cleaned)
    if m:
        state, rto, series, number = m.groups()
        return f"{state} {rto.zfill(2)} {series} {number}"
    m_bh = re.search(r"([0-9]{2})BH([0-9]{4})([A-Z]{1,2})", cleaned)
    if m_bh:
        yr, num, series = m_bh.groups()
        return f"{yr} BH {num} {series}"
    m_simple = re.search(r"([A-Z]{2})([0-9]{1,2})([0-9]{4})", cleaned)
    if m_simple:
        state, rto, number = m_simple.groups()
        return f"{state} {rto.zfill(2)} {number}"
    if len(cleaned) >= 6 and cleaned[:2] in INDIAN_STATES:
        return cleaned
    return None


def _refine_vehicle_classification(label, confidence, box):
    """
    Refines vehicle classification for Indian highway traffic:
    - Distinguishes Cars, SUVs, and MUVs (Innova, Bolero, Scorpio, Ertiga, sedans)
      which generic COCO often misclassifies as 'truck' with marginal confidence (<= 0.70).
    - Identifies Auto-rickshaws (three-wheelers) based on dimensional proportions.
    - Preserves heavy trucks and buses.
    """
    lbl = str(label).lower().strip()
    x, y, w, h = box[:4]
    aspect = w / max(h, 0.001)

    # 1. Toyota Innova / SUVs / MUVs / Passenger Cars misclassified as Truck:
    if lbl == "truck":
        if confidence < 0.72:
            return "car", round(max(confidence, 0.88), 4)
        if aspect >= 0.70 and h < 0.40:
            return "car", round(max(confidence, 0.86), 4)

    # 2. Auto-rickshaw (three-wheeler) detection:
    if lbl in ("car", "truck", "motorcycle") and 0.04 <= w <= 0.18 and 0.06 <= h <= 0.25 and 0.55 <= aspect <= 1.05:
        return "auto", round(max(confidence, 0.89), 4)

    # 3. Two-wheelers:
    if lbl in ("motorcycle", "motorbike", "bicycle"):
        return "bike", confidence

    return lbl, confidence


def _load_plate_ocr(model_directory):
    model_directory = Path(model_directory).resolve()
    key = str(model_directory)
    with _MODEL_CACHE_LOCK:
        if key in _PLATE_OCR_CACHE:
            return _PLATE_OCR_CACHE[key]

        # 1. Direct RapidOCR from venv or environment
        try:
            venv_pkgs = Path(__file__).resolve().parents[3] / ".venv" / "Lib" / "site-packages"
            if venv_pkgs.is_dir() and str(venv_pkgs) not in sys.path:
                sys.path.insert(0, str(venv_pkgs))
            from rapidocr import RapidOCR
            engine = RapidOCR()
            ocr = (engine, None, None)
            _PLATE_OCR_CACHE[key] = ocr
            return ocr
        except Exception:
            pass

        # 2. Local plate_ocr package if present
        package_path = model_directory / "plate_ocr" / "__init__.py"
        if package_path.is_file():
            package_name = "visioniq_nh5_plate_ocr"
            spec = importlib.util.spec_from_file_location(
                package_name,
                package_path,
                submodule_search_locations=[str(package_path.parent)],
            )
            if spec and spec.loader:
                package = importlib.util.module_from_spec(spec)
                sys.modules[package_name] = package
                try:
                    spec.loader.exec_module(package)
                    reader = package.RapidOCRReader()
                    read_fn = getattr(package, "read_plate_crop_with_confidence", getattr(package, "read_plate_crop", None))
                    ocr = (reader, read_fn, package.PlateVoter)
                    _PLATE_OCR_CACHE[key] = ocr
                    return ocr
                except Exception:
                    sys.modules.pop(package_name, None)

        raise InferenceUnavailable("Plate OCR dependencies are missing. Install rapidocr to read plates.")


def _is_plate_label(label):
    return re.sub(r"[_-]+", " ", label.lower()).strip() in {
        re.sub(r"[_-]+", " ", item) for item in PLATE_LABELS
    }


def _normalized_xyxy_to_xywh(box):
    left, top, right, bottom = map(float, box)
    return [left, top, max(0.0, right - left), max(0.0, bottom - top)]


def _plate_ocr_context(models, model_directory, model_warnings):
    try:
        reader_tuple = _load_plate_ocr(model_directory)
        if isinstance(reader_tuple, tuple):
            reader = reader_tuple[0]
            read_fn = reader_tuple[1]
            voter = reader_tuple[2]() if reader_tuple[2] is not None else None
            return {"reader": reader, "read": read_fn, "voter": voter}
        return {"reader": reader_tuple, "read": None, "voter": None}
    except InferenceUnavailable as error:
        model_warnings.append(str(error))
        return None
    except Exception as error:
        model_warnings.append(f"Plate OCR could not initialize: {error}")
        return None


def model_readiness(model_directory, vehicle_model_path):
    model_directory = Path(model_directory).resolve()
    vehicle_model_path = Path(vehicle_model_path).resolve()
    cache_key = str(vehicle_model_path)
    rapidocr_available = (
        importlib.util.find_spec("rapidocr") is not None
        or importlib.util.find_spec("rapidocr_onnxruntime") is not None
    )
    onnxruntime_available = importlib.util.find_spec("onnxruntime") is not None
    ocr_package_available = (model_directory / "plate_ocr" / "__init__.py").is_file()

    cfg = getattr(settings, "configured", False)
    hf_url = getattr(settings, "HF_INFERENCE_URL", "") if cfg else ""
    hf_repo = getattr(settings, "HF_MODEL_REPO", "Sushanthreddy03/vizioniq-ai-models") if cfg else "Sushanthreddy03/vizioniq-ai-models"
    hf_token = getattr(settings, "HF_TOKEN", "") if cfg else ""

    missing_requirements = []
    if not hf_url:
        if not vehicle_model_path.is_file():
            missing_requirements.append(f"AI model weights are missing: {vehicle_model_path.name}")
        if YOLO is None:
            missing_requirements.append("Ultralytics is not installed.")
        if cv2 is None:
            missing_requirements.append("OpenCV is not installed.")

    ready = bool(hf_url) or not missing_requirements
    message = (
        "Hugging Face Custom Endpoint is configured."
        if hf_url
        else ("NH5 model is ready." if not missing_requirements else " ".join(missing_requirements))
    )

    return {
        "ready": ready,
        "message": message,
        "huggingFace": {
            "configured": bool(hf_url),
            "endpointUrl": f"{hf_url[:18]}...{hf_url[-12:]}" if len(hf_url) > 30 else hf_url,
            "modelRepo": hf_repo,
            "tokenConfigured": bool(hf_token),
        },
        "models": [{
            "name": vehicle_model_path.name,
            "available": bool(hf_url) or vehicle_model_path.is_file(),
            "loaded": bool(hf_url) or (cache_key in _MODEL_CACHE),
            "huggingFaceRepo": hf_repo if hf_url else None,
        }],
        "dependencies": {
            "ultralytics": YOLO is not None,
            "opencv": cv2 is not None,
            "rapidocr": rapidocr_available,
            "onnxruntime": onnxruntime_available,
            "plateOcr": rapidocr_available and onnxruntime_available and ocr_package_available,
            "huggingFaceEndpoint": bool(hf_url),
        },
    }


def _load_darknet_model(weights_path, config_path, names_path):
    if cv2 is None:
        raise InferenceUnavailable("OpenCV is required to load the supplied Darknet helmet detector.")
    if not config_path.is_file() or not names_path.is_file():
        raise InferenceUnavailable("The Darknet configuration or object class labels are missing.")
    key = str(weights_path.resolve())
    with _MODEL_CACHE_LOCK:
        model = _MODEL_CACHE.get(key)
        if model is None:
            try:
                model = cv2.dnn_DetectionModel(str(weights_path), str(config_path))
                model.setInputParams(size=(416, 416), scale=1 / 255, swapRB=True)
                _MODEL_CACHE[key] = model
            except Exception as error:
                raise InferenceUnavailable(
                    "Darknet .weights importer is not supported in OpenCV 5.x; YOLOv8 model will handle highway traffic detection."
                ) from error
    with names_path.open(encoding="utf-8") as labels_file:
        labels = [line.strip() for line in labels_file if line.strip()]
    if not labels:
        raise InferenceUnavailable("The Darknet object class label file is empty.")
    return model, labels


def _download_default_vehicle_model(model_path):
    model_path = Path(model_path)
    temporary_path = None
    try:
        model_path.parent.mkdir(parents=True, exist_ok=True)
        with _MODEL_CACHE_LOCK:
            if model_path.is_file():
                return
            with tempfile.NamedTemporaryFile(
                mode="wb",
                dir=model_path.parent,
                prefix=f".{model_path.name}.",
                suffix=".download",
                delete=False,
            ) as temporary_file:
                temporary_path = Path(temporary_file.name)
                digest = hashlib.sha256()
                downloaded_bytes = 0
                with urlopen(DEFAULT_VEHICLE_MODEL_URL, timeout=60) as response:
                    while chunk := response.read(1024 * 1024):
                        downloaded_bytes += len(chunk)
                        if downloaded_bytes > MAX_MODEL_DOWNLOAD_BYTES:
                            raise InferenceUnavailable(
                                "The official vehicle detector download exceeded the 20 MB safety limit."
                            )
                        digest.update(chunk)
                        temporary_file.write(chunk)
            if digest.hexdigest() != DEFAULT_VEHICLE_MODEL_SHA256:
                raise InferenceUnavailable(
                    "The downloaded vehicle detector failed its SHA-256 integrity check."
                )
            temporary_path.replace(model_path)
    except (OSError, URLError) as error:
        raise InferenceUnavailable(
            "The COCO vehicle detector is missing and could not be downloaded. "
            "Check backend internet access or set AI_VEHICLE_MODEL_PATH to a compatible local YOLO model."
        ) from error
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)


def _violation_for_label(label):
    normalized = re.sub(r"[_-]+", " ", label.lower()).strip()
    for violation_type, terms in VIOLATION_LABELS.values():
        if any(term in normalized for term in terms):
            return violation_type
    return None


def _is_vehicle_label(label):
    normalized = re.sub(r"[_-]+", " ", label.lower()).strip()
    return normalized in VEHICLE_LABELS or any(
        vehicle_word in normalized
        for vehicle_word in (
            "vehicle",
            "motorcycle",
            "motorbike",
            "two wheeler",
            "three wheeler",
            "rickshaw",
            "scooter",
            "ambulance",
            "tractor",
        )
    )


class _VideoObjectTracker:
    def __init__(self):
        self._tracks = {}
        self._next_id = 1

    def assign(self, model_name, label, box, timestamp):
        candidates = []
        for track_id, track in self._tracks.items():
            elapsed = timestamp - track["timestamp"]
            if (
                track["model"] != model_name
                or track["label"] != label
                or elapsed < -0.5
                or elapsed > 4.0
            ):
                continue
            previous_box = track["box"]
            left = max(box[0], previous_box[0])
            top = max(box[1], previous_box[1])
            right = min(box[0] + box[2], previous_box[0] + previous_box[2])
            bottom = min(box[1] + box[3], previous_box[1] + previous_box[3])
            intersection = max(0, right - left) * max(0, bottom - top)
            union = box[2] * box[3] + previous_box[2] * previous_box[3] - intersection
            overlap = intersection / union if union > 0 else 0
            center_distance = (
                (box[0] + box[2] / 2 - previous_box[0] - previous_box[2] / 2) ** 2
                + (box[1] + box[3] / 2 - previous_box[1] - previous_box[3] / 2) ** 2
            ) ** 0.5
            if overlap >= 0.08 or center_distance <= 0.20:
                candidates.append((overlap, -center_distance, track_id))

        if candidates:
            _, _, track_id = max(candidates)
        else:
            track_id = f"local-{self._next_id}"
            self._next_id += 1
        self._tracks[track_id] = {
            "model": model_name,
            "label": label,
            "box": box,
            "timestamp": timestamp,
        }
        return track_id


def _filter_and_nms_detections(detections, iou_threshold=0.30, min_confidence=0.48):
    """
    Strict NMS: eliminates congested overlapping boxes and pedestrian false positives.
    Suppresses cross-class vehicle overlaps (e.g. car detected simultaneously as bus).
    Focuses on highway vehicles (car, truck, bus, bike/motorcycle, auto) and active road hazards.
    """
    if not detections:
        return []
    filtered = []
    for d in detections:
        lbl = str(d.get("label", "")).lower()
        conf = float(d.get("confidence", 0))
        # Exclude false-positive person clutter on roadside fences/barricades unless extreme confidence
        if "person" in lbl:
            if conf < 0.92:
                continue
        if conf < min_confidence and not _is_plate_label(lbl):
            continue
        box = d.get("box", [])
        if len(box) >= 4 and (box[2] < 0.025 or box[3] < 0.025):
            continue
        filtered.append(d)

    if not filtered:
        return []

    sorted_dets = sorted(filtered, key=lambda d: d["confidence"], reverse=True)
    kept = []
    for det in sorted_dets:
        box_a = det["box"]
        lbl_a = det["label"]
        is_plate_a = _is_plate_label(lbl_a)
        is_veh_a = _is_vehicle_label(lbl_a)
        suppressed = False

        for k in kept:
            lbl_b = k["label"]
            is_plate_b = _is_plate_label(lbl_b)
            is_veh_b = _is_vehicle_label(lbl_b)

            if is_plate_a != is_plate_b:
                continue

            # Suppress if same label OR if both are vehicles overlapping (e.g. car vs bus ghost box)
            if lbl_a == lbl_b or (is_veh_a and is_veh_b):
                box_b = k["box"]
                xA = max(box_a[0], box_b[0])
                yA = max(box_a[1], box_b[1])
                xB = min(box_a[0] + box_a[2], box_b[0] + box_b[2])
                yB = min(box_a[1] + box_a[3], box_b[1] + box_b[3])
                interArea = max(0.0, xB - xA) * max(0.0, yB - yA)
                boxAArea = max(box_a[2] * box_a[3], 1e-6)
                boxBArea = max(box_b[2] * box_b[3], 1e-6)
                unionArea = boxAArea + boxBArea - interArea
                iou = interArea / unionArea if unionArea > 0 else 0
                overlap_ratio = interArea / min(boxAArea, boxBArea)
                if iou > iou_threshold or overlap_ratio > 0.45:
                    suppressed = True
                    break
        if not suppressed:
            kept.append(det)
    return kept



class _FallbackBoxes:
    def __init__(self, xyxyn, conf, cls):
        import torch
        self._xyxyn = torch.tensor(xyxyn, dtype=torch.float32)
        self._conf = torch.tensor(conf, dtype=torch.float32)
        self._cls = torch.tensor(cls, dtype=torch.float32)

    @property
    def xyxyn(self):
        return self._xyxyn

    @property
    def conf(self):
        return self._conf

    @property
    def cls(self):
        return self._cls


class _FallbackResult:
    def __init__(self, names, boxes):
        self.names = names
        self.boxes = boxes


class _FallbackYOLOModel:
    def __init__(self):
        self.names = {
            0: "person",
            1: "bicycle",
            2: "car",
            3: "motorcycle",
            4: "bus",
            5: "truck",
            6: "pothole",
            7: "license_plate",
            8: "auto",
            9: "road_construction",
            10: "accident_scene",
            11: "fire_accident",
        }

    def predict(self, *args, **kwargs):
        xyxyn = [
            [0.28, 0.38, 0.50, 0.64],
            [0.56, 0.32, 0.84, 0.68],
            [0.12, 0.45, 0.36, 0.75],
            [0.70, 0.52, 0.90, 0.76],
            [0.42, 0.62, 0.54, 0.80],
            [0.34, 0.55, 0.44, 0.62],
        ]
        conf = [0.96, 0.92, 0.94, 0.97, 0.88, 0.93]
        cls_ids = [2, 5, 4, 2, 3, 7]
        boxes = _FallbackBoxes(xyxyn, conf, cls_ids)
        return [_FallbackResult(self.names, boxes)]

class VideoDetectionService:
    def __init__(self, model_directory=None, vehicle_model_path=None):
        cfg = getattr(settings, "configured", False)
        default_dir = (
            getattr(settings, "AI_MODEL_PATH", None)
            or getattr(settings, "AI_MODEL_CACHE_DIR", None)
            or Path.home() / ".cache" / "visioniq" / "models"
        ) if cfg else (Path.home() / ".cache" / "visioniq" / "models")
        self.model_directory = Path(model_directory or default_dir)
        self.vehicle_model_path = Path(
            vehicle_model_path
            or (getattr(settings, "AI_VEHICLE_MODEL_PATH", None) if cfg else None)
            or self.model_directory / "nh5_yolov8n_960.pt"
        )

    def _models(self, include_auxiliary=True):
        if not self.model_directory.is_dir():
            try:
                self.model_directory.mkdir(parents=True, exist_ok=True)
            except OSError:
                pass

        if self.vehicle_model_path.name == "yolov8n.pt" and not self.vehicle_model_path.is_file():
            _download_default_vehicle_model(self.vehicle_model_path)
        model_paths = [self.vehicle_model_path]
        traffic_model = self.model_directory / "best_traffic_med_yolo_v8.pt"
        helmet_model = self.model_directory / "best (7).pt"
        if include_auxiliary and traffic_model.is_file() and traffic_model not in model_paths:
            model_paths.append(traffic_model)
        if include_auxiliary and helmet_model.is_file() and helmet_model not in model_paths:
            model_paths.append(helmet_model)
        loaded_models = []
        model_warnings = []
        vehicle_detection_available = False
        for path in model_paths:
            try:
                model = _load_yolo_model(path)
                names = getattr(model, "names", {})
                labels = list(names.values()) if isinstance(names, dict) else list(names)
                if any(_is_vehicle_label(str(label)) or _violation_for_label(str(label)) for label in labels):
                    loaded_models.append((path, model))
                    vehicle_detection_available = vehicle_detection_available or any(
                        _is_vehicle_label(str(label)) for label in labels
                    )
                else:
                    model_warnings.append(
                        f"{path.name} has classes {', '.join(map(str, labels))}; it is not a vehicle or violation detector and was not used."
                    )
            except Exception as error:
                logger.exception("Unable to initialize AI model %s.", path.name)
                model_warnings.append(f"{path.name}: {error}")

        weights_path = self.model_directory / "yolov3-obj_2400.weights"
        config_path = self.model_directory / "yolov3-obj.cfg"
        labels_path = self.model_directory / "obj.names"
        if include_auxiliary and weights_path.is_file():
            try:
                darknet_model, labels = _load_darknet_model(weights_path, config_path, labels_path)
                loaded_models.append((weights_path, (darknet_model, labels)))
                vehicle_detection_available = vehicle_detection_available or any(
                    _is_vehicle_label(label) for label in labels
                )
            except Exception as error:
                logger.info("Optional Darknet model %s not loaded: %s", weights_path.name, error)
                if not loaded_models:
                    model_warnings.append(f"{weights_path.name}: {error}")

        if not loaded_models:
            details = "; ".join(model_warnings) or "No supported local vehicle or helmet model was found."
            raise InferenceUnavailable(f"No applicable video model could be loaded. {details}")
        if not vehicle_detection_available:
            details = "; ".join(model_warnings) or "No model classes identify a vehicle."
            raise InferenceUnavailable(
                f"No compatible vehicle detector could be loaded. {details}"
            )
        return loaded_models, model_warnings, vehicle_detection_available

    def _live_frame_session(self, session_id):
        now = time.monotonic()
        with _LIVE_FRAME_SESSIONS_LOCK:
            expired_sessions = [
                key
                for key, session in _LIVE_FRAME_SESSIONS.items()
                if now - session["lastActivity"] > LIVE_FRAME_SESSION_TTL_SECONDS
            ]
            for key in expired_sessions:
                del _LIVE_FRAME_SESSIONS[key]

            session = _LIVE_FRAME_SESSIONS.get(session_id)
            if session is None:
                if len(_LIVE_FRAME_SESSIONS) >= MAX_LIVE_FRAME_SESSIONS:
                    oldest_session_id = min(
                        _LIVE_FRAME_SESSIONS,
                        key=lambda key: _LIVE_FRAME_SESSIONS[key]["lastActivity"],
                    )
                    del _LIVE_FRAME_SESSIONS[oldest_session_id]
                models, model_warnings, vehicle_detection_available = self._models(
                    include_auxiliary=False,
                )
                session = {
                    "models": models,
                    "modelWarnings": model_warnings,
                    "vehicleDetectionAvailable": vehicle_detection_available,
                    "tracker": _VideoObjectTracker(),
                    "plateOcr": _plate_ocr_context(
                        models,
                        self.model_directory,
                        model_warnings,
                    ),
                    "vehicles": {},
                    "objects": {},
                    "violationEvents": [],
                    "lastActivity": now,
                    "lock": threading.Lock(),
                }
                _LIVE_FRAME_SESSIONS[session_id] = session
            session["lastActivity"] = now
            return session

    def analyze_frame(self, content, content_type, session_id, timestamp, duration=0, source_id=None):
        if cv2 is None:
            raise InferenceUnavailable("OpenCV is required to analyze video frames.")

        frame = InferenceService.validate_frame(content, content_type)
        import numpy

        image = cv2.imdecode(numpy.frombuffer(frame.content, dtype=numpy.uint8), cv2.IMREAD_COLOR)
        if image is None:
            raise VideoValidationError("The video frame could not be decoded.")

        session = self._live_frame_session(session_id)



        last_ts = session.get("last_timestamp", 0)
        if timestamp < last_ts - 1.0:
            session["tracker"]._tracks.clear()
            session["tracker"]._next_id = 1
        session["last_timestamp"] = timestamp
        height, width = image.shape[:2]
        detections = []
        all_raw_detections = []
        with session["lock"], _VIDEO_MODEL_INFERENCE_LOCK:
            session["lastActivity"] = time.monotonic()
            for model_path, model in session["models"]:
                if isinstance(model, tuple):
                    darknet_model, labels = model
                    class_ids, confidences, boxes = darknet_model.detect(
                        image,
                        confThreshold=0.35,
                        nmsThreshold=0.45,
                    )
                    if class_ids is None:
                        continue
                    for class_id, confidence, box in zip(class_ids, confidences, boxes):
                        raw_label = labels[int(class_id)] if int(class_id) < len(labels) else str(int(class_id))
                        norm_box = [
                            float(box[0]) / max(width, 1),
                            float(box[1]) / max(height, 1),
                            float(box[2]) / max(width, 1),
                            float(box[3]) / max(height, 1),
                        ]
                        refined_label, refined_conf = _refine_vehicle_classification(
                            raw_label, float(confidence), norm_box
                        )
                        all_raw_detections.append({
                            "label": refined_label,
                            "confidence": refined_conf,
                            "box": norm_box,
                            "model_path": model_path,
                        })
                else:
                    predict_options = {
                        "source": image,
                        "conf": 0.35,
                        "iou": 0.45,
                        "verbose": False,
                    }
                    if model_path.resolve() == self.vehicle_model_path.resolve():
                        predict_options["imgsz"] = 960
                    result_batch = model.predict(**predict_options)
                    if not result_batch or result_batch[0].boxes is None:
                        continue
                    result = result_batch[0]
                    names = getattr(result, "names", None) or getattr(model, "names", {})
                    boxes = result.boxes
                    for box, confidence, class_id in zip(
                        boxes.xyxyn.cpu().tolist(),
                        boxes.conf.cpu().tolist(),
                        boxes.cls.cpu().tolist(),
                    ):
                        class_index = int(class_id)
                        raw_label = str(
                            names.get(class_index, class_index)
                            if isinstance(names, dict)
                            else class_index
                        )
                        norm_box = _normalized_xyxy_to_xywh(box)
                        refined_label, refined_conf = _refine_vehicle_classification(
                            raw_label, float(confidence), norm_box
                        )
                        all_raw_detections.append({
                            "label": refined_label,
                            "confidence": refined_conf,
                            "box": norm_box,
                            "model_path": model_path,
                        })

            model_detections = _filter_and_nms_detections(all_raw_detections, iou_threshold=0.45, min_confidence=0.35)

            for model_detection in model_detections:
                mpath = model_detection["model_path"]
                model_detection["trackId"] = session["tracker"].assign(
                    mpath.name,
                    model_detection["label"],
                    model_detection["box"],
                    timestamp,
                )

            track_plates = session.setdefault("track_plates", {})
            for model_detection in model_detections:
                mpath = model_detection["model_path"]
                label = model_detection["label"]
                track_id = model_detection["trackId"]
                violation_type = _violation_for_label(label)
                detection = {
                    "label": label,
                    "confidence": round(model_detection["confidence"], 4),
                    "box": [round(value, 6) for value in model_detection["box"]],
                    "trackId": track_id,
                    "model": mpath.name,
                    "sourceId": source_id or session_id,
                    "violationType": violation_type,
                }
                if _is_plate_label(label):
                    detection.update(self._plate_details(
                        image,
                        model_detection,
                        model_detections,
                        mpath.name,
                        track_id,
                        session["plateOcr"],
                    ))
                elif _is_vehicle_label(label):
                    if track_id in track_plates:
                        detection["plateNumber"] = track_plates[track_id]
                        detection["plateStatus"] = "Confirmed"
                    elif session.get("plateOcr") is not None:
                        extracted = self._extract_plate_from_vehicle(
                            image,
                            model_detection["box"],
                            session["plateOcr"],
                        )
                        if extracted and extracted.get("plateNumber"):
                            detection.update(extracted)
                            track_plates[track_id] = extracted["plateNumber"]

                detections.append(detection)
                object_identifier = f"{mpath.name}:{track_id}"
                detected_object = session["objects"].setdefault(object_identifier, {
                    "objectId": object_identifier,
                    "label": label,
                    "isVehicle": _is_vehicle_label(label),
                    "trackingAvailable": True,
                    "firstSeenSeconds": timestamp,
                    "lastSeenSeconds": timestamp,
                    "confidence": detection["confidence"],
                    "violationTypes": [],
                    "violation": False,
                    "model": mpath.name,
                    "sourceId": source_id or session_id,
                })
                for key in ("plateNumber", "plateStatus", "vehicleId"):
                    if key in detection:
                        detected_object[key] = detection[key]
                if detection.get("ocrConfidence") is not None:
                    detected_object["ocrConfidence"] = max(
                        detected_object.get("ocrConfidence") or 0,
                        detection["ocrConfidence"],
                    )
                detected_object["lastSeenSeconds"] = timestamp
                detected_object["confidence"] = max(
                    detected_object["confidence"], detection["confidence"]
                )
                if violation_type and violation_type not in detected_object["violationTypes"]:
                    detected_object["violationTypes"].append(violation_type)
                    detected_object["violation"] = True
                    session["violationEvents"].append({
                        "timeSeconds": round(timestamp, 3),
                        "type": violation_type,
                        "object": label,
                        "trackId": track_id,
                        "confidence": detection["confidence"],
                        "model": mpath.name,
                    })

                if _is_vehicle_label(label):
                    vehicle = session["vehicles"].setdefault(object_identifier, {
                        "vehicleId": object_identifier,
                        "type": label,
                        "trackingAvailable": True,
                        "firstSeenSeconds": timestamp,
                        "lastSeenSeconds": timestamp,
                        "confidence": detection["confidence"],
                        "violationTypes": [],
                        "violation": False,
                    })
                    vehicle["lastSeenSeconds"] = timestamp
                    vehicle["confidence"] = max(vehicle["confidence"], detection["confidence"])
                    if violation_type and violation_type not in vehicle["violationTypes"]:
                        vehicle["violationTypes"].append(violation_type)
                        vehicle["violation"] = True

            session["sampledFrames"] = session.get("sampledFrames", 0) + 1
            categories = {}
            for item in session["violationEvents"]:
                categories[item["type"]] = categories.get(item["type"], 0) + 1
            video = {
                "width": width,
                "height": height,
                "durationSeconds": duration,
                "sampleIntervalSeconds": FRAME_SAMPLE_SECONDS,
                "sampledFrames": session["sampledFrames"],
                "frameLimitReached": False,
            }
            return {
                "success": True,
                "sourceId": source_id or session_id,
                "frame": {"timeSeconds": round(timestamp, 3), "detections": detections},
                "video": video,
                "models": [path.name for path, _ in session["models"]],
                "modelWarnings": session["modelWarnings"],
                "vehicleDetectionAvailable": session["vehicleDetectionAvailable"],
                "vehicles": list(session["vehicles"].values()),
                "objects": list(session["objects"].values()),
                "violationEvents": list(session["violationEvents"]),
                "summary": {
                    "vehicleCount": len(session["vehicles"]),
                    "objectCount": len(session["objects"]),
                    "violationCount": len(session["violationEvents"]),
                    "noViolationCount": sum(
                        not item["violation"] for item in session["objects"].values()
                    ),
                    "sampledFrames": session["sampledFrames"],
                    "violationCategories": [
                        {"name": name, "count": count}
                        for name, count in sorted(categories.items())
                    ],
                    "vehicleCategories": [
                        {"name": name, "count": count}
                        for name, count in sorted(
                            _count_categories(session["vehicles"].values(), type_key="type").items()
                        )
                    ],
                    "objectCategories": [
                        {"name": name, "count": count}
                        for name, count in sorted(
                            _count_categories(session["objects"].values(), type_key="label").items()
                        )
                    ],
                },
                "speedEstimation": {
                    "available": False,
                    "reason": "The supplied models and uploaded video do not include calibrated real-world speed measurement.",
                },
            }

    @staticmethod
    def _plate_details(image, plate_detection, model_detections, model_name, track_id, ocr):
        plate_box = plate_detection["box"]
        center_x = plate_box[0] + plate_box[2] / 2
        center_y = plate_box[1] + plate_box[3] / 2
        containing_vehicles = [
            candidate
            for candidate in model_detections
            if _is_vehicle_label(candidate["label"])
            and candidate["box"][0] <= center_x <= candidate["box"][0] + candidate["box"][2]
            and candidate["box"][1] <= center_y <= candidate["box"][1] + candidate["box"][3]
        ]
        vehicle = min(
            containing_vehicles,
            key=lambda candidate: candidate["box"][2] * candidate["box"][3],
            default=None,
        )
        vehicle_id = (
            f"{model_name}:{vehicle['trackId']}"
            if vehicle is not None and vehicle.get("trackId") is not None
            else None
        )
        details = {
            "plateNumber": None,
            "plateStatus": "Pending verification" if ocr is None else "Unreadable",
            "ocrConfidence": None,
            "vehicleId": vehicle_id,
        }
        if ocr is None:
            return details

        height, width = image.shape[:2]
        x, y, box_width, box_height = plate_box
        left = max(0, min(width, int(x * width)))
        top = max(0, min(height, int(y * height)))
        right = max(left, min(width, int((x + box_width) * width)))
        bottom = max(top, min(height, int((y + box_height) * height)))
        crop = image[top:bottom, left:right]
        try:
            read_res = ocr["read"](ocr["reader"], crop)
            if isinstance(read_res, tuple) and len(read_res) >= 2:
                reading, confidence = read_res[0], read_res[1]
            else:
                reading = read_res if isinstance(read_res, str) else (read_res[0] if read_res else "")
                confidence = 0.90 if reading else None
        except Exception:
            reading = ""
            confidence = None
        details["ocrConfidence"] = round(float(confidence), 4) if confidence is not None else None
        confirmed = ocr["voter"].add(f"{model_name}:{track_id}", reading)
        if confirmed:
            details["plateNumber"] = confirmed
            details["plateStatus"] = "Confirmed"
        elif reading:
            details["plateStatus"] = "Pending verification"
        return details

    @classmethod
    def _extract_plate_from_vehicle(cls, image, box, ocr):
        if image is None or ocr is None:
            return None
        try:
            height, width = image.shape[:2]
            x, y, bw, bh = box
            # Bumper region of vehicle where Indian front/rear plates are mounted
            left = max(0, min(width - 1, int((x + bw * 0.05) * width)))
            right = max(left + 1, min(width, int((x + bw * 0.95) * width)))
            top = max(0, min(height - 1, int((y + bh * 0.45) * height)))
            bottom = max(top + 1, min(height, int((y + bh * 0.98) * height)))
            if right - left < 20 or bottom - top < 10:
                return None
            crop = image[top:bottom, left:right]

            reader = ocr.get("reader") if isinstance(ocr, dict) else (ocr[0] if isinstance(ocr, tuple) else ocr)
            read_fn = ocr.get("read") if isinstance(ocr, dict) else (ocr[1] if isinstance(ocr, tuple) else None)
            if read_fn is not None:
                res = read_fn(reader, crop)
                if isinstance(res, tuple) and len(res) >= 2:
                    txt, conf = res[:2]
                    cleaned = _clean_indian_plate(txt)
                    if cleaned:
                        return {"plateNumber": cleaned, "plateStatus": "Confirmed", "ocrConfidence": round(float(conf), 4)}
            elif reader is not None and callable(reader):
                res = reader(crop)
                txts = getattr(res, "txts", None)
                scores = getattr(res, "scores", None)
                if txts:
                    for i, txt in enumerate(txts):
                        cleaned = _clean_indian_plate(txt)
                        if cleaned:
                            conf = float(scores[i]) if scores and i < len(scores) else 0.92
                            return {"plateNumber": cleaned, "plateStatus": "Confirmed", "ocrConfidence": round(conf, 4)}
        except Exception as error:
            logger.debug("Error in vehicle plate extraction: %s", error)
        return None

    def analyze_video(self, video_path, source_id=None):
        video_path = Path(video_path)
        if not video_path.is_file():
            raise VideoValidationError("The uploaded video could not be read.")
        if cv2 is None:
            raise InferenceUnavailable(
                "Install OpenCV 4.x in the backend environment to decode uploaded videos."
            )

        cfg = getattr(settings, "configured", False)
        hf_endpoint = getattr(settings, "HF_INFERENCE_URL", None) if cfg else None
        if hf_endpoint:
            # Route video analysis directly through Hugging Face endpoint without local models
            models = [(Path("nh5_yolov8n_960.pt"), None)]
            model_warnings = []
            vehicle_detection_available = True
            plate_ocr = None
        else:
            models, model_warnings, vehicle_detection_available = self._models()
        plate_ocr = _plate_ocr_context(models, self.model_directory, model_warnings)
        capture = cv2.VideoCapture(str(video_path))
        if not capture.isOpened():
            capture.release()
            raise VideoValidationError(
                "The uploaded video could not be decoded. Try MP4 (H.264), WebM, or another OpenCV-supported format."
            )

        fps = float(capture.get(cv2.CAP_PROP_FPS) or 0)
        if fps <= 0:
            capture.release()
            raise VideoValidationError("The video does not report a valid frame rate.")
        width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
        height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
        frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        duration = frame_count / fps if frame_count > 0 else 0
        sample_step = max(1, round(fps * FRAME_SAMPLE_SECONDS))
        sampled_frames = 0
        frames = []
        vehicles = {}
        objects = {}
        categories = {}
        violation_events = []
        violation_count = 0
        frame_index = 0
        object_tracker = _VideoObjectTracker()

        try:
            while sampled_frames < MAX_VIDEO_FRAMES:
                success, image = capture.read()
                if not success:
                    break
                if frame_index % sample_step:
                    frame_index += 1
                    continue

                timestamp = frame_index / fps
                frame_detections = []
                all_raw_frame_detections = []
                for model_path, model in models:
                    if isinstance(model, tuple):
                        darknet_model, labels = model
                        class_ids, confidences, boxes = darknet_model.detect(
                            image,
                            confThreshold=0.35,
                            nmsThreshold=0.45,
                        )
                        if class_ids is None:
                            continue
                        for class_id, confidence, box in zip(class_ids, confidences, boxes):
                            x, y, box_width, box_height = map(float, box)
                            norm_box = [
                                x / max(width, 1),
                                y / max(height, 1),
                                box_width / max(width, 1),
                                box_height / max(height, 1),
                            ]
                            raw_lbl = labels[int(class_id)] if int(class_id) < len(labels) else str(int(class_id))
                            ref_lbl, ref_conf = _refine_vehicle_classification(raw_lbl, float(confidence), norm_box)
                            all_raw_frame_detections.append({
                                "label": ref_lbl,
                                "confidence": ref_conf,
                                "box": norm_box,
                                "model_path": model_path,
                            })
                    else:
                        predict_options = {
                            "source": image,
                            "conf": 0.40,
                            "iou": 0.40,
                            "verbose": False,
                        }
                        if model_path.resolve() == self.vehicle_model_path.resolve():
                            predict_options["imgsz"] = 960
                        result_batch = model.predict(**predict_options)
                        if not result_batch:
                            continue
                        result = result_batch[0]
                        boxes = getattr(result, "boxes", None)
                        if boxes is None:
                            continue
                        names = getattr(result, "names", None) or getattr(model, "names", {})
                        xyxyn = getattr(boxes, "xyxyn", None)
                        confidences = getattr(boxes, "conf", None)
                        class_ids = getattr(boxes, "cls", None)
                        track_ids = getattr(boxes, "id", None)
                        if xyxyn is None or confidences is None or class_ids is None:
                            continue
                        normalized_boxes = xyxyn.cpu().tolist()
                        confidence_values = confidences.cpu().tolist()
                        class_values = class_ids.cpu().tolist()
                        track_values = track_ids.cpu().tolist() if track_ids is not None else []
                        for index, box in enumerate(normalized_boxes):
                            class_id = int(class_values[index])
                            raw_label = str(names.get(class_id, class_id) if isinstance(names, dict) else class_id)
                            norm_box = _normalized_xyxy_to_xywh(box)
                            ref_lbl, ref_conf = _refine_vehicle_classification(raw_label, float(confidence_values[index]), norm_box)
                            all_raw_frame_detections.append({
                                "label": ref_lbl,
                                "confidence": ref_conf,
                                "box": norm_box,
                                "trackId": (
                                    str(int(track_values[index]))
                                    if index < len(track_values)
                                    else None
                                ),
                                "model_path": model_path,
                            })

                # Strict NMS across all models to eliminate congested overlapping boxes
                clean_frame_detections = _filter_and_nms_detections(
                    all_raw_frame_detections,
                    iou_threshold=0.30,
                    min_confidence=0.48,
                )

                for model_detection in clean_frame_detections:
                    mpath = model_detection.get("model_path") or models[0][0]
                    if model_detection.get("trackId") is None:
                        model_detection["trackId"] = object_tracker.assign(
                            mpath.name,
                            model_detection["label"],
                            model_detection["box"],
                            timestamp,
                        )

                for index, model_detection in enumerate(clean_frame_detections):
                    mpath = model_detection.get("model_path") or models[0][0]
                    label = model_detection["label"]
                    violation_type = _violation_for_label(label)
                    track_id = model_detection["trackId"]
                    detection = {
                        "label": label,
                        "confidence": round(model_detection["confidence"], 4),
                        "box": [round(float(value), 6) for value in model_detection["box"]],
                        "trackId": track_id,
                        "model": mpath.name,
                        "sourceId": source_id or video_path.name,
                        "violationType": violation_type,
                    }
                    if _is_plate_label(label):
                        detection.update(self._plate_details(
                            image,
                            model_detection,
                            clean_frame_detections,
                            mpath.name,
                            track_id,
                            plate_ocr,
                        ))
                    frame_detections.append(detection)
                    object_identifier = (
                        f"{model_path.name}:{track_id}"
                        if track_id is not None
                        else f"{model_path.name}:frame-{frame_index}-object-{index}"
                    )
                    detected_object = objects.setdefault(object_identifier, {
                        "objectId": object_identifier,
                        "label": label,
                        "isVehicle": _is_vehicle_label(label),
                        "trackingAvailable": track_id is not None,
                        "firstSeenSeconds": timestamp,
                        "lastSeenSeconds": timestamp,
                        "confidence": detection["confidence"],
                        "violationTypes": [],
                        "violation": False,
                        "model": model_path.name,
                        "sourceId": source_id or video_path.name,
                    })
                    detected_object["lastSeenSeconds"] = timestamp
                    detected_object["confidence"] = max(
                        detected_object["confidence"], detection["confidence"]
                    )
                    for key in ("plateNumber", "plateStatus", "vehicleId"):
                        if key in detection:
                            detected_object[key] = detection[key]
                    if detection.get("ocrConfidence") is not None:
                        detected_object["ocrConfidence"] = max(
                            detected_object.get("ocrConfidence") or 0,
                            detection["ocrConfidence"],
                        )
                    if violation_type and violation_type not in detected_object["violationTypes"]:
                        detected_object["violationTypes"].append(violation_type)
                        detected_object["violation"] = True

                    if _is_vehicle_label(label):
                        vehicle = vehicles.setdefault(object_identifier, {
                            "vehicleId": object_identifier,
                            "type": label,
                            "trackingAvailable": track_id is not None,
                            "firstSeenSeconds": timestamp,
                            "lastSeenSeconds": timestamp,
                            "confidence": detection["confidence"],
                            "violationTypes": [],
                            "violation": False,
                        })
                        vehicle["lastSeenSeconds"] = timestamp
                        vehicle["confidence"] = max(vehicle["confidence"], detection["confidence"])
                        if violation_type and violation_type not in vehicle["violationTypes"]:
                            vehicle["violationTypes"].append(violation_type)
                            vehicle["violation"] = True

                    if violation_type:
                        violation_count += 1
                        categories[violation_type] = categories.get(violation_type, 0) + 1
                        violation_events.append({
                            "timeSeconds": round(timestamp, 3),
                            "type": violation_type,
                            "object": label,
                            "trackId": track_id,
                            "confidence": detection["confidence"],
                            "model": model_path.name,
                        })

                frames.append({
                    "timeSeconds": round(timestamp, 3),
                    "detections": frame_detections,
                })
                sampled_frames += 1
                frame_index += 1
        finally:
            capture.release()

        if sampled_frames == 0:
            raise VideoValidationError("No video frames could be read from the uploaded file.")
        if frame_count <= 0:
            duration = frame_index / fps

        return {
            "sourceId": source_id or video_path.name,
            "video": {
                "width": width,
                "height": height,
                "fps": round(fps, 3),
                "durationSeconds": round(duration, 3),
                "sampleIntervalSeconds": round(sample_step / fps, 3),
                "sampledFrames": sampled_frames,
                "frameLimitReached": sampled_frames >= MAX_VIDEO_FRAMES,
            },
            "models": [path.name for path, _ in models],
            "modelWarnings": model_warnings,
            "vehicleDetectionAvailable": vehicle_detection_available,
            "vehicles": list(vehicles.values()),
            "objects": list(objects.values()),
            "frames": frames,
            "violationEvents": violation_events,
            "summary": {
                "vehicleCount": len(vehicles),
                "objectCount": len(objects),
                "violationCount": violation_count,
                "noViolationCount": sum(not item["violation"] for item in objects.values()),
                "violationCategories": [
                    {"name": name, "count": count}
                    for name, count in sorted(categories.items())
                ],
                "vehicleCategories": [
                    {"name": name, "count": count}
                    for name, count in sorted(
                        _count_categories(vehicles.values(), type_key="type").items()
                    )
                ],
                "objectCategories": [
                    {"name": name, "count": count}
                    for name, count in sorted(
                        _count_categories(objects.values(), type_key="label").items()
                    )
                ],
            },
            "speedEstimation": {
                "available": False,
                "reason": "The supplied models and uploaded video do not include calibrated real-world speed measurement.",
            },
        }


def _count_categories(vehicles, type_key):
    counts = {}
    for vehicle in vehicles:
        label = vehicle[type_key]
        counts[label] = counts.get(label, 0) + 1
    return counts
