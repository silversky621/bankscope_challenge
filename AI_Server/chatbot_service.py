import os
import requests
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')


def _load_site_guide() -> str:
    guide_path = os.path.join(os.path.dirname(__file__), 'site_guide.txt')
    try:
        with open(guide_path, encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        print(f"[WARN] 사이트 가이드 로드 실패: {e}")
        return ""


def _load_products(get_db_cursor) -> str:
    try:
        with get_db_cursor() as (conn, cursor):
            cursor.execute(
                "SELECT product_name, description, base_interest_rate, max_interest_rate, "
                "product_category, target_type FROM financial_product WHERE is_active = 1"
            )
            products = cursor.fetchall()
        lines = [
            f"- {p['product_name']} ({p['product_category']}, "
            f"{'법인' if p['target_type'] == 'CORPORATE' else '개인' if p['target_type'] == 'INDIVIDUAL' else '공통'}): "
            f"기본금리 {p['base_interest_rate']}%, 최고금리 {p['max_interest_rate']}%, "
            f"{p['description']}"
            for p in products
        ]
        return "\n".join(lines)
    except Exception as e:
        print(f"[WARN] 상품 로드 실패: {e}")
        return ""


# ─────────────────────────────────────────────────────────────────────────────
# 의도 기반 개인화 (실무의 function-calling 라우팅을 가볍게 흉내낸 것)
#  - 고객 메시지에서 의도를 감지해, "필요한 데이터만" DB에서 조회해 컨텍스트에 주입한다.
#  - 민감 식별정보(주민번호/계좌 비밀번호/카드 전체번호/CVC)는 애초에 조회하지 않거나 마스킹한다.
#  - 실서비스라면 외부 공개 LLM 대신 프라이빗/온프레미스 모델 + 비식별화가 필요하다(보고서 참고).
# ─────────────────────────────────────────────────────────────────────────────

_PERSONAL_INTENT_KEYWORDS = {
    "account":      ["잔액", "잔고", "통장", "계좌", "예치", "출금", "입금", "이체"],
    "loan":         ["대출", "상환", "원리금", "이자", "연체", "갚", "융자"],
    "card":         ["카드", "한도", "할부", "결제일", "청구"],
    "subscription": ["가입한", "가입 상품", "내 상품", "내가 든", "적금", "예금", "만기"],
    "recommend":    ["추천", "맞는 상품", "어떤 상품", "가입할", "뭐가 좋", "상품 추천"],
}


def _detect_intents(message: str) -> set:
    intents = set()
    for intent, keywords in _PERSONAL_INTENT_KEYWORDS.items():
        if any(kw in message for kw in keywords):
            intents.add(intent)
    return intents


def _mask_tail(value, keep: int = 4) -> str:
    """계좌/카드 번호 등은 뒤 keep자리만 노출하고 나머지를 가린다. (예: ****1234)"""
    s = str(value or "")
    if len(s) <= keep:
        return "****"
    return "****" + s[-keep:]


def _load_user_context(user_id: int, get_db_cursor, intents: set) -> str:
    """감지된 의도에 해당하는 '본인' 데이터만 조회해 요약 문자열로 반환한다."""
    sections = []
    try:
        with get_db_cursor() as (conn, cursor):
            # 기본 정보(이름/등급/연령대): 개인 의도가 하나라도 있으면 맞춤 답변용으로 포함
            cursor.execute("SELECT name, grade, age FROM user WHERE id = %s", (user_id,))
            basic = cursor.fetchone()
            if basic:
                grade = basic.get('grade') or '일반'
                sections.append(
                    f"고객: {basic['name']}님 / 등급: {grade} / 연령대: {basic.get('age') or '-'}"
                )

            if "account" in intents:
                cursor.execute(
                    "SELECT account_type, account_number, balance FROM account "
                    "WHERE user_id = %s AND status = 'ACTIVE'", (user_id,)
                )
                rows = cursor.fetchall()
                if rows:
                    lines = [
                        f"  - {r['account_type']}({_mask_tail(r['account_number'])}): {int(r['balance']):,}원"
                        for r in rows
                    ]
                    total = sum(int(r['balance']) for r in rows)
                    sections.append("보유 계좌:\n" + "\n".join(lines) + f"\n  · 총 잔액 합계: {total:,}원")
                else:
                    sections.append("보유 계좌: 없음")

            if "loan" in intents:
                cursor.execute(
                    "SELECT l.loan_id, fp.product_name, l.outstanding_amount, l.interest_rate, "
                    "l.status, l.maturity_date, l.overdue_amount "
                    "FROM loan l JOIN financial_product fp ON l.product_id = fp.product_id "
                    "WHERE l.user_id = %s AND l.status IN ('ACTIVE','OVERDUE')", (user_id,)
                )
                loans = cursor.fetchall()
                if loans:
                    loan_lines = []
                    for l in loans:
                        cursor.execute(
                            "SELECT due_date, repay_amount FROM loan_schedule "
                            "WHERE loan_id = %s AND status = 'SCHEDULED' ORDER BY due_date LIMIT 1",
                            (l['loan_id'],)
                        )
                        nxt = cursor.fetchone()
                        nxt_txt = (f", 다음 상환 {nxt['due_date']} {int(nxt['repay_amount']):,}원" if nxt else "")
                        overdue_txt = (f", 연체 {int(l['overdue_amount']):,}원" if l['overdue_amount'] else "")
                        loan_lines.append(
                            f"  - {l['product_name']}: 잔액 {int(l['outstanding_amount']):,}원, "
                            f"금리 {l['interest_rate']}%, 만기 {l['maturity_date']}{nxt_txt}{overdue_txt} [{l['status']}]"
                        )
                    sections.append("진행 중 대출:\n" + "\n".join(loan_lines))
                else:
                    sections.append("진행 중 대출: 없음")

            if "card" in intents:
                cursor.execute(
                    "SELECT card_name, card_number, card_type, credit_limit, used_amount "
                    "FROM card WHERE user_id = %s AND status = 'ACTIVE'", (user_id,)
                )
                cards = cursor.fetchall()
                if cards:
                    card_lines = []
                    for c in cards:
                        type_txt = '신용' if c['card_type'] == 'CREDIT' else '체크'
                        usage = ""
                        if c['card_type'] == 'CREDIT' and c.get('credit_limit'):
                            usage = f", 사용 {int(c['used_amount'] or 0):,}/한도 {int(c['credit_limit']):,}원"
                        card_lines.append(
                            f"  - {c['card_name'] or '카드'}({_mask_tail(c['card_number'])}, {type_txt}){usage}"
                        )
                    sections.append("보유 카드:\n" + "\n".join(card_lines))
                else:
                    sections.append("보유 카드: 없음")

            if "subscription" in intents:
                cursor.execute(
                    "SELECT fp.product_name, fp.product_category, ps.amount, "
                    "ps.applied_interest_rate, ps.duration_months "
                    "FROM product_subscription ps JOIN financial_product fp ON ps.product_id = fp.product_id "
                    "WHERE ps.user_id = %s AND ps.status = 'ACTIVE'", (user_id,)
                )
                subs = cursor.fetchall()
                if subs:
                    sub_lines = [
                        f"  - {s['product_name']}({s['product_category']}): "
                        f"{('월 ' + format(int(s['amount']), ',') + '원') if s['amount'] else '-'}, "
                        f"금리 {s['applied_interest_rate']}%, {s['duration_months'] or '-'}개월"
                        for s in subs
                    ]
                    sections.append("가입 상품:\n" + "\n".join(sub_lines))
                else:
                    sections.append("가입 상품: 없음")
    except Exception as e:
        print(f"[WARN] 고객 개인 컨텍스트 로드 실패: {e}")
        return ""
    return "\n".join(sections)


_SITE_GUIDE = _load_site_guide()
print("[알림] 챗봇 사이트 가이드 로드 완료")

DAILY_LIMIT = 30
_daily_count: dict[int, dict] = {}  # {user_id: {"date": "YYYY-MM-DD", "count": int}}


def _check_daily_limit(user_id: int) -> bool:
    """True면 한도 초과."""
    today = datetime.now().strftime("%Y-%m-%d")
    record = _daily_count.get(user_id)
    if record is None or record["date"] != today:
        _daily_count[user_id] = {"date": today, "count": 0}
    if _daily_count[user_id]["count"] >= DAILY_LIMIT:
        return True
    _daily_count[user_id]["count"] += 1
    return False


def get_chat_response(user_id: int, user_message: str, get_db_cursor) -> dict:
    try:
        if _check_daily_limit(user_id):
            return {
                "sender": "bot",
                "content": f"오늘 채팅 가능 횟수({DAILY_LIMIT}건)를 모두 사용하셨습니다. 내일 다시 이용해주세요.",
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
        products_text = _load_products(get_db_cursor)

        # 의도 기반으로 '본인' 데이터만 선택적으로 조회 (해당 의도가 없으면 개인정보는 아예 조회하지 않음)
        intents = _detect_intents(user_message)
        user_context = _load_user_context(user_id, get_db_cursor, intents) if intents else ""

        context = f"[사이트 이용 가이드]\n{_SITE_GUIDE}"
        if products_text:
            context += f"\n\n[금융 상품 목록]\n{products_text}"
        if user_context:
            context += (
                "\n\n[고객 본인 정보] (현재 로그인한 고객 본인의 실데이터입니다. 맞춤 답변에만 활용하세요)\n"
                + user_context
            )

        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
        )
        prompt = (
            "당신은 BankScope 은행 AI 상담원입니다. "
            "아래 참조 데이터를 바탕으로 고객 질문에 친절하고 정확하게 답변하세요. "
            "[고객 본인 정보]가 제공되면 그 데이터를 활용해 개인화된 답변을 제공하세요. "
            "단, 주민등록번호·계좌 비밀번호·카드 전체 번호·CVC 등 민감정보는 어떤 경우에도 언급하거나 추측하지 마세요. "
            "참조 데이터에 없는 내용은 '직접 방문 또는 고객센터 문의'를 안내하세요. "
            "'안녕하세요' 등의 인사말은 생략하고 바로 답변하세요. "
            "[형식 규칙] 한 덩어리로 길게 쓰지 말고 짧은 문단으로 나누되, 문단과 문단 사이에는 반드시 빈 줄(\\n\\n)을 넣으세요. "
            "여러 항목(상품 등)을 나열할 때는 각 항목을 새 줄에서 '• '로 시작하는 목록으로 작성하고, 항목과 항목 사이에도 빈 줄(\\n\\n)을 넣어 구분하세요. "
            "별표(**)나 해시(#) 같은 마크다운 기호는 사용하지 말고 일반 텍스트로만 작성하세요. "
            "전체 답변은 핵심 위주로 간결하게 유지하세요.\n\n"
            f"{context}\n\n"
            f"[고객 질문]\n{user_message}"
        )

        response = requests.post(
            url,
            json={"contents": [{"parts": [{"text": prompt}]}]},
            timeout=30
        )
        result = response.json()

        if response.status_code == 200:
            try:
                ai_content = result['candidates'][0]['content']['parts'][0]['text']
            except (KeyError, IndexError):
                print(f"응답 구조 오류: {result}")
                ai_content = "답변 생성 과정에서 오류가 발생했습니다."
        else:
            print(f"API 실패 ({response.status_code}): {result}")
            ai_content = "죄송합니다. 서비스 응답에 실패했습니다. 잠시 후 다시 시도해주세요."

        return {
            "sender": "bot",
            "content": ai_content,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

    except Exception as e:
        print(f"Chat Service Error: {e}")
        return {
            "sender": "bot",
            "content": "처리 중 일시적인 오류가 발생했습니다.",
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
