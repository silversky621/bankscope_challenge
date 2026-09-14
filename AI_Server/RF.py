"""Train and evaluate the PoC on grouped synthetic data. Importing this module never trains."""
import argparse
import hashlib
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.dummy import DummyClassifier
from sklearn.tree import DecisionTreeClassifier
from sklearn.model_selection import GroupShuffleSplit, StratifiedGroupKFold, cross_validate
from sklearn.metrics import accuracy_score, f1_score, classification_report

from task_schema import FEATURE_COLUMNS, TASK_LEVELS, validate_task_frame

ROOT = Path(__file__).resolve().parent


def load_confirmed_db_data():
    import os
    import mysql.connector
    from dotenv import load_dotenv
    load_dotenv(ROOT / '.env')
    connection = mysql.connector.connect(host=os.getenv('DB_HOST', 'localhost'), user=os.getenv('DB_USER', 'root'),
                                        password=os.getenv('DB_PASSWORD', ''), database=os.getenv('DB_NAME', 'bank'))
    cursor = connection.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT task_id, user_id, feature_snapshot, confirmed_task_detail_type
            FROM task WHERE status = 'COMPLETED' AND confirmed_at IS NOT NULL AND confirmed_by IS NOT NULL
              AND feature_snapshot IS NOT NULL AND feature_snapshot_at <= created_at
              AND confirmed_at >= feature_snapshot_at AND ticket_number NOT LIKE 'DCG%'
        """)
        records = []
        for row in cursor.fetchall():
            snapshot = json.loads(row['feature_snapshot'])
            if snapshot.get('schema_version') != 1:
                raise ValueError(f"Unsupported snapshot schema on task {row['task_id']}")
            features = snapshot['features']
            records.append({**{c: features[c] for c in FEATURE_COLUMNS},
                            'task_detail_type': row['confirmed_task_detail_type'],
                            'profile_id': f"confirmed-app-user:{row['user_id']}", 'scenario_kind': 'confirmed_app'})
        if not records:
            return pd.DataFrame(columns=FEATURE_COLUMNS + ['task_detail_type', 'profile_id', 'scenario_kind'])
        result = pd.DataFrame(records)
        validate_task_frame(result)
        return result
    finally:
        cursor.close()
        connection.close()


def merge_equal_profile_groups(frame):
    """Keep exact profile matches together even if they came from different sources."""
    from prepare_datasets import profile_hash
    frame = frame.copy()
    parent = {g: g for g in frame.profile_id.unique()}
    def find(g):
        while parent[g] != g:
            parent[g] = parent[parent[g]]
            g = parent[g]
        return g
    seen = {}
    for _, row in frame.iterrows():
        key = profile_hash(row)
        if key in seen:
            a, b = find(row.profile_id), find(seen[key])
            parent[max(a, b)] = min(a, b)
        seen[key] = row.profile_id
    frame.profile_id = frame.profile_id.map(find)
    return frame


def grouped_split(frame):
    train, test = next(GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42).split(frame, groups=frame.profile_id))
    train_frame, test_frame = frame.iloc[train], frame.iloc[test]
    if set(train_frame.profile_id) & set(test_frame.profile_id):
        raise ValueError('Profile group leakage')
    train_values = set(map(tuple, train_frame[FEATURE_COLUMNS].to_numpy()))
    overlap = sum(tuple(row) in train_values for row in test_frame[FEATURE_COLUMNS].to_numpy())
    if overlap:
        raise ValueError(f'{overlap} test profiles also occur in training')
    if set(train_frame.task_detail_type) != set(TASK_LEVELS):
        raise ValueError('Training split does not cover every task')
    return train, test


def metrics(y, predicted):
    return {'accuracy': float(accuracy_score(y, predicted)),
            'macro_f1': float(f1_score(y, predicted, average='macro', zero_division=0)),
            'minimum_level_sufficient_rate': float(np.mean([TASK_LEVELS[p] >= TASK_LEVELS[a] for a, p in zip(y, predicted)]))}


def stress_evaluation(model, frame):
    cases = json.loads((ROOT / 'data/stress_scenarios.json').read_text(encoding='utf-8'))
    dataset_profiles = set(map(tuple, frame[FEATURE_COLUMNS].to_numpy()))
    result = []
    for case in cases:
        features = {c: 0 for c in FEATURE_COLUMNS}
        features['days_since_last_tx'] = 999
        features.update(case['features'])
        sample = pd.DataFrame([features])[FEATURE_COLUMNS]
        validate_task_frame(sample.assign(task_detail_type=case['actual_task']))
        if tuple(sample.iloc[0]) in dataset_profiles:
            raise ValueError(f"Stress case overlaps development data: {case['id']}")
        prediction = str(model.predict(sample)[0])
        probabilities = model.predict_proba(sample)[0]
        result.append({**case, 'prediction': prediction, 'max_vote_fraction': float(probabilities.max()),
                       'exact_match': prediction == case['actual_task'],
                       'minimum_level_sufficient': TASK_LEVELS[prediction] >= TASK_LEVELS[case['actual_task']]})
    return result


def train_model(include_confirmed_db=False, make_shap=True):
    source = ROOT / 'bank_data_1.csv'
    frame = pd.read_csv(source)
    validate_task_frame(frame)
    if 'profile_id' not in frame:
        raise ValueError('Run prepare_datasets.py first')
    confirmed_count = 0
    if include_confirmed_db:
        confirmed = load_confirmed_db_data()
        confirmed_count = len(confirmed)
        if confirmed_count:
            frame = pd.concat([frame, confirmed], ignore_index=True)
    frame = merge_equal_profile_groups(frame).drop_duplicates(FEATURE_COLUMNS + ['task_detail_type']).reset_index(drop=True)
    train, test = grouped_split(frame)
    x, y = frame[FEATURE_COLUMNS], frame.task_detail_type
    model = RandomForestClassifier(n_estimators=300, max_depth=12, min_samples_split=5,
                                   class_weight='balanced', random_state=42, n_jobs=-1)
    cv = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=42)
    scores = cross_validate(model, x.iloc[train], y.iloc[train], groups=frame.profile_id.iloc[train], cv=cv,
                            scoring={'accuracy': 'accuracy', 'macro_f1': 'f1_macro'}, n_jobs=1)
    model.fit(x.iloc[train], y.iloc[train])
    predicted = model.predict(x.iloc[test])
    report = {'evaluation_scope': 'Synthetic scenario evaluation; not measured real-customer performance.',
              'dataset_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
              'confirmed_app_rows_requested': confirmed_count,
              'rows': len(frame), 'train_rows': len(train), 'test_rows': len(test),
              'test_profile_overlap': 0, 'split': 'GroupShuffleSplit by profile lineage; seed=42',
              'cv_scope': '5-fold StratifiedGroupKFold on training partition only',
              'cv_accuracy_mean': float(scores['test_accuracy'].mean()),
              'cv_macro_f1_mean': float(scores['test_macro_f1'].mean()),
              'held_out': metrics(y.iloc[test], predicted),
              'classification_report': classification_report(y.iloc[test], predicted, output_dict=True, zero_division=0),
              'baselines': {}, 'stress_cases': stress_evaluation(model, frame),
              'limitations': ['Labels and scenario frequencies are developer assumptions.',
                              'Minimum-level sufficiency is a routing proxy, not observed task completion.',
                              'Tree vote fractions are not calibrated real-world confidence.',
                              'Staff transfer and queue benefits require separate workflow evaluation.']}
    for name, baseline in [('majority', DummyClassifier(strategy='most_frequent')),
                           ('shallow_tree_depth_5', DecisionTreeClassifier(max_depth=5, random_state=42))]:
        baseline.fit(x.iloc[train], y.iloc[train])
        report['baselines'][name] = metrics(y.iloc[test], baseline.predict(x.iloc[test]))
    output = ROOT / 'data/model_evaluation.json'
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    # Persist the evaluated training-partition model, so the reported holdout remains a holdout.
    # Test accuracy does not select or gate publication of a PoC model.
    joblib.dump(model, ROOT / 'bank_model.pkl')
    if make_shap:
        import shap
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
        sample = x.iloc[test].sample(min(128, len(test)), random_state=42)
        values = shap.TreeExplainer(model).shap_values(sample)
        importance = np.abs(values).mean(axis=2) if isinstance(values, np.ndarray) and values.ndim == 3 else np.abs(np.array(values)).mean(axis=0)
        shap.summary_plot(importance, sample, feature_names=FEATURE_COLUMNS, plot_type='bar', show=False)
        plt.title('Synthetic holdout: model feature contributions')
        plt.tight_layout()
        plt.savefig(ROOT / 'shap_summary_bar.png', dpi=150, bbox_inches='tight')
        plt.close()
    print(json.dumps({k: report[k] for k in ['rows', 'train_rows', 'test_rows', 'test_profile_overlap', 'cv_accuracy_mean', 'held_out', 'baselines']}, indent=2))
    print(f'Evaluation saved: {output}')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--include-confirmed-db', action='store_true', help='Include only completed, staff-confirmed reception snapshots')
    parser.add_argument('--skip-shap', action='store_true')
    args = parser.parse_args()
    train_model(args.include_confirmed_db, not args.skip_shap)
