from django.test import SimpleTestCase
from django.test.client import Client

from .services.query import rule_parse, rule_to_cypher
from .services.inference import InferenceService, InferenceUnavailable
from .services.vehicles import canonical_vehicle_type, normalize_upload_row, to_client_record


class VehicleServiceTests(SimpleTestCase):
    def test_vehicle_type_aliases_are_normalized(self):
        self.assertEqual(canonical_vehicle_type("lorry"), "Truck")
        self.assertEqual(canonical_vehicle_type("motorcycle"), "Bike")
        self.assertEqual(canonical_vehicle_type(""), "Car")

    def test_database_record_keeps_frontend_alias_fields(self):
        row = to_client_record({
            "id": 101,
            "csv_record_id": "OBS-101",
            "timestamp_ist": "2026-10-22 09:00:00",
            "vehicle_type": "lorry",
            "vehicle_number_plate": "TS09AB1234",
            "plate_confidence": 0.8,
            "speed": 72,
            "speed_limit": 60,
            "over_speed": "Yes",
            "latitude": 17.2,
            "longitude": 78.2,
            "vehicle_image_path": "evidence/101.jpg",
            "source_file": "traffic.csv",
        })
        self.assertEqual(row["vehicleType"], "Truck")
        self.assertEqual(row["type"], row["vehicleType"])
        self.assertEqual(row["observationId"], "OBS-101")
        self.assertEqual(row["numberPlate"], row["vehicleNumberPlate"])
        self.assertTrue(row["isOverSpeed"])
        self.assertEqual(row["vehicleImagePath"], "evidence/101.jpg")

    def test_upload_normalization_clamps_confidence_and_drops_data_urls(self):
        values = normalize_upload_row(
            {
                "id": "OBS-1",
                "type": "sedan",
                "plateConfidence": 2,
                "vehicleImagePath": "data:image/png;base64,private",
                "speed": 70,
                "speedLimit": 60,
            },
            "traffic.xlsx",
            0,
        )
        self.assertEqual(values[0], "OBS-1")
        self.assertEqual(values[2], "Car")
        self.assertEqual(values[4], 1.0)
        self.assertIsNone(values[12])
        self.assertEqual(values[8], "Yes")


class QueryServiceTests(SimpleTestCase):
    def test_rule_parser_extracts_overspeed_and_speed_range(self):
        filters, _ = rule_parse("show overspeed trucks between 70 and 90 km/h")
        self.assertTrue(filters["overspeedOnly"])
        self.assertEqual(filters["minSpeed"], 70)
        self.assertEqual(filters["maxSpeed"], 90)
        self.assertEqual(filters["vehicleType"], "Truck")

    def test_camera_number_does_not_become_a_plate(self):
        filters, _ = rule_parse("show incidents from camera 12")
        self.assertIsNone(filters["plate"])
        self.assertEqual(filters["camera"], "camera 12")

    def test_cypher_rule_uses_only_known_vehicle_type_values(self):
        result = rule_to_cypher("show truck observations over 80")
        self.assertIn("o.vehicleType = 'Truck'", result)
        self.assertIn("o.speed >= 80", result)


class InferenceServiceTests(SimpleTestCase):
    def test_frame_validation_rejects_empty_or_unsupported_content(self):
        with self.assertRaises(ValueError):
            InferenceService.validate_frame(b"", "image/jpeg")
        with self.assertRaises(ValueError):
            InferenceService.validate_frame(b"frame", "video/mp4")

    def test_missing_future_model_fails_explicitly_without_predictions(self):
        service = InferenceService(model_path="missing-model")
        with self.assertRaises(InferenceUnavailable):
            service.predict(b"\xff\xd8\xff frame", "image/jpeg")


class ApiValidationTests(SimpleTestCase):
    def setUp(self):
        self.client = Client(HTTP_HOST="localhost")

    def test_health_is_available_without_database_access(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["success"])

    def test_invalid_query_payloads_are_rejected(self):
        ai_response = self.client.post("/api/query/ai-parse", data={}, content_type="application/json")
        cypher_response = self.client.post("/api/query/natural-to-cypher", data={}, content_type="application/json")
        self.assertEqual(ai_response.status_code, 400)
        self.assertEqual(cypher_response.status_code, 400)

    def test_non_object_payloads_are_rejected(self):
        payload = self.client.post("/api/vehicles/upload", data="[]", content_type="application/json")
        self.assertEqual(payload.status_code, 400)

    def test_me_requires_a_token(self):
        response = self.client.get("/api/auth/me")
        self.assertEqual(response.status_code, 401)

    def test_me_rejects_invalid_tokens_with_unauthorized_status(self):
        response = self.client.get("/api/auth/me", HTTP_AUTHORIZATION="Bearer invalid-token")
        self.assertEqual(response.status_code, 401)
