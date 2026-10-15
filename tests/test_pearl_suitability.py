import unittest

from server.pearl_suitability import calculate_pearl_suitability, preprocess_sensor_data


class PearlSuitabilityTests(unittest.TestCase):
    def optimum(self):
        return {
            "device_id": "AF-OPT-01", "species": "pinctada_maxima",
            "observed_at": "2026-10-15T00:00:00Z", "lat": -8.1, "lon": 115.2,
            "temperature_c": 27.0, "depth_m": 15.0,
            "chlorophyll_a_ug_l": 2.0, "salinity_psu": 30.0,
            "dissolved_oxygen_mg_l": 6.5,
        }

    def test_optimal_zone_scores_100_with_full_coverage(self):
        result = calculate_pearl_suitability(self.optimum())
        self.assertEqual(result["index"], 100.0)
        self.assertEqual(result["coverage_percent"], 100.0)
        self.assertEqual(result["classification"], "high-suitability")
        self.assertEqual(len(result["parameter_scores"]), 5)
        self.assertEqual(result["location"], {"lat": -8.1, "lon": 115.2})

    def test_cold_shock_red_provisional_score_and_low_temp_flag(self):
        sample = self.optimum()
        sample["temperature_c"] = 10.0
        result = calculate_pearl_suitability(sample, "pinctada_fucata_martensii")
        self.assertLess(result["index"], 100)
        self.assertEqual(result["parameter_scores"]["temperature_c"]["score"], 0.0)
        # The species-specific literature context is returned, not overclaimed as
        # a universal mortality prediction.
        self.assertIn("temperature_growth_reference_c", result["biological_evidence"])

    def test_low_oxygen_produces_critical_hypoxia_hazard(self):
        sample = self.optimum()
        sample["dissolved_oxygen_mg_l"] = 1.5
        result = calculate_pearl_suitability(sample)
        self.assertEqual(result["classification"], "critical-risk")
        self.assertTrue(any(h["code"] == "severe_hypoxia" for h in result["hazards"]))

    def test_correlated_warming_chlorophyll_rise_and_oxygen_drop_flags_unsafe_pattern(self):
        sample = self.optimum()
        sample.update({"temperature_c": 30.0, "chlorophyll_a_ug_l": 15.0, "dissolved_oxygen_mg_l": 4.4})
        sample["history"] = {
            "temperature_c": [27.0, 27.5, 28.0],
            "chlorophyll_a_ug_l": [4.0, 5.0, 5.0],
            "dissolved_oxygen_mg_l": [7.0, 6.8, 6.5],
        }
        sample["lat"], sample["lon"] = -8.2, 115.3
        result = calculate_pearl_suitability(sample)
        hazard = next(h for h in result["hazards"] if h["code"] == "unsafe_bloom_like_pattern")
        self.assertTrue(result["unsafe_zone"])
        self.assertIn("not confirmation", hazard["message"])
        self.assertEqual(result["location"], {"lat": -8.2, "lon": 115.3})
        self.assertIn("toxin assay or local health authority HAB notice", hazard["confirmation_needed"])

    def test_chlorophyll_alone_does_not_confirm_bloom(self):
        sample = self.optimum()
        sample["chlorophyll_a_ug_l"] = 25.0
        result = calculate_pearl_suitability(sample)
        self.assertFalse(result["unsafe_zone"])
        self.assertTrue(any(h["code"] == "very_high_chlorophyll_provisional" for h in result["hazards"]))

    def test_missing_values_reduce_coverage_without_imputation(self):
        sample = self.optimum()
        del sample["salinity_psu"]
        del sample["depth_m"]
        result = calculate_pearl_suitability(sample)
        self.assertEqual(result["coverage_percent"], 60.0)
        self.assertNotIn("salinity_psu", result["parameter_scores"])
        self.assertIn("salinity_psu", result["missing_metrics"])

    def test_nonfinite_and_impossible_values_are_flagged(self):
        prepared = preprocess_sensor_data({"temperature_c": float("nan"), "salinity_psu": 90})
        self.assertIsNone(prepared["values"]["temperature_c"])
        self.assertIsNone(prepared["values"]["salinity_psu"])
        self.assertEqual({x["code"] for x in prepared["quality_flags"]}, {"invalid_nonfinite_or_nonnumeric", "outside_plausibility_range"})

    def test_isolated_noise_spike_is_excluded_but_preserved_as_raw(self):
        sample = self.optimum()
        sample["temperature_c"] = 38.0
        sample["history"] = {"temperature_c": [26.9, 27.0, 27.1, 27.0, 27.0, 27.1]}
        result = calculate_pearl_suitability(sample)
        self.assertNotIn("temperature_c", result["parameter_scores"])
        self.assertTrue(any(x["code"] == "isolated_robust_outlier" and x["metric"] == "temperature_c" for x in result["quality_flags"]))
        self.assertEqual(preprocess_sensor_data(sample)["raw_values"]["temperature_c"], 38.0)

    def test_pressure_dbar_converts_to_depth(self):
        sample = self.optimum()
        sample.pop("depth_m")
        sample["pressure_dbar"] = 15.09
        result = calculate_pearl_suitability(sample)
        self.assertAlmostEqual(result["parameter_scores"]["depth_m"]["value"], 15.0, places=1)

    def test_different_species_profile_changes_temperature_scoring(self):
        sample = self.optimum()
        sample["temperature_c"] = 22.0
        maxima = calculate_pearl_suitability(sample, "pinctada_maxima")
        fucata = calculate_pearl_suitability(sample, "pinctada_fucata_martensii")
        self.assertNotEqual(maxima["parameter_scores"]["temperature_c"]["score"], fucata["parameter_scores"]["temperature_c"]["score"])

    def test_unknown_species_rejected(self):
        with self.assertRaises(ValueError):
            calculate_pearl_suitability(self.optimum(), "not_a_pinctada")


if __name__ == "__main__":
    unittest.main()
