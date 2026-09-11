import os
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import accuracy_score, classification_report
import joblib
import shap
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import mysql.connector
from dotenv import load_dotenv

load_dotenv()

# main.py 의 TASK_FEATURE_COLUMNS 와 동일한 순서 유지 (어긋나면 추론 시 예측이 틀어짐)
FEATURE_COLUMNS = [
    'age', 'is_corporate', 'gender', 'total_balance', 'account_count',
    'has_active_loan', 'has_overdue_loan', 'has_upcoming_payment',
    'has_issuing_card', 'has_check_card', 'has_credit_card',
    'has_deposit_sub', 'has_savings_sub', 'default_risk_level',
    'recent_deposit_count', 'recent_withdrawal_count', 'recent_transfer_count',
    'days_since_last_tx', 'max_password_fail_count', 'has_business_id',
    'savings_near_maturity', 'deposit_near_maturity',
]

# DB에서 가져올 수 있는 유효한 세부업무 라벨 (이 목록에 없으면 쓰레기 데이터로 간주)
VALID_LABELS = {
    '입금', '출금', '카드수령', '이체', '체크카드 발급', '통장 비밀번호 변경',
    '입출금 계좌개설', '적금', '신용카드 발급', '대출 상환', '예금', '신용대출',
    '전세자금대출', '금융상품가입', '법인카드 발급', '소상공인 대출', '연금신청',
    '주택담보대출', '법인계좌 개설', '기업대출', '연체관리', '부도관리',
}

def load_db_task_data() -> pd.DataFrame | None:
    """
    task 테이블의 COMPLETED 업무를 기준으로 실제 고객 피처를 추출한다.
    유효하지 않은 라벨이나 데이터가 MIN_DB_ROWS 미만이면 None을 반환한다.
    """
    try:
        conn = mysql.connector.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            user=os.getenv('DB_USER', 'root'),
            password=os.getenv('DB_PASSWORD', ''),
            database=os.getenv('DB_NAME', 'bank'),
        )
        cursor = conn.cursor(dictionary=True)

        # COMPLETED 상태 + 유효 라벨인 task만 대상 (동일 고객의 중복 라벨도 포함)
        # DCG* ticket은 관리자 혼잡도 UI 확인용 이력이라 모델 학습에서는 제외한다.
        placeholders = ','.join(['%s'] * len(VALID_LABELS))
        cursor.execute(
            f"SELECT user_id, task_detail_type FROM task "
            f"WHERE status = 'COMPLETED' "
            f"AND task_detail_type IN ({placeholders}) "
            f"AND ticket_number NOT LIKE 'DCG%'",
            list(VALID_LABELS),
        )
        tasks = cursor.fetchall()

        if len(tasks) == 0:
            print("   [SKIP] DB에 유효한 COMPLETED task 없음, CSV만 사용")
            cursor.close()
            conn.close()
            return None

        print(f"   [OK] DB에서 유효 task {len(tasks)}건 발견, 피처 추출 중...")

        rows = []
        for task in tasks:
            user_id = task['user_id']
            label = task['task_detail_type']

            cursor.execute("""
                SELECT
                    u.age, u.user_type, u.gender, u.identification_number,
                    COALESCE((SELECT SUM(a.balance) FROM account a WHERE a.user_id = u.id), 0)
                        AS total_balance,
                    COALESCE((SELECT COUNT(*) FROM account a WHERE a.user_id = u.id), 0)
                        AS account_count,
                    CASE WHEN EXISTS (SELECT 1 FROM loan l WHERE l.user_id = u.id AND l.status = 'ACTIVE')
                        THEN 1 ELSE 0 END AS has_active_loan,
                    CASE WHEN EXISTS (SELECT 1 FROM loan l WHERE l.user_id = u.id AND l.status = 'OVERDUE')
                        THEN 1 ELSE 0 END AS has_overdue_loan,
                    CASE WHEN EXISTS (
                        SELECT 1 FROM loan_schedule ls
                        JOIN loan l ON ls.loan_id = l.loan_id
                        WHERE l.user_id = u.id
                          AND ls.due_date BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 7 DAY)
                          AND ls.status = 'SCHEDULED'
                    ) THEN 1 ELSE 0 END AS has_upcoming_payment,
                    CASE WHEN EXISTS (SELECT 1 FROM card c WHERE c.user_id = u.id AND c.status = 'ISSUING')
                        THEN 1 ELSE 0 END AS has_issuing_card,
                    CASE WHEN EXISTS (
                        SELECT 1 FROM card c WHERE c.user_id = u.id AND c.card_type = 'CHECK' AND c.status = 'ACTIVE'
                    ) THEN 1 ELSE 0 END AS has_check_card,
                    CASE WHEN EXISTS (
                        SELECT 1 FROM card c WHERE c.user_id = u.id AND c.card_type = 'CREDIT' AND c.status = 'ACTIVE'
                    ) THEN 1 ELSE 0 END AS has_credit_card,
                    CASE WHEN EXISTS (
                        SELECT 1 FROM product_subscription ps
                        JOIN financial_product fp ON ps.product_id = fp.product_id
                        WHERE ps.user_id = u.id AND ps.status = 'ACTIVE' AND fp.product_category = 'DEPOSIT'
                    ) THEN 1 ELSE 0 END AS has_deposit_sub,
                    CASE WHEN EXISTS (
                        SELECT 1 FROM product_subscription ps
                        JOIN financial_product fp ON ps.product_id = fp.product_id
                        WHERE ps.user_id = u.id AND ps.status = 'ACTIVE' AND fp.product_category = 'SAVINGS'
                    ) THEN 1 ELSE 0 END AS has_savings_sub,
                    COALESCE((
                        SELECT CASE cm.risk_grade
                            WHEN '저위험' THEN 1 WHEN '중위험' THEN 2 WHEN '고위험' THEN 3
                            ELSE 0 END
                        FROM corporate_management cm WHERE cm.user_id = u.id LIMIT 1
                    ), 0) AS default_risk_level,
                    COALESCE((
                        SELECT COUNT(*) FROM transaction_history th
                        JOIN account a ON th.account_id = a.account_id
                        WHERE a.user_id = u.id AND th.transaction_type = 'DEPOSIT'
                          AND th.created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)
                    ), 0) AS recent_deposit_count,
                    COALESCE((
                        SELECT COUNT(*) FROM transaction_history th
                        JOIN account a ON th.account_id = a.account_id
                        WHERE a.user_id = u.id AND th.transaction_type IN ('WITHDRAW', 'WITHDRAWAL')
                          AND th.created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)
                    ), 0) AS recent_withdrawal_count,
                    COALESCE((
                        SELECT COUNT(*) FROM transaction_history th
                        JOIN account a ON th.account_id = a.account_id
                        WHERE a.user_id = u.id AND th.transaction_type IN ('TRANSFER', 'TRANSFER_OUT', 'TRANSFER_IN')
                          AND th.created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)
                    ), 0) AS recent_transfer_count,
                    COALESCE((
                        SELECT DATEDIFF(NOW(), MAX(th.created_at)) FROM transaction_history th
                        JOIN account a ON th.account_id = a.account_id WHERE a.user_id = u.id
                    ), 999) AS days_since_last_tx,
                    COALESCE((
                        SELECT MAX(a.password_fail_count) FROM account a WHERE a.user_id = u.id
                    ), 0) AS max_password_fail_count,
                    CASE WHEN EXISTS (
                        SELECT 1 FROM savings_account sa
                        JOIN account a ON sa.account_id = a.account_id
                        WHERE a.user_id = u.id
                          AND sa.maturity_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 90 DAY)
                    ) THEN 1 ELSE 0 END AS savings_near_maturity,
                    CASE WHEN EXISTS (
                        SELECT 1 FROM deposit_account da
                        JOIN account a ON da.account_id = a.account_id
                        WHERE a.user_id = u.id
                          AND a.maturity_date BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 90 DAY)
                    ) THEN 1 ELSE 0 END AS deposit_near_maturity
                FROM user u WHERE u.id = %s
            """, (user_id,))
            row = cursor.fetchone()
            if not row:
                continue

            age_str = str(row['age']).replace('대', '').replace('세', '').strip()
            user_type_str = str(row['user_type']).upper() if row['user_type'] else ''
            is_corporate = 1 if user_type_str in ('CORPORATE', '기업', '법인', 'BUSINESS') else 0
            gender_str = str(row['gender']).upper() if row['gender'] else ''

            rows.append({
                'age':                     int(age_str) if age_str.isdigit() else 30,
                'is_corporate':            is_corporate,
                'gender':                  1 if gender_str == 'MALE' else 0,
                'total_balance':           int(row['total_balance']),
                'account_count':           int(row['account_count']),
                'has_active_loan':         int(row['has_active_loan']),
                'has_overdue_loan':        int(row['has_overdue_loan']),
                'has_upcoming_payment':    int(row['has_upcoming_payment']),
                'has_issuing_card':        int(row['has_issuing_card']),
                'has_check_card':          int(row['has_check_card']),
                'has_credit_card':         int(row['has_credit_card']),
                'has_deposit_sub':         int(row['has_deposit_sub']),
                'has_savings_sub':         int(row['has_savings_sub']),
                'default_risk_level':      int(row['default_risk_level']),
                'recent_deposit_count':    int(row['recent_deposit_count']),
                'recent_withdrawal_count': int(row['recent_withdrawal_count']),
                'recent_transfer_count':   int(row['recent_transfer_count']),
                'days_since_last_tx':      int(row['days_since_last_tx']),
                'max_password_fail_count': int(row['max_password_fail_count']),
                'has_business_id':         1 if (is_corporate == 1 and row['identification_number']) else 0,
                'savings_near_maturity':   int(row['savings_near_maturity']),
                'deposit_near_maturity':   int(row['deposit_near_maturity']),
                'task_detail_type':        label,
            })

        cursor.close()
        conn.close()

        if not rows:
            print("   [SKIP] 피처 추출 가능한 유효 행 없음")
            return None

        result_df = pd.DataFrame(rows)
        print(f"   [OK] 최종 {len(result_df)}건 추출 완료")
        return result_df

    except Exception as e:
        print(f"   [WARN] DB 연결/조회 실패, CSV만 사용: {e}")
        return None


# ── 1. 학습 데이터 로드 ───────────────────────────────────────────────────────

print("1. 학습 데이터 로드 중...")
base_df = pd.read_csv('bank_data_1.csv')
print(f"   CSV: {len(base_df)}건")

print("   DB 실제 task 데이터 병합 시도 중...")
real_df = load_db_task_data()

if real_df is not None:
    df = pd.concat([base_df, real_df], ignore_index=True)
    df = df.sample(frac=1, random_state=42).reset_index(drop=True)
    print(f"   병합 후 총 {len(df)}건 (CSV {len(base_df)} + DB {len(real_df)})")
else:
    df = base_df

print(f"\n   클래스 수: {df['task_detail_type'].nunique()}")
print(f"\n[클래스 분포]")
print(df['task_detail_type'].value_counts().to_string())

# ── 2. 학습 ──────────────────────────────────────────────────────────────────

X = df[FEATURE_COLUMNS]
y = df['task_detail_type']

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

print("\n2. 랜덤 포레스트 모델 학습 중...")
model = RandomForestClassifier(
    n_estimators=300,
    max_depth=12,
    min_samples_split=5,
    class_weight='balanced',
    random_state=42,
    n_jobs=-1,
)
model.fit(X_train, y_train)

print("\n3. 5-Fold 교차 검증 수행 중...")
cv_scores = cross_val_score(model, X, y, cv=5, scoring='accuracy', n_jobs=-1)
print(f"   CV 평균 정확도: {cv_scores.mean() * 100:.2f}% ± {cv_scores.std() * 100:.2f}%")

print("\n4. 모델 평가 (테스트 데이터셋)")
y_pred = model.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)

print(f"\n[결과] 최종 모델 정확도: {accuracy * 100:.2f}%")
print("\n[상세 분류 리포트]")
print(classification_report(y_test, y_pred))

print("\n[피처 중요도 (상위 10개)]")
importances = sorted(zip(FEATURE_COLUMNS, model.feature_importances_), key=lambda x: -x[1])
for feat, imp in importances[:10]:
    print(f"  {feat}: {imp:.4f}")

if accuracy >= 0.80:
    joblib.dump(model, 'bank_model.pkl')
    print(f"\n[OK] 목표 달성 ({accuracy * 100:.2f}% >= 80%)! 'bank_model.pkl' 저장 완료!")
else:
    print(f"\n[WARN] 정확도 {accuracy * 100:.2f}%가 80% 미만이므로 모델을 저장하지 않습니다.")

# ── SHAP 분석 ────────────────────────────────────────────────────────────────

print("\n5. SHAP 분석 중... (수십 초 소요)")
plt.rcParams['font.family'] = 'DejaVu Sans'
plt.rcParams['axes.unicode_minus'] = True

explainer = shap.TreeExplainer(model)
# 테스트셋 전체로 SHAP 계산 (shape: n_samples × n_features × n_classes)
shap_values = explainer.shap_values(X_test)
is_3d = isinstance(shap_values, np.ndarray) and shap_values.ndim == 3

# 전체 피처 중요도 요약 (모든 클래스 평균 |SHAP|)
shap_abs = np.abs(shap_values).mean(axis=2) if is_3d else np.abs(np.array(shap_values)).mean(axis=0)
shap.summary_plot(
    shap_abs, X_test,
    feature_names=FEATURE_COLUMNS,
    plot_type='bar',
    show=False,
)
plt.title('SHAP Feature Importance (mean |SHAP| across all classes)', fontsize=10)
plt.tight_layout()
plt.savefig('shap_summary_bar.png', dpi=150, bbox_inches='tight')
plt.close()
print("   [OK] 'shap_summary_bar.png' 저장 완료!")
print("   (개별 고객 예측 근거는 서버 실행 후 GET /py/explain/{user_id} 로 확인)")
print("\n[완료] SHAP 분석 종료")
