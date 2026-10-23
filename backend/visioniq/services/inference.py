from dataclasses import dataclass
from pathlib import Path


MAX_FRAME_BYTES = 20 * 1024 * 1024
ALLOWED_FRAME_TYPES = {"image/jpeg", "image/png", "image/webp"}


class InferenceUnavailable(RuntimeError):
    pass


@dataclass(frozen=True)
class ValidatedFrame:
    content: bytes
    content_type: str


class InferenceService:
    def __init__(self, model_path: Path, engine=None):
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
        if self.engine is None:
            if not self.model_path.exists():
                raise InferenceUnavailable("No AI model is configured; inference is unavailable.")
            raise InferenceUnavailable("A model adapter is required before inference can run.")
        return self.engine.predict(frame.content, content_type=frame.content_type)
