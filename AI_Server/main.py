import os
import base64
import contextlib
import joblib
from datetime import datetime

import numpy as np
import pandas as pd
import shap
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel
import mysql.connector
from mysql.connector import pooling
from mysql.connector.errors import Error
from fastapi.middleware.cors import CORSMiddleware
import redis
import chatbot_service
from recommender import ProductRecommender

load_dotenv()

app = FastAPI(title="BankScope AI API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

try:
    redis_client = redis.Redis(
        host=os.getenv('REDIS_HOST', 'localhost'),
        port=int(os.getenv('REDIS_PORT', 6379)),
        decode_responses=True
    )
    redis_client.ping()
    print("[OK] Redis 연결 성공")
except Exception as e:
    print(f"[WARN] Redis 연결 실패: {e}")
    redis_client = None

try:
    model = joblib.load('bank_model.pkl')
except FileNotFoundError:
    print("[WARN] 모델 파일(bank_model.pkl)을 찾을 수 없습니다. 먼저 train_model.py를 실행하세요.")
    model = None

# RF.py 의 FEATURE_COLUMNS 와 동일한 순서 유지 (어긋나면 예측이 틀어짐)
TASK_FEATURE_COLUMNS = [
    'age', 'is_corporate', 'gender', 'total_balance', 'account_count',
    'has_active_loan', 'has_overdue_loan', 'has_upcoming_payment',
    'has_issuing_card', 'has_check_card', 'has_credit_card',
    'has_deposit_sub', 'has_savings_sub', 'default_risk_level',
    'recent_deposit_count', 'recent_withdrawal_count', 'recent_transfer_count',
    'days_since_last_tx', 'max_password_fail_count', 'has_business_id',
    'savings_near_maturity', 'deposit_near_maturity',
]

FEATURE_DISPLAY_META = {
    'age': {
        'label': '연령',
        'message': '연령 정보가 업무 유형 예측에 반영됐습니다.',
    },
    'is_corporate': {
        'label': '고객 유형',
        'message': '개인/법인 고객 구분이 업무 유형 예측에 반영됐습니다.',
    },
    'gender': {
        'label': '성별',
        'message': '성별 정보가 업무 유형 예측에 반영됐습니다.',
    },
    'total_balance': {
        'label': '총 예치 잔액',
        'message': '총 예치 잔액 규모가 AI 업무 예측에 크게 반영됐습니다.',
    },
    'account_count': {
        'label': '보유 계좌 수',
        'message': '보유 계좌 수가 고객의 업무 패턴 판단에 반영됐습니다.',
    },
    'has_active_loan': {
        'label': '활성 대출 보유',
        'message': '활성 대출 보유 여부가 대출 또는 상환 상담 판단에 반영됐습니다.',
    },
    'has_overdue_loan': {
        'label': '연체 대출 여부',
        'message': '연체 대출 여부가 연체 관리 상담 필요성 판단에 반영됐습니다.',
    },
    'has_upcoming_payment': {
        'label': '7일 내 상환 예정',
        'message': '가까운 상환 일정 여부가 대출 상환 상담 판단에 반영됐습니다.',
    },
    'has_issuing_card': {
        'label': '발급 대기 카드',
        'message': '발급 대기 카드 여부가 카드 수령 또는 발급 상담 판단에 반영됐습니다.',
    },
    'has_check_card': {
        'label': '체크카드 보유',
        'message': '체크카드 보유 여부가 카드·계좌 연계 상담 판단에 반영됐습니다.',
    },
    'has_credit_card': {
        'label': '신용카드 보유',
        'message': '신용카드 보유 여부가 카드 상담 판단에 반영됐습니다.',
    },
    'has_deposit_sub': {
        'label': '예금 상품 보유',
        'message': '예금 상품 보유 여부가 예금 상담 판단에 반영됐습니다.',
    },
    'has_savings_sub': {
        'label': '적금 상품 보유',
        'message': '적금 상품 보유 여부가 적금 상담 판단에 반영됐습니다.',
    },
    'default_risk_level': {
        'label': '법인 리스크 등급',
        'message': '법인 리스크 등급이 기업 상담 또는 관리 업무 판단에 반영됐습니다.',
    },
    'recent_deposit_count': {
        'label': '최근 입금 횟수',
        'message': '최근 입금 거래 빈도가 고객 업무 예측에 반영됐습니다.',
    },
    'recent_withdrawal_count': {
        'label': '최근 출금 횟수',
        'message': '최근 출금 거래 빈도가 고객 업무 예측에 반영됐습니다.',
    },
    'recent_transfer_count': {
        'label': '최근 이체 횟수',
        'message': '최근 이체 거래 빈도가 고객 업무 예측에 반영됐습니다.',
    },
    'days_since_last_tx': {
        'label': '최근 거래 경과일',
        'message': '최근 거래 시점이 고객 업무 예측에 반영됐습니다.',
    },
    'max_password_fail_count': {
        'label': '비밀번호 오류 횟수',
        'message': '계좌 비밀번호 오류 이력이 보안성 업무 판단에 반영됐습니다.',
    },
    'has_business_id': {
        'label': '사업자번호 등록',
        'message': '사업자번호 등록 여부가 법인 고객 업무 판단에 반영됐습니다.',
    },
    'savings_near_maturity': {
        'label': '만기 임박 적금',
        'message': '만기 임박 적금 여부가 재예치 또는 상품 상담 판단에 반영됐습니다.',
    },
    'deposit_near_maturity': {
        'label': '만기 임박 예금',
        'message': '만기 임박 예금 여부가 재예치 또는 상품 상담 판단에 반영됐습니다.',
    },
}

missing_feature_meta = set(TASK_FEATURE_COLUMNS) - set(FEATURE_DISPLAY_META)
extra_feature_meta = set(FEATURE_DISPLAY_META) - set(TASK_FEATURE_COLUMNS)
if missing_feature_meta or extra_feature_meta:
    raise RuntimeError(
        f"FEATURE_DISPLAY_META mismatch. missing={sorted(missing_feature_meta)}, "
        f"extra={sorted(extra_feature_meta)}"
    )

DETAIL_TYPE_META = {
    # 빠른 업무 (A)
    '입금':             {'task_type': '빠른 업무', 'prefix': 'A', 'processing_time': 5},
    '출금':             {'task_type': '빠른 업무', 'prefix': 'A', 'processing_time': 5},
    '카드수령':          {'task_type': '빠른 업무', 'prefix': 'A', 'processing_time': 5},
    '이체':             {'task_type': '빠른 업무', 'prefix': 'A', 'processing_time': 5},
    '체크카드 발급':     {'task_type': '빠른 업무', 'prefix': 'A', 'processing_time': 5},
    '통장 비밀번호 변경': {'task_type': '빠른 업무', 'prefix': 'A', 'processing_time': 5},
    '입출금 계좌개설':   {'task_type': '빠른 업무', 'prefix': 'A', 'processing_time': 5},
    # 상담 업무 (B)
    '적금':             {'task_type': '상담 업무', 'prefix': 'B', 'processing_time': 10},
    '신용카드 발급':     {'task_type': '상담 업무', 'prefix': 'B', 'processing_time': 10},
    '대출 상환':         {'task_type': '상담 업무', 'prefix': 'B', 'processing_time': 10},
    '예금':             {'task_type': '상담 업무', 'prefix': 'B', 'processing_time': 10},
    '신용대출':          {'task_type': '상담 업무', 'prefix': 'B', 'processing_time': 10},
    '전세자금대출':      {'task_type': '상담 업무', 'prefix': 'B', 'processing_time': 10},
    '금융상품가입':      {'task_type': '상담 업무', 'prefix': 'B', 'processing_time': 10},
    '소상공인 대출':     {'task_type': '상담 업무', 'prefix': 'B', 'processing_time': 10},
    '연금신청':          {'task_type': '상담 업무', 'prefix': 'B', 'processing_time': 10},
    '주택담보대출':      {'task_type': '상담 업무', 'prefix': 'B', 'processing_time': 10},
    # 기업·특수 (C)
    '법인카드 발급':     {'task_type': '기업 • 특수', 'prefix': 'C', 'processing_time': 25},
    '법인계좌 개설':     {'task_type': '기업 • 특수', 'prefix': 'C', 'processing_time': 25},
    '기업대출':          {'task_type': '기업 • 특수', 'prefix': 'C', 'processing_time': 25},
    '연체관리':          {'task_type': '기업 • 특수', 'prefix': 'C', 'processing_time': 25},
    '부도관리':          {'task_type': '기업 • 특수', 'prefix': 'C', 'processing_time': 25},
}

POOL_CONFIG = {
    'host':     os.getenv('DB_HOST', 'localhost'),
    'user':     os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', ''),
    'database': os.getenv('DB_NAME', 'bank'),
}

try:
    connection_pool = pooling.MySQLConnectionPool(
        pool_name="bank_pool",
        pool_size=5,
        pool_reset_session=True,
        **POOL_CONFIG
    )
except Error as e:
    print(f"[WARN] DB 연결 풀 초기화 실패: {e}")
    connection_pool = None

@contextlib.contextmanager
def get_db_cursor():
    if connection_pool is None:
        raise RuntimeError("DB 연결 풀이 초기화되지 않았습니다.")
    conn = connection_pool.get_connection()
    conn.autocommit = False
    cursor = conn.cursor(dictionary=True)
    try:
        yield conn, cursor
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


try:
    base_df = pd.read_csv('bank_data_2.csv')
    try:
        with get_db_cursor() as (conn, cursor):
            # CSV에 product_id 컬럼이 직접 포함되어 있으므로 그대로 사용
            base_df['target_product'] = base_df['product_id'].astype(int)

            cursor.execute("""
                SELECT
                    u.age,
                    u.user_type,
                    COALESCE((SELECT SUM(balance) FROM account WHERE user_id = u.id), 0) AS total_balance,
                    CASE WHEN EXISTS (SELECT 1 FROM loan WHERE user_id = u.id AND status = 'ACTIVE')
                    THEN 1 ELSE 0 END AS has_active_loan,
                    (
                        SELECT COUNT(*) FROM transaction_history th
                        JOIN account a ON th.account_id = a.account_id
                        WHERE a.user_id = u.id
                          AND th.created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)
                    ) AS recent_tx_count,
                    fp.product_id AS target_product
                FROM user u
                JOIN product_subscription ps ON u.id = ps.user_id AND ps.status = 'ACTIVE'
                JOIN financial_product fp ON ps.product_id = fp.product_id
            """)
            real_rows = cursor.fetchall()

        if real_rows:
            real_df = pd.DataFrame(real_rows)
            real_df['is_corporate'] = real_df['user_type'].str.upper().isin(
                ['CORPORATE', '기업', '법인', 'BUSINESS']
            ).astype(int)
            real_df = real_df.drop(columns=['user_type'])
            real_df['age'] = (
                real_df['age'].astype(str)
                .str.replace('대', '').str.replace('세', '').str.strip()
            )
            real_df['age'] = pd.to_numeric(real_df['age'], errors='coerce').fillna(30).astype(int)
            merged_df = pd.concat([base_df, real_df], ignore_index=True)
            print(f"[추천] 기본 {len(base_df)}건 + 실제 구독 {len(real_rows)}건 병합 완료")
        else:
            merged_df = base_df
            print(f"[추천] 실제 구독 데이터 없음, 기본 데이터 {len(base_df)}건 사용")
    except Exception as e:
        base_df['target_product'] = base_df['product_id'].astype(int)
        merged_df = base_df
        print(f"[WARN] DB 구독 데이터 로드 실패, 기본 데이터만 사용: {e}")

    recommender_obj = ProductRecommender(merged_df)
except Exception as e:
    print(f"[WARN] 추천 모델 초기화 실패: {e}")
    recommender_obj = None


class AutoTaskRequest(BaseModel):
    user_id: int


class ChatRequest(BaseModel):
    message: str


def get_min_level(level_str: str) -> int:
    try:
        return int(level_str.replace('LEVEL_', ''))
    except:
        return 1


def get_min_level_by_detail_type(task_detail_type: str) -> int:
    mapping = {
        # 빠른 업무 - lv.1
        '입금':               1,
        '출금':               1,
        '카드수령':            1,
        # 빠른 업무 - lv.2
        '이체':               2,
        '체크카드 발급':        2,
        '통장 비밀번호 변경':   2,
        '입출금 계좌개설':      2,
        # 상담 업무 - lv.2
        '적금':               2,
        '신용카드 발급':        2,
        '대출 상환':           2,
        # 상담 업무 - lv.3
        '예금':               3,
        '신용대출':            3,
        '전세자금대출':         3,
        '금융상품가입':         3,
        # 상담 업무 - lv.4
        '소상공인 대출':        4,
        '연금신청':            4,
        '주택담보대출':         4,
        # 기업·특수 - lv.3
        '법인카드 발급':        3,
        # 기업·특수 - lv.4
        '법인계좌 개설':        4,
        '기업대출':            4,
        '연체관리':            4,
        # 기업·특수 - lv.5
        '부도관리':            5,
    }
    return mapping.get(task_detail_type, 1)


def extract_user_features(cursor, user_id: int) -> dict:
    query = """
        SELECT
            u.age,
            u.user_type,
            u.gender,
            u.identification_number,
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
        FROM user u
        WHERE u.id = %s
    """
    cursor.execute(query, (user_id,))
    row = cursor.fetchone()

    if not row:
        raise ValueError("User not found")

    age_str = str(row['age']).replace('대', '').replace('세', '').strip() if row['age'] else '30'
    user_type_str = str(row['user_type']).upper() if row['user_type'] else ''
    is_corporate = 1 if user_type_str in ('CORPORATE', '기업', '법인', 'BUSINESS') else 0
    gender_str = str(row['gender']).upper() if row['gender'] else ''

    return {
        'age':                   int(age_str) if age_str.isdigit() else 30,
        'is_corporate':          is_corporate,
        'gender':                1 if gender_str == 'MALE' else 0,
        'total_balance':         int(row['total_balance']),
        'account_count':         int(row['account_count']),
        'has_active_loan':       int(row['has_active_loan']),
        'has_overdue_loan':      int(row['has_overdue_loan']),
        'has_upcoming_payment':  int(row['has_upcoming_payment']),
        'has_issuing_card':      int(row['has_issuing_card']),
        'has_check_card':        int(row['has_check_card']),
        'has_credit_card':       int(row['has_credit_card']),
        'has_deposit_sub':       int(row['has_deposit_sub']),
        'has_savings_sub':       int(row['has_savings_sub']),
        'default_risk_level':    int(row['default_risk_level']),
        'recent_deposit_count':  int(row['recent_deposit_count']),
        'recent_withdrawal_count': int(row['recent_withdrawal_count']),
        'recent_transfer_count': int(row['recent_transfer_count']),
        'days_since_last_tx':    int(row['days_since_last_tx']),
        'max_password_fail_count': int(row['max_password_fail_count']),
        'has_business_id':       1 if (is_corporate == 1 and row['identification_number']) else 0,
        'savings_near_maturity': int(row['savings_near_maturity']),
        'deposit_near_maturity': int(row['deposit_near_maturity']),
    }


@app.post("/py/auto-insert-task")
def auto_insert_task(req: AutoTaskRequest):
    if not model:
        raise HTTPException(status_code=500, detail="AI Model not loaded.")

    try:
        with get_db_cursor() as (conn, cursor):
            # 1. 중복 접수 방지 (WAITING 또는 IN_PROGRESS task가 이미 있으면 즉시 거절)
            cursor.execute(
                "SELECT task_id FROM task WHERE user_id = %s AND status IN ('WAITING', 'IN_PROGRESS') LIMIT 1",
                (req.user_id,)
            )
            if cursor.fetchone():
                return {"result": "FAILURE_TASK_IN_PROGRESS"}

            # 2. 피처 추출 (중복 아닐 때만 무거운 쿼리 실행)
            try:
                features = extract_user_features(cursor, req.user_id)
            except ValueError:
                raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

            # 3. AI 예측 (피처 컬럼 순서 고정)
            input_df = pd.DataFrame([features])[TASK_FEATURE_COLUMNS]
            task_detail_type = str(model.predict(input_df)[0])

            # 4. 업무 매핑
            meta = DETAIL_TYPE_META.get(task_detail_type, {
                'task_type': '빠른 업무', 'prefix': 'A', 'processing_time': 5
            })
            task_type       = meta['task_type']
            processing_time = meta['processing_time']
            prefix          = meta['prefix']
            min_level       = get_min_level_by_detail_type(task_detail_type)
            assigned_level  = f"LEVEL_{min_level}"

            # 4. 티켓 번호 생성 (오늘치 기준 + FOR UPDATE 행 잠금 → 동시 요청 간 번호 중복 방지)
            #    Spring 경로(selectLastTicketNumber)와 동일하게 '오늘 날짜 + prefix'로 통일한다.
            cursor.execute(
                "SELECT ticket_number FROM task "
                "WHERE ticket_number LIKE %s AND DATE(created_at) = CURDATE() "
                "ORDER BY ticket_number DESC LIMIT 1 FOR UPDATE",
                (f"{prefix}-%",)
            )
            last_ticket = cursor.fetchone()
            next_num = int(str(last_ticket['ticket_number']).split("-")[1]) + 1 if last_ticket else 1
            ticket_number = f"{prefix}-{next_num:03d}"

            # 5. 창구 직원 배정 + 예상 대기 시간 계산 (한 번에)
            # 전체 WAITING 처리 시간 합산 기준으로 가장 한가한 직원 선택
            # 그 최솟값이 곧 이 고객의 예상 대기 시간
            member_id = None
            counter_number = None
            expected_waiting_time = 0
            cursor.execute(
                """
                SELECT m.id, m.counter_number, COALESCE(w.total_wait_min, 0) AS expected_waiting_time
                FROM member m
                LEFT JOIN (
                    SELECT member_id,
                           SUM(CASE task_type
                               WHEN '빠른 업무'   THEN 5
                               WHEN '상담 업무'   THEN 10
                               WHEN '기업 • 특수' THEN 25
                               ELSE 5
                           END) AS total_wait_min
                    FROM task WHERE status = 'WAITING'
                    GROUP BY member_id
                ) w ON m.id = w.member_id
                WHERE m.level >= %s AND m.status = 1
                ORDER BY COALESCE(w.total_wait_min, 0) ASC, m.level ASC
                LIMIT 1
                """,
                (min_level,)
            )
            member_row = cursor.fetchone()
            if not member_row:
                cursor.execute(
                    "SELECT id, counter_number FROM member WHERE status = 1 ORDER BY level DESC LIMIT 1"
                )
                member_row = cursor.fetchone()
            if member_row:
                member_id = member_row['id']
                counter_number = member_row.get('counter_number')
                expected_waiting_time = int(member_row.get('expected_waiting_time', 0))

            # 6. ranking 계산 — 배정된 직원의 전체 WAITING 건수 기준
            if member_id:
                cursor.execute(
                    "SELECT COUNT(*) AS cnt FROM task WHERE member_id = %s AND status = 'WAITING'",
                    (member_id,)
                )
                ranking = int(cursor.fetchone()['cnt']) + 1
            else:
                ranking = 1

            # 7. DB Insert
            insert_query = """
                INSERT INTO task (
                    user_id, ticket_number, task_type, task_detail_type, assigned_level,
                    expected_waiting_time, status, member_id, ranking, created_at, updated_at, is_ai
                ) VALUES (%s, %s, %s, %s, %s, %s, 'WAITING', %s, %s, %s, %s, 1)
            """
            now = datetime.now()
            cursor.execute(insert_query, (
                req.user_id, ticket_number, task_type, task_detail_type, assigned_level,
                expected_waiting_time, member_id, ranking, now, now
            ))
            inserted_task_id = cursor.lastrowid
            conn.commit()

            return {
                "result": "SUCCESS",
                "taskResult": {
                    "task_id":               inserted_task_id,
                    "user_id":               req.user_id,
                    "ticket_number":         ticket_number,
                    "task_type":             task_type,
                    "task_detail_type":      task_detail_type,
                    "assigned_level":        assigned_level,
                    "expected_waiting_time": expected_waiting_time,
                    "status":                "WAITING",
                    "member_id":             member_id,
                    "counter_number":        counter_number,
                    "ranking":               ranking,
                    "is_ai":                 True,
                    "created_at":            now.strftime('%Y-%m-%dT%H:%M:%S'),
                    "updated_at":            now.strftime('%Y-%m-%dT%H:%M:%S'),
                },
            }

    except HTTPException:
        raise
    except Error as db_err:
        raise HTTPException(status_code=500, detail=f"Database error: {str(db_err)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")


def get_user_id_from_session(request: Request) -> int | None:
    if redis_client is None:
        return None
    session_cookie = request.cookies.get("SESSION", "")
    if not session_cookie:
        return None
    try:
        padding = 4 - len(session_cookie) % 4
        session_id = base64.urlsafe_b64decode(session_cookie + "=" * padding).decode("utf-8")
        user_id = redis_client.get(f"bankscope:chat:{session_id}")
        return int(user_id) if user_id else None
    except Exception:
        return None


@app.post("/py/chat")
async def chat_bot(req: ChatRequest, request: Request):
    user_id = get_user_id_from_session(request)
    if not user_id:
        return {
            "result": "FAILURE",
            "sender": "bot",
            "content": "챗봇 서비스는 로그인 후 이용 가능합니다.",
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
    try:
        response_data = chatbot_service.get_chat_response(user_id, req.message, get_db_cursor)
        return {"result": "SUCCESS", **response_data}
    except Exception as e:
        return {
            "result": "FAILURE",
            "sender": "bot",
            "content": "현재 챗봇 서비스를 이용할 수 없습니다.",
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }


@app.get("/py/recommend/{user_id}")
def get_user_recommendation(user_id: int):
    if recommender_obj is None:
        raise HTTPException(status_code=500, detail="추천 모델이 초기화되지 않았습니다.")

    try:
        with get_db_cursor() as (conn, cursor):
            cursor.execute("""
                SELECT
                    u.age,
                    u.user_type,
                    COALESCE((SELECT SUM(balance) FROM account WHERE user_id = u.id), 0) AS total_balance,
                    CASE WHEN EXISTS (SELECT 1 FROM loan WHERE user_id = u.id AND status = 'ACTIVE')
                    THEN 1 ELSE 0 END AS has_active_loan,
                    (
                        SELECT COUNT(*)
                        FROM transaction_history th
                        JOIN account a ON th.account_id = a.account_id
                        WHERE a.user_id = u.id
                          AND th.created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)
                    ) AS recent_tx_count
                FROM user u WHERE u.id = %s
            """, (user_id,))
            user_data = cursor.fetchone()

        if not user_data:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

        age_str = str(user_data['age']).replace('대', '').replace('세', '').strip() if user_data['age'] else '30'
        user_type_str = str(user_data['user_type']).upper() if user_data['user_type'] else ''
        user_profile = {
            "age":             int(age_str) if age_str.isdigit() else 30,
            "is_corporate":    1 if user_type_str in ('CORPORATE', '기업', '법인', 'BUSINESS') else 0,
            "total_balance":   int(user_data['total_balance']),
            "has_active_loan": int(user_data['has_active_loan']),
            "recent_tx_count": int(user_data['recent_tx_count']),
        }

        recommended_ids = recommender_obj.get_recommendations(user_profile)
        user_age = user_profile['age']

        products_list = []
        with get_db_cursor() as (conn, cursor):
            for product_id in recommended_ids:
                cursor.execute(
                    "SELECT * FROM financial_product WHERE product_id = %s AND is_active = 1"
                    " AND (min_age IS NULL OR min_age <= %s)"
                    " AND (max_age IS NULL OR max_age >= %s)",
                    (int(product_id), user_age, user_age)
                )
                product_data = cursor.fetchone()
                if product_data:
                    products_list.append({
                        "productId":         product_data['product_id'],
                        "productCategory":   product_data['product_category'],
                        "targetType":        product_data['target_type'],
                        "productName":       product_data['product_name'],
                        "baseInterestRate":  float(product_data['base_interest_rate']),
                        "maxInterestRate":   float(product_data['max_interest_rate']),
                        "minDurationMonths": product_data['min_duration_months'],
                        "maxDurationMonths": product_data['max_duration_months'],
                        "minAmount":         int(product_data['min_amount']) if product_data['min_amount'] is not None else None,
                        "maxAmount":         int(product_data['max_amount']) if product_data['max_amount'] is not None else None,
                        "description":       product_data['description'],
                        "isActive":          bool(product_data['is_active'])
                    })

        return {"result": "SUCCESS", "user_id": user_id, "products": products_list}

    except HTTPException:
        raise
    except RuntimeError:
        raise HTTPException(status_code=500, detail="DB 연결 불가")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")


def get_prediction_explanation_context(user_id: int) -> dict:
    if not model:
        raise HTTPException(status_code=500, detail="AI Model not loaded.")

    with get_db_cursor() as (conn, cursor):
        try:
            features = extract_user_features(cursor, user_id)
        except ValueError:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    input_df = pd.DataFrame([features])[TASK_FEATURE_COLUMNS]
    predicted = str(model.predict(input_df)[0])

    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(input_df)
    is_3d = isinstance(shap_values, np.ndarray) and shap_values.ndim == 3

    classes = list(model.classes_)
    class_idx = classes.index(predicted) if predicted in classes else 0
    values = shap_values[0, :, class_idx] if is_3d else shap_values[class_idx][0]
    base = (
        explainer.expected_value[class_idx]
        if hasattr(explainer.expected_value, '__len__')
        else explainer.expected_value
    )

    confidence = None
    if hasattr(model, 'predict_proba'):
        probabilities = model.predict_proba(input_df)[0]
        confidence = float(probabilities[class_idx])

    return {
        "features": features,
        "input_df": input_df,
        "predicted": predicted,
        "values": values,
        "base": base,
        "confidence": confidence,
    }


def format_feature_value(feature_name: str, value) -> str:
    try:
        numeric = int(value)
    except Exception:
        numeric = value

    if feature_name == 'age':
        return f"{numeric}세"
    if feature_name == 'is_corporate':
        return '법인' if numeric == 1 else '개인'
    if feature_name == 'gender':
        return '남성' if numeric == 1 else '여성'
    if feature_name == 'total_balance':
        return f"{numeric:,}원"
    if feature_name == 'account_count':
        return f"{numeric}개"
    if feature_name == 'default_risk_level':
        return {0: '없음', 1: '저위험', 2: '중위험', 3: '고위험'}.get(numeric, str(numeric))
    if feature_name == 'days_since_last_tx':
        return '거래 없음' if numeric >= 999 else f"{numeric}일"
    if feature_name in {
        'recent_deposit_count',
        'recent_withdrawal_count',
        'recent_transfer_count',
        'max_password_fail_count',
    }:
        return f"{numeric}회"
    if feature_name.startswith('has_') or feature_name.endswith('_near_maturity'):
        return '예' if numeric == 1 else '아니오'
    return str(value)


def build_top_feature_reasons(features: dict, shap_contributions, limit: int = 3) -> list[dict]:
    items = []
    for index, feature_name in enumerate(TASK_FEATURE_COLUMNS):
        contribution = float(shap_contributions[index])
        value = features.get(feature_name)
        meta = FEATURE_DISPLAY_META[feature_name]
        items.append({
            "feature": feature_name,
            "label": meta["label"],
            "value": format_feature_value(feature_name, value),
            "message": meta["message"],
            "contribution": contribution,
            "strength": abs(contribution),
            "direction": "positive" if contribution >= 0 else "negative",
        })

    positive_items = [item for item in items if item["contribution"] > 0]
    ranked = positive_items if positive_items else items
    ranked.sort(key=lambda item: item["strength"], reverse=True)
    return ranked[:limit]


@app.get("/py/explain/{user_id}/summary")
def explain_prediction_summary(user_id: int):
    """은행원 UI용 AI 예측 근거 요약. raw SHAP plot 대신 상담 문장으로 반환한다."""
    try:
        context = get_prediction_explanation_context(user_id)
        predicted = context["predicted"]
        meta = DETAIL_TYPE_META.get(predicted, {})
        reasons = build_top_feature_reasons(context["features"], context["values"])
        return {
            "result": "SUCCESS",
            "userId": user_id,
            "predictedTaskDetailType": predicted,
            "predictedTaskType": meta.get("task_type"),
            "confidence": context["confidence"],
            "reasons": reasons,
        }
    except HTTPException:
        raise
    except RuntimeError:
        raise HTTPException(status_code=500, detail="DB 연결 불가")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")


@app.get("/py/explain/{user_id}")
def explain_prediction(user_id: int):
    """특정 고객의 AI 예측 근거를 SHAP waterfall 이미지로 반환."""
    try:
        context = get_prediction_explanation_context(user_id)
        input_df = context["input_df"]
        predicted = context["predicted"]
        values = context["values"]
        base = context["base"]

        plt.rcParams['font.family'] = 'DejaVu Sans'
        plt.rcParams['axes.unicode_minus'] = True

        shap.waterfall_plot(
            shap.Explanation(
                values=values,
                base_values=base,
                data=input_df.iloc[0],
                feature_names=TASK_FEATURE_COLUMNS,
            ),
            show=False,
        )
        plt.title(f'user_id={user_id}  →  predicted: {predicted}', fontsize=10)
        plt.tight_layout()

        out_path = f'shap_explain_user_{user_id}.png'
        plt.savefig(out_path, dpi=150, bbox_inches='tight')
        plt.close()

        return FileResponse(out_path, media_type='image/png', filename=out_path)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")
