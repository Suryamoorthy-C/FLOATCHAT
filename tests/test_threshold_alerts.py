import tempfile
import unittest
from pathlib import Path

from server.threshold_alerts import ThresholdStore, Thresholds, check_and_notify, evaluate_thresholds


class ThresholdAlertTests(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory()
        self.store = ThresholdStore(str(Path(self.tempdir.name) / "users.sqlite3"))

    def tearDown(self):
        self.tempdir.cleanup()

    def test_save_and_get_thresholds_per_user(self):
        limits = Thresholds(min_temperature_c=18, max_temperature_c=30, min_pressure_dbar=2, max_pressure_dbar=100)
        saved = self.store.save("user-1", "farmer@example.com", limits)
        self.assertEqual(saved["thresholds"], limits.as_dict())
        self.assertEqual(self.store.get("user-1")["email"], "farmer@example.com")
        self.assertIsNone(self.store.get("user-2"))

    def test_only_values_outside_bounds_breach(self):
        limits = Thresholds(min_temperature_c=18, max_temperature_c=30, min_pressure_dbar=2, max_pressure_dbar=100)
        inside = evaluate_thresholds({"temperature_c": 24, "pressure_dbar": 40}, limits)
        boundary = evaluate_thresholds({"temperature_c": 18, "pressure_dbar": 100}, limits)
        self.assertEqual(inside, [])
        self.assertEqual(boundary, [])
        breaches = evaluate_thresholds({"temperature_c": 31, "pressure_dbar": 1, "observed_at": "2026-10-15T04:00:00Z"}, limits)
        self.assertEqual([(item["metric"], item["bound"]) for item in breaches], [
            ("temperature_c", "maximum"), ("pressure_dbar", "minimum")
        ])
        self.assertTrue(all(item["observed_at"] == "2026-10-15T04:00:00Z" for item in breaches))

    def test_check_sends_once_for_each_custom_breach_with_reading_details(self):
        self.store.save("user-1", "farmer@example.com", Thresholds(max_temperature_c=28))
        sent = []

        def fake_sender(email, device_id, breach):
            sent.append((email, device_id, breach))
            return {"sent": True, "provider_id": "test-email"}

        result = check_and_notify(self.store, "user-1", {
            "device_id": "AF-007", "temperature_c": 31, "observed_at": "2026-10-15T04:00:00Z"
        }, sender=fake_sender)
        self.assertEqual(len(sent), 1)
        self.assertEqual(sent[0][0:2], ("farmer@example.com", "AF-007"))
        self.assertEqual(sent[0][2]["threshold"], 28)
        self.assertEqual(sent[0][2]["reading"], 31)
        self.assertTrue(result["notifications"][0]["sent"])

    def test_missing_user_never_sends(self):
        sent = []
        result = check_and_notify(self.store, "unknown", {"temperature_c": 99}, sender=lambda *args: sent.append(args))
        self.assertEqual(result["breaches"], [])
        self.assertEqual(sent, [])


if __name__ == "__main__":
    unittest.main()
