"""Shared schema for synthetic preparation, evaluation and reception snapshots."""

FEATURE_COLUMNS = [
    'age', 'is_corporate', 'gender', 'total_balance', 'account_count',
    'has_active_loan', 'has_overdue_loan', 'has_upcoming_payment',
    'has_issuing_card', 'has_check_card', 'has_credit_card',
    'has_deposit_sub', 'has_savings_sub', 'default_risk_level',
    'recent_deposit_count', 'recent_withdrawal_count', 'recent_transfer_count',
    'days_since_last_tx', 'max_password_fail_count', 'has_business_id',
    'savings_near_maturity', 'deposit_near_maturity',
]

TASK_LEVELS = {
    '입금': 1, '출금': 1, '카드수령': 1, '이체': 2, '체크카드 발급': 2,
    '통장 비밀번호 변경': 2, '입출금 계좌개설': 2, '적금': 2, '신용카드 발급': 2,
    '대출 상환': 2, '예금': 3, '신용대출': 3, '전세자금대출': 3, '금융상품가입': 3,
    '소상공인 대출': 4, '연금신청': 4, '주택담보대출': 4, '법인카드 발급': 3,
    '법인계좌 개설': 4, '기업대출': 4, '연체관리': 4, '부도관리': 5,
}
CORPORATE_TASKS = {'법인카드 발급', '법인계좌 개설', '기업대출', '부도관리'}
RECENT_COLUMNS = ['recent_deposit_count', 'recent_withdrawal_count', 'recent_transfer_count']
BOOLEAN_COLUMNS = [c for c in FEATURE_COLUMNS if c.startswith('has_')] + [
    'is_corporate', 'gender', 'savings_near_maturity', 'deposit_near_maturity']


def validate_task_frame(frame):
    """Raise on invalid inputs; label plausibility is a separate, documented assumption."""
    import numpy as np
    values = frame[FEATURE_COLUMNS]
    if values.isna().any().any() or not np.isfinite(values.to_numpy(dtype=float)).all():
        raise ValueError('Features must be present and finite')
    if (values < 0).any().any() or (values % 1 != 0).any().any():
        raise ValueError('Features must be nonnegative integers')
    if not values[BOOLEAN_COLUMNS].isin([0, 1]).all().all():
        raise ValueError('Boolean feature outside 0/1')
    if (values.age > 110).any() or (values.default_risk_level > 3).any():
        raise ValueError('Age or corporate risk outside schema')
    if ((frame.account_count == 0) & (frame.total_balance != 0)).any():
        raise ValueError('Balance without an account')
    if ((frame.days_since_last_tx > 30) & (frame[RECENT_COLUMNS].sum(axis=1) > 0)).any():
        raise ValueError('Recent transactions conflict with last transaction date')
    for near, owned in [('savings_near_maturity', 'has_savings_sub'), ('deposit_near_maturity', 'has_deposit_sub')]:
        if ((frame[near] == 1) & (frame[owned] == 0)).any():
            raise ValueError('Maturity flag without a corresponding product')
    if ((frame.has_upcoming_payment == 1) & (frame.has_active_loan == 0) & (frame.has_overdue_loan == 0)).any():
        raise ValueError('Payment schedule without a loan')
    if 'task_detail_type' in frame:
        if not frame.task_detail_type.isin(TASK_LEVELS).all():
            raise ValueError('Unknown task label')
        if ((frame.is_corporate == 0) & frame.task_detail_type.isin(CORPORATE_TASKS)).any():
            raise ValueError('Corporate-only task labelled as an individual')
