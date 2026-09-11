# BankScope

AI 기반 통합 스마트 뱅킹 플랫폼. 고객 맞춤 금융 상품 추천, 지능형 창구 자동 배정, Gemini 챗봇 상담을 하나의 웹 시스템으로 제공한다.

---

## 🔗 라이브 데모 (배포)

**배포 URL: https://votes-everything-node-position.trycloudflare.com/**

별도 설치 없이 아래 경로로 바로 접속하여 체험할 수 있다.

| 역할 | 접속 경로 | 계정 |
|---|---|---|
| 고객 | [`/login`](https://votes-everything-node-position.trycloudflare.com/login) | `test01@test.com` / `Test1234!` |
| 관리자 | [`/adminlogin`](https://votes-everything-node-position.trycloudflare.com/adminlogin) | `admin@admin.com` / `1234` |
| 행원 (워크스페이스) | [`/adminlogin`](https://votes-everything-node-position.trycloudflare.com/adminlogin) | `banker@naver.com` / `1234` |
| 키오스크 | [`/kiosk`](https://votes-everything-node-position.trycloudflare.com/kiosk) | 비회원: 이름 + 주민번호 13자리 / 회원: `AI_Server/user.txt`의 주민번호 |

- 고객 계정 `test01@test.com`은 계좌·대출·카드·가입 상품 데이터를 모두 보유하여 AI 맞춤추천·챗봇 개인화를 함께 확인할 수 있다.
- 키오스크 접수 시작 버튼은 '근무중' 상태인 행원이 1명 이상일 때 활성화된다.
- 전체 테스트 계정 및 주민번호 목록은 [`AI_Server/user.txt`](AI_Server/user.txt) 참고.

---

## 기술 스택

| 영역 | 기술 |
|---|---|
| Frontend | React, Vite |
| Backend | Spring Boot, MyBatis, MySQL |
| AI Server | Python, FastAPI, Scikit-learn, SHAP, Google Gemini API |

---

## 실행 전 준비사항

- MySQL 8.0+
- Java 17+
- Node.js 18+
- Python 3.10+

---

## 실행 방법

### 1. DB 설정

DB 스키마와 시드 데이터는 **Flyway 마이그레이션으로 자동 관리**된다. MySQL이 실행 중이면 별도 SQL을 수동으로 돌릴 필요 없이, 백엔드 기동 시 SQL 마이그레이션과 Java 마이그레이션이 순서대로 자동 적용된다.

```
V1__init_schema.sql   ← 테이블 생성 (스키마)
V2__seed_data.sql     ← 샘플 데이터 시드
V3__seed_board.sql    ← 게시판/공지 샘플 데이터 시드
V4__migrate_resident_number_to_gcm.java ← 설정된 키로 주민번호 AES-GCM 암호화 및 HMAC 검색 인덱스 구성
V5__seed_hourly_congestion_demo.sql ← 시간대별 예상 혼잡도 차트용 합성 완료 업무 이력 시드
```

- **빈 DB**: 백엔드를 처음 실행하면 Flyway가 V1~V5를 적용하여 스키마+데이터를 자동 구성한다. (`bank` 스키마가 없으면 자동 생성)
- **이미 데이터가 있는 DB**: Flyway가 `baseline`으로 인식하여 V1·V2를 재실행하지 않으므로 기존 스키마와 시드 데이터가 보존된다. 이후 마이그레이션은 적용 이력에 따라 추적·검증된다.
- 적용 이력은 `bank.flyway_schema_history` 테이블에서 추적된다.
- **주의**: 적용 완료된 마이그레이션 파일을 수정한 뒤에는 기존 DB의 Flyway 체크섬과 맞지 않을 수 있다. 이 경우 기존 제출용 더미 DB를 비우고 V1~V5를 처음부터 다시 적용해야 한다.

> V1\~V3/V5는 SQL 기반 Flyway 마이그레이션이고, V4는 Java 기반 Flyway 마이그레이션이다. V1\~V3 SQL만 수동 실행하면 주민번호 보호 컬럼과 검색 인덱스가 완성되지 않으므로, 최종 DB 구성은 백엔드 기동을 통해 Flyway가 V5까지 적용하게 해야 한다. V5의 `DCG` prefix 이력은 관리자 혼잡도 UI 시연용 합성 완료 업무이며, AI 업무 예측 모델 학습에서는 제외된다.

### 2. Backend (`bank-backend`)

`application.properties.example`을 복사하여 `application.properties`로 이름을 바꾸고, 본인 환경에 맞게 값을 채운다.

```bash
cp bank-backend/src/main/resources/application.properties.example \
   bank-backend/src/main/resources/application.properties
```

주요 수정 항목:
- `spring.datasource.password` — MySQL 비밀번호
- `spring.mail.username` / `spring.mail.password` — Gmail 계정 및 앱 비밀번호 (이메일 인증 기능 사용 시)
- `solapi.api.key` / `solapi.api.secret` — Solapi API 키 (SMS 기능 사용 시)

`app.aes.secret-key`와 `app.hmac.secret-key`는 주민번호 AES-GCM 암호화와 HMAC 블라인드 인덱스 생성에 사용된다. V4 Java 마이그레이션은 DB 초기 구성 시 현재 설정된 키로 더미 주민번호를 암호화하므로, DB를 처음 만들기 전에는 환경별 키로 바꿔도 된다. 단, V4 적용 후 키를 바꾸면 기존 암호문 복호화가 깨지므로 키 교체는 별도 재암호화 마이그레이션으로 처리해야 한다. 실서비스에서는 해당 키를 깃에 두지 않고 시크릿 매니저 또는 환경 변수로 주입하는 구조가 맞다.

이후 Spring Boot 서버를 실행한다.

```bash
./mvnw spring-boot:run
```

기본 포트: `http://localhost:8080`

### 3. AI Server (`AI_Server`)

`.env.example`을 복사하여 `.env`로 이름을 바꾸고, 본인 환경에 맞게 값을 채운다.

```bash
cp AI_Server/.env.example AI_Server/.env
```

주요 수정 항목:
- `GEMINI_API_KEY` — Google AI Studio에서 발급 (https://aistudio.google.com)
- `DB_PASSWORD` — MySQL 비밀번호

패키지를 설치한다 (최초 1회).

```bash
pip install -r requirements.txt
```

가상 환경을 활성화한다.

**Windows:**
```bash
.venv\Scripts\activate
```

**Mac/Linux:**
```bash
source .venv/bin/activate
```

> 터미널 입력창 앞에 `(.venv)`가 표시되면 정상이다.

서버를 실행한다.

```bash
uvicorn main:app --reload --port 8000
```

기본 포트: `http://localhost:8000`

### 4. Frontend (`bank-frontend`)

```bash
cd bank-frontend
npm install
npm run dev
```

기본 포트: `http://localhost:5173`

---

## 테스트 계정

샘플 데이터에 포함된 테스트 계정 목록은 `AI_Server/user.txt`를 참고한다.

| 구분 | 계정 예시 | 비밀번호 |
|---|---|---|
| 고객 (개인) | `test01@test.com` ~ `test15@test.com` | `Test1234!` |
| 고객 (법인) | `corp01@test.com` ~ `corp06@test.com` | `Test1234!` |
| 행원 | `banker@naver.com` 외 4명 (`db/migration/V2__seed_data.sql`의 member 참고) | `1234` |
| 관리자 | `admin@admin.com` | `1234` |

> 전체 고객 계정의 상세 정보(이름, 주민번호, 전화번호 등)는 `AI_Server/user.txt`를 참고한다.

---

## AI 모델 재학습 (선택)

`bank_model.pkl`이 이미 포함되어 있으므로 별도 학습 없이 바로 실행 가능하다.
모델을 직접 재학습하려면 가상 환경을 활성화한 뒤 AI Server에서 아래 스크립트를 실행한다.

```bash
python RF.py
```

> 학습 완료 시 `bank_model.pkl`이 갱신된다. 정확도 85% 미만이면 저장되지 않는다.
