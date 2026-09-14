"""Reproducible cleanup of the existing synthetic sources; no external data is used."""
from pathlib import Path
import hashlib
import json
import numpy as np
import pandas as pd
from task_schema import FEATURE_COLUMNS, RECENT_COLUMNS, CORPORATE_TASKS, validate_task_frame

ROOT = Path(__file__).resolve().parent
SEED = 20260914
VERSION = 'synthetic-v2'


def profile_hash(row, columns=FEATURE_COLUMNS):
    return hashlib.sha256(','.join(str(int(row[c])) for c in columns).encode()).hexdigest()[:24]


def clean_tasks(source):
    frame = source.copy()
    changes = {}
    def assign(mask, column, value, name):
        changes[name] = int(mask.sum())
        frame.loc[mask, column] = value
    assign(frame.account_count.eq(0) & frame.total_balance.ne(0), 'total_balance', 0, 'balance_without_account')
    assign(frame.account_count.eq(0), 'days_since_last_tx', 999, 'no_account_last_transaction')
    for column in RECENT_COLUMNS:
        assign(frame.days_since_last_tx.gt(30) & frame[column].gt(0), column, 0, column + '_outside_window')
    for near, owned in [('savings_near_maturity', 'has_savings_sub'), ('deposit_near_maturity', 'has_deposit_sub')]:
        assign(frame[near].eq(1) & frame[owned].eq(0), near, 0, near + '_without_product')
    assign(frame.has_upcoming_payment.eq(1) & frame.has_active_loan.eq(0) & frame.has_overdue_loan.eq(0),
           'has_upcoming_payment', 0, 'payment_without_loan')
    assign(frame.is_corporate.eq(0) & frame.default_risk_level.ne(0), 'default_risk_level', 0, 'noncorporate_risk')
    assign(frame.is_corporate.eq(0) & frame.has_business_id.ne(0), 'has_business_id', 0, 'noncorporate_business_flag')
    impossible = frame.is_corporate.eq(0) & frame.task_detail_type.isin(CORPORATE_TASKS)
    changes['excluded_incompatible_labels'] = int(impossible.sum())
    frame = frame.loc[~impossible].drop_duplicates(FEATURE_COLUMNS + ['task_detail_type']).copy()
    changes['deduplicated_rows'] = len(source) - int(impossible.sum()) - len(frame)
    frame['profile_id'] = frame.apply(profile_hash, axis=1)
    frame['scenario_kind'] = 'original_cleaned'
    return frame, changes


def add_scenarios(frame):
    rng = np.random.default_rng(SEED)
    variants = []
    for _, group in frame.groupby('task_detail_type', sort=True):
        for idx in rng.choice(group.index, size=min(20, len(group)), replace=False):
            row = frame.loc[idx].copy()
            # A competing card cue must not imply that today's purpose is card collection.
            mixed = row.copy()
            mixed['has_issuing_card'] = 1
            mixed['scenario_kind'] = 'competing_card_signal'
            variants.append(mixed)
            # Same financial state, another plausible visit. These variants stay in one split.
            alternate = row.copy()
            if row.account_count > 0:
                choices = [task for task in ['입금', '출금', '이체'] if task != row.task_detail_type]
            else:
                choices = ['법인계좌 개설'] if row.is_corporate else ['입출금 계좌개설', '금융상품가입']
            alternate['task_detail_type'] = str(rng.choice(choices))
            alternate['scenario_kind'] = 'alternative_visit_purpose'
            variants.append(alternate)
    result = pd.concat([frame, pd.DataFrame(variants)], ignore_index=True)
    result = result.drop_duplicates(FEATURE_COLUMNS + ['task_detail_type']).reset_index(drop=True)
    # Union lineage groups when normalization or augmentation produces the same profile.
    parent = {g: g for g in result.profile_id.unique()}
    def find(g):
        while parent[g] != g:
            parent[g] = parent[parent[g]]
            g = parent[g]
        return g
    seen = {}
    for _, row in result.iterrows():
        key = profile_hash(row)
        if key in seen:
            a, b = find(row.profile_id), find(seen[key])
            parent[max(a, b)] = min(a, b)
        seen[key] = row.profile_id
    result.profile_id = result.profile_id.map(find)
    validate_task_frame(result)
    return result


def clean_products(frame):
    # Constraints reflect the existing demo product IDs and configured age bounds, not financial advice.
    corp_only = [99, 103, 108]
    individual_only = [97, 98, 100, 101, 102, 104, 105, 106, 109]
    valid = (~frame.product_id.isin(corp_only) | frame.is_corporate.eq(1))
    valid &= (~frame.product_id.isin(individual_only) | frame.is_corporate.eq(0))
    valid &= (~frame.product_id.eq(98) | frame.age.ge(55))
    valid &= (~frame.product_id.eq(101) | frame.age.le(34))
    columns = ['age', 'is_corporate', 'total_balance', 'has_active_loan', 'recent_tx_count']
    if frame[columns].isna().any().any() or (frame[columns] < 0).any().any():
        raise ValueError('Invalid product profile')
    result = frame.loc[valid].drop_duplicates().copy()
    result['profile_id'] = result.apply(lambda row: profile_hash(row, columns), axis=1)
    return result, {'excluded_ineligible_rows': int((~valid).sum()), 'deduplicated_rows': int(valid.sum()) - len(result)}


def prepare():
    manifest = {'version': VERSION, 'seed': SEED, 'provenance': 'Existing developer-authored synthetic CSVs; original generator unavailable.',
                'external_datasets': [], 'representative_of_real_customers': False, 'datasets': {}}
    for n in (1, 2):
        source = ROOT / 'data' / 'source' / f'bank_data_{n}_original.csv'
        frame = pd.read_csv(source)
        cleaned, changes = clean_tasks(frame) if n == 1 else clean_products(frame)
        if n == 1:
            cleaned = add_scenarios(cleaned)
        output = ROOT / f'bank_data_{n}.csv'
        cleaned.to_csv(output, index=False, lineterminator='\n')
        label = 'task_detail_type' if n == 1 else 'target_product'
        manifest['datasets'][output.name] = {
            'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
            'output_sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
            'source_rows': len(frame), 'rows': len(cleaned), 'changes': changes,
            'labels': cleaned[label].value_counts().sort_index().to_dict(),
            'scenario_counts': cleaned.scenario_kind.value_counts().to_dict() if n == 1 else {},
        }
    (ROOT / 'data' / 'dataset_manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    prepare()
