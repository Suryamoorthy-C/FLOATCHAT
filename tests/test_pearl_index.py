import unittest

from server.pearl_index import calculate_pearl_index, species_thresholds


class PearlIndexTests(unittest.TestCase):
    def complete_sample(self):
        return {
            "device_id": "AF-001",
            "species": "pinctada_maxima",
            "observed_at": "2026-10-14T12:00:00Z",
            "lat": -8.1,
            "lon": 115.2,
            "water_temp_c": 28.0,
            "depth_m": 17.0,
            "salinity_psu": 33.0,
            "dissolved_oxygen_mg_l": 6.8,
            "ph": 8.1,
            "turbidity_ntu": 2.0,
            "chlorophyll_a_ug_l": 1.0,
        }

    def test_all_ideal_metrics_produce_high_full_coverage(self):
        result = calculate_pearl_index(self.complete_sample())
        self.assertEqual(result["index"], 100.0)
        self.assertEqual(result["coverage_percent"], 100.0)
        self.assertEqual(result["zone_class"], "high-suitability")
        self.assertEqual(len(result["parameter_scores"]), 7)

    def test_pressure_dbar_converts_to_depth(self):
        sample = self.complete_sample()
        sample.pop("depth_m")
        sample["pressure_dbar"] = 17.1
        result = calculate_pearl_index(sample)
        self.assertAlmostEqual(result["parameter_scores"]["depth_m"]["value"], 16.997, places=2)

    def test_negative_pressure_is_rejected_not_clamped(self):
        result = calculate_pearl_index({"pressure_dbar": -1})
        self.assertNotIn("depth_m", result["parameter_scores"])
        self.assertTrue(any(item["metric"] == "depth_m" and "physical range" in item["reason"] for item in result["excluded_metrics"]))

    def test_missing_metrics_reduce_coverage_without_zero_imputation(self):
        sample = self.complete_sample()
        del sample["ph"]
        del sample["turbidity_ntu"]
        result = calculate_pearl_index(sample)
        self.assertEqual(result["coverage_percent"], 80.0)
        self.assertNotIn("ph", result["parameter_scores"])
        self.assertEqual({item["metric"] for item in result["missing_metrics"]}, {"ph", "turbidity_ntu"})
        self.assertIsNotNone(result["index"])

    def test_qc_failure_excludes_metric_and_can_make_data_insufficient(self):
        sample = {"water_temp_c": 28, "depth_m": 17, "qc_flags": {"water_temp_c": "fail"}}
        result = calculate_pearl_index(sample)
        self.assertNotIn("water_temp_c", result["parameter_scores"])
        self.assertEqual(result["zone_class"], "insufficient-data")
        self.assertTrue(any(item["metric"] == "water_temp_c" for item in result["excluded_metrics"]))

    def test_robust_outlier_is_excluded(self):
        sample = self.complete_sample()
        sample["water_temp_c"] = 40.0
        sample["history"] = {"water_temp_c": [27.9, 28.0, 28.0, 28.1, 28.0, 28.1]}
        result = calculate_pearl_index(sample)
        self.assertNotIn("water_temp_c", result["parameter_scores"])
        self.assertTrue(any("outlier" in item["reason"] for item in result["excluded_metrics"]))

    def test_qc_flag_on_temperature_alias_is_honored(self):
        result = calculate_pearl_index({"temperature_c": 28, "qc_flags": {"temperature_c": "fail"}})
        self.assertNotIn("water_temp_c", result["parameter_scores"])
        self.assertTrue(any(item["metric"] == "water_temp_c" for item in result["excluded_metrics"]))

    def test_low_oxygen_produces_critical_risk_and_warning(self):
        sample = self.complete_sample()
        sample["dissolved_oxygen_mg_l"] = 3.2
        result = calculate_pearl_index(sample)
        self.assertEqual(result["zone_class"], "critical-risk")
        self.assertTrue(any(item.get("metric") == "dissolved_oxygen_mg_l" and item["severity"] == "critical" for item in result["warnings"]))

    def test_high_oxygen_has_no_unsubstantiated_upper_penalty(self):
        sample = self.complete_sample()
        sample["dissolved_oxygen_mg_l"] = 20.0
        result = calculate_pearl_index(sample)
        self.assertEqual(result["parameter_scores"]["dissolved_oxygen_mg_l"]["score"], 100.0)
        self.assertEqual(species_thresholds()["metrics"]["dissolved_oxygen_mg_l"]["ideal"], [6.0, None])

    def test_species_profiles_are_separate_and_versioned(self):
        maxima = species_thresholds("pinctada_maxima")
        fucata = species_thresholds("pinctada_fucata")
        self.assertNotEqual(maxima["profile_version"], fucata["profile_version"])
        self.assertEqual(fucata["metrics"]["salinity_psu"]["ideal"], [27.0, 29.0])

    def test_unknown_species_is_rejected(self):
        with self.assertRaises(ValueError):
            calculate_pearl_index({"water_temp_c": 28}, species="unknown")


if __name__ == "__main__":
    unittest.main()
