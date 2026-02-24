import json
import tempfile
import unittest
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app import create_app


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.db_file = tempfile.NamedTemporaryFile(delete=False)
        self.app = create_app({"TESTING": True, "DATABASE_PATH": self.db_file.name})
        self.client = self.app.test_client()

    def tearDown(self):
        self.db_file.close()

    def test_create_session_and_stats(self):
        payload = {
            "start_time": "2026-02-24T10:00:00",
            "end_time": "2026-02-24T10:25:00",
            "duration_sec": 1500,
            "type": "work",
        }
        response = self.client.post(
            "/api/sessions", data=json.dumps(payload), content_type="application/json"
        )
        self.assertEqual(response.status_code, 201)

        stats = self.client.get("/api/stats?date=2026-02-24")
        data = stats.get_json()
        self.assertEqual(data["completed_sessions"], 1)
        self.assertEqual(data["focus_minutes"], 25)

    def test_negative_duration_rejected(self):
        payload = {
            "start_time": "2026-02-24T10:00:00",
            "end_time": "2026-02-24T10:25:00",
            "duration_sec": -10,
            "type": "work",
        }
        response = self.client.post(
            "/api/sessions", data=json.dumps(payload), content_type="application/json"
        )
        self.assertEqual(response.status_code, 400)

    def test_break_session_not_counted(self):
        payload = {
            "start_time": "2026-02-24T11:00:00",
            "end_time": "2026-02-24T11:05:00",
            "duration_sec": 300,
            "type": "break",
        }
        response = self.client.post(
            "/api/sessions", data=json.dumps(payload), content_type="application/json"
        )
        self.assertEqual(response.status_code, 201)

        stats = self.client.get("/api/stats?date=2026-02-24")
        data = stats.get_json()
        self.assertEqual(data["completed_sessions"], 0)
        self.assertEqual(data["focus_minutes"], 0)


if __name__ == "__main__":
    unittest.main()
