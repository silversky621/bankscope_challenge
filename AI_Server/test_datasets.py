import hashlib
import json
import unittest
from pathlib import Path
import pandas as pd
from sklearn.model_selection import StratifiedGroupKFold
from prepare_datasets import ROOT, clean_tasks, add_scenarios, clean_products
from task_schema import FEATURE_COLUMNS, TASK_LEVELS, validate_task_frame
from RF import grouped_split, merge_equal_profile_groups, metrics


class DatasetTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.frame = pd.read_csv(ROOT / 'bank_data_1.csv')

    def test_current_data_are_valid_and_cover_all_tasks(self):
        validate_task_frame(self.frame)
        self.assertEqual(set(self.frame.task_detail_type), set(TASK_LEVELS))
        self.assertEqual(self.frame.duplicated(FEATURE_COLUMNS + ['task_detail_type']).sum(), 0)

    def test_preparation_reproduces_checked_in_outputs(self):
        cleaned, _ = clean_tasks(pd.read_csv(ROOT / 'data/source/bank_data_1_original.csv'))
        pd.testing.assert_frame_equal(add_scenarios(cleaned), self.frame, check_dtype=False)
        products, _ = clean_products(pd.read_csv(ROOT / 'data/source/bank_data_2_original.csv'))
        pd.testing.assert_frame_equal(products.reset_index(drop=True), pd.read_csv(ROOT / 'bank_data_2.csv'), check_dtype=False)

    def test_ambiguous_labels_stay_together_in_holdout_and_cv(self):
        train, test = grouped_split(self.frame)
        a, b = self.frame.iloc[train], self.frame.iloc[test]
        self.assertFalse(set(a.profile_id) & set(b.profile_id))
        self.assertFalse(set(map(tuple, a[FEATURE_COLUMNS].to_numpy())) & set(map(tuple, b[FEATURE_COLUMNS].to_numpy())))
        for left, right in StratifiedGroupKFold(5, shuffle=True, random_state=42).split(a, a.task_detail_type, a.profile_id):
            self.assertFalse(set(a.iloc[left].profile_id) & set(a.iloc[right].profile_id))
            self.assertFalse(set(a.iloc[right].profile_id) & set(b.profile_id))

    def test_equal_profiles_from_different_sources_are_joined(self):
        frame = pd.concat([self.frame.iloc[:1], self.frame.iloc[:1]], ignore_index=True)
        frame.loc[1, 'profile_id'] = 'confirmed-app-user:123'
        self.assertEqual(merge_equal_profile_groups(frame).profile_id.nunique(), 1)

    def test_manifest_identifies_sources_and_generated_files(self):
        manifest = json.loads((ROOT / 'data/dataset_manifest.json').read_text(encoding='utf8'))
        self.assertFalse(manifest['representative_of_real_customers'])
        self.assertEqual(manifest['external_datasets'], [])
        for name, data in manifest['datasets'].items():
            self.assertEqual(hashlib.sha256((ROOT / name).read_bytes()).hexdigest(), data['output_sha256'])
            source = ROOT / 'data/source' / name.replace('.csv', '_original.csv')
            self.assertEqual(hashlib.sha256(source.read_bytes()).hexdigest(), data['source_sha256'])

    def test_stress_cases_are_valid_and_not_in_development_data(self):
        cases = json.loads((ROOT / 'data/stress_scenarios.json').read_text(encoding='utf8'))
        profiles = set(map(tuple, self.frame[FEATURE_COLUMNS].to_numpy()))
        for case in cases:
            features = dict.fromkeys(FEATURE_COLUMNS, 0)
            features['days_since_last_tx'] = 999
            features.update(case['features'])
            sample = pd.DataFrame([features])[FEATURE_COLUMNS]
            validate_task_frame(sample.assign(task_detail_type=case['actual_task']))
            self.assertNotIn(tuple(sample.iloc[0]), profiles, case['id'])

    def test_impossible_profiles_fail_validation(self):
        sample = self.frame.iloc[:1].copy()
        sample['account_count'] = 0
        sample['total_balance'] = 100
        with self.assertRaisesRegex(ValueError, 'Balance without'):
            validate_task_frame(sample)

    def test_macro_f1_is_not_accuracy_or_binary_f1(self):
        result = metrics(['입금', '출금', '출금'], ['입금', '입금', '출금'])
        self.assertAlmostEqual(result['macro_f1'], 2 / 3)


if __name__ == '__main__':
    unittest.main()
