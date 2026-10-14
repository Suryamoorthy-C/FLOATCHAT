import unittest
from unittest.mock import patch

from server.query_engine import analyze, interpret, render_answer


FLEET = {
    "count": 3,
    "source": "Test ARGO",
    "source_url": "https://example.test/argo",
    "fetched_at": "2026-10-15T00:00:00+00:00",
    "live": True,
    "window_days": 3,
    "data": [
        {"platform_number": "A", "lat": 16, "lon": 85, "temperature_c": 27.0, "salinity_psu": 33.8, "status": "active"},
        {"platform_number": "B", "lat": 18, "lon": 90, "temperature_c": 26.0, "salinity_psu": 34.2, "status": "active"},
        {"platform_number": "C", "lat": 12, "lon": 65, "temperature_c": 29.0, "salinity_psu": 35.4, "status": "active"},
    ],
}


class QueryEngineTests(unittest.TestCase):
    def test_casual_greeting_is_answered_without_data_retrieval(self):
        result = analyze("Hey there")
        self.assertEqual(result["status"], "success")
        self.assertIn("FloatChat", result["summary"])
        self.assertEqual(result["query_parameters"]["intent"], "casual")
        self.assertEqual(result["observations"], [])

    def test_casual_thanks_and_help_are_supported(self):
        thanks = analyze("Thanks, that helps")
        help_result = analyze("What can you do?")
        self.assertIn("welcome", thanks["summary"])
        self.assertIn("casually", help_result["summary"])

    def test_interpret_supports_contextual_follow_up(self):
        parsed = interpret("What about salinity?", [{"role": "user", "content": "Compare temperature in the Bay of Bengal"}])
        self.assertEqual(parsed["region"], "Bay Of Bengal")
        self.assertIn("salinity", parsed["variables"])
        self.assertTrue(parsed["context_used"])

    @patch("server.query_engine.store")
    def test_regional_data_answer_has_real_stats_and_visualization(self, store):
        store.fleet.return_value = FLEET
        store.anomalies.return_value = {"data": []}
        result = analyze("Compare temperature and salinity in the Bay of Bengal")
        self.assertEqual(result["status"], "success")
        self.assertEqual(len(result["observations"]), 2)
        self.assertTrue(result["analysis"]["results"])
        self.assertTrue(any(item["type"] == "globe_markers" for item in result["visualizations"]))
        self.assertTrue(result["workflow"][1]["status"], "complete")

    @patch("server.query_engine.store")
    def test_general_question_uses_research_without_fabricating_observations(self, store):
        result = analyze("What is ARGO and why does it matter?")
        self.assertEqual(result["status"], "success")
        self.assertEqual(result["observations"], [])
        self.assertTrue(result["citations"])
        self.assertIn("literature", result["analysis"]["method"])
        store.fleet.assert_not_called()

    @patch("server.query_engine.store")
    def test_missing_region_is_honest(self, store):
        store.fleet.return_value = {**FLEET, "data": []}
        result = analyze("Show unusual temperature observations in the Arabian Sea")
        self.assertEqual(result["status"], "no_data")
        self.assertEqual(result["observations"], [])
        self.assertIn("No matching", result["summary"])

    def test_render_answer_does_not_drop_limitations(self):
        text = render_answer({
            "summary": "Retrieved observations.",
            "analysis": {"results": [{"variable": "temperature", "value": 27.2, "mean": 27.2, "unit": "°C", "count": 2}], "limitations": ["Recent sample only."]},
            "research_sources": [],
        })
        self.assertIn("27.2", text)
        self.assertIn("Recent sample only", text)


if __name__ == "__main__":
    unittest.main()
