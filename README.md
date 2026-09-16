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
- Redis 6.0+ (세션 공유용)
- Java 17+
- Node.js 18+
- Python 3.10+

---

## 실행 방법

### 0. Redis 실행

백엔드와 AI 서버 간의 세션 공유를 위해 Redis 서버가 반드시 로컬(포트 6379)에 실행되어 있어야 합니다.

**Mac (Homebrew):**
```bash
brew services start redis
```

**Windows (WSL2):**
```bash
sudo apt-get update
sudo apt-get install redis-server
sudo service redis-server start
```

**Docker (Mac/Windows 공통):**
```bash
docker run -d --name redis-server -p 6379:6379 redis
```

### 1. DB 설정

DB 스키마와 시드 데이터는 **Flyway 마이그레이션으로 자동 관리**된다. MySQL이 실행 중이면 별도 SQL을 수동으로 돌릴 필요 없이, 백엔드 기동 시 SQL 마이그레이션과 Java 마이그레이션이 순서대로 자동 적용된다.

```
V1__init_schema.sql   ← 테이블 생성 (스키마)
V2__seed_data.sql     ← 샘플 데이터 시드
V3__seed_board.sql    ← 게시판/공지 샘플 데이터 시드
V4__migrate_resident_number_to_gcm.java ← 설정된 키로 주민번호 AES-GCM 암호화 및 HMAC 검색 인덱스 구성
V5__seed_hourly_congestion_demo.sql ← 시간대별 예상 혼잡도 차트용 합성 완료 업무 이력 시드
V6__task_confirmation_and_transfer.sql ← 최초 AI 예상·직원 확인·접수 스냅샷·이관 이력
V7__consultation_transfer_priority.sql ← 상담 후 이관 우선 대기 시각·대기열 인덱스
V8__daily_numeric_ticket_numbers.sql ← AI·직접 접수가 공유하는 일별 숫자 번호
```

- **빈 DB**: 백엔드를 처음 실행하면 Flyway가 V1~V8을 적용하여 스키마+데이터를 자동 구성한다. (`bank` 스키마가 없으면 자동 생성)
- **이미 데이터가 있는 DB**: Flyway가 `baseline`으로 인식하여 V1·V2를 재실행하지 않으므로 기존 스키마와 시드 데이터가 보존된다. 이후 마이그레이션은 적용 이력에 따라 추적·검증된다.
- 적용 이력은 `bank.flyway_schema_history` 테이블에서 추적된다.
- **V4 데이터 검증**: 평문 주민번호는 AES-GCM 암호문과 HMAC 검색 인덱스로 변환한다. 이미 변환된 행은 현재 설정 키로 복호화하고 검색 인덱스가 일치하는지 검증한 뒤 건너뛴다. 암호문 누락·손상이나 키/인덱스 불일치가 있으면 해당 사용자 ID와 함께 중단하므로, 원본 데이터와 설정 키를 확인해야 한다.
- **주의**: 적용 완료된 마이그레이션 파일을 수정하면 기존 DB의 Flyway 체크섬과 맞지 않을 수 있다. 적용된 파일은 원본으로 유지하고 추가 변경은 새 버전의 마이그레이션으로 작성한다.

> V1\~V3/V5/V6/V7/V8은 SQL 기반 Flyway 마이그레이션이고, V4는 Java 기반 Flyway 마이그레이션이다. 최종 DB 구성은 백엔드 기동을 통해 Flyway가 V8까지 적용하게 한다. V5의 `DCG` prefix 이력은 관리자 혼잡도 UI 시연용 합성 완료 업무이며, AI 업무 예측 모델 학습에서는 제외된다.

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

IntelliJ에서는 `bank-backend/pom.xml`을 Maven 프로젝트로 연결한다. Java 소스는 `bank-backend/src/main/java`, 테스트는 `bank-backend/src/test/java`다. `.uv-cache`나 `.venv` 안의 파일은 소스 루트로 지정하지 않는다. IDE 설정을 다시 읽어야 하면 Maven 새로고침 또는 프로젝트 재열기를 사용한다.

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

학습 완료 시 `bank_model.pkl`, `shap_summary_bar.png`, `data/model_evaluation.json`이 갱신된다. 같은 고객 조건·변형 사례를 묶어 학습/평가를 나누며, 기본 실행에서는 합성 CSV만 사용한다. 정확도에 따른 저장 제한은 두지 않는다.

합성데이터를 원본으로부터 재생성·검증하려면 먼저 아래 명령을 실행한다.

```bash
python prepare_datasets.py
python -m unittest test_datasets -v
```

과거에 실제 처리 업무를 명시적으로 확인한 완료 기록과 접수 스냅샷을 검토 후 포함하려면 `python RF.py --include-confirmed-db`를 명시한다. 새 원클릭 종료·미방문·이관 확인만 있는 기록은 학습 정답으로 사용하지 않는다. 재학습 모델을 반영하려면 AI 서버를 재시작한다.

## 데이터셋과 업무 이관

외부 학습 데이터셋은 추가하지 않았다. 업무 예측용 합성 데이터 11,041건(22개 입력/22개 업무), 추천 참조 데이터 5,195건(5개 입력/16개 가상 상품)을 사용한다. 출처·정리 규칙·평가 결과·한계·참가서류용 설명은 [데이터셋 설명서](AI_Server/DATASET.md)에 정리했다. 합성 시나리오 평가 정확도 75.52%는 실제 고객 대상 성능을 의미하지 않는다.

- 대기: 고객 카드에 **고객 호출**만 표시한다. 호출하면 `CALLED`로 바뀌며 객장 번호판에 접수번호·창구번호를 안내한다.
- 호출 중: **상담 시작 / 미방문**, 보조로 **다시 호출**을 표시한다. 고객이 도착하면 상담 시작으로 `IN_PROGRESS`가 된다. 재호출은 상담을 시작하지 않는다. 미방문은 호출한 고객만 `NO_SHOW`로 정리하며 자동 타이머나 확인창은 없다. 정상 완료 실적에서 제외한다.
- 창구 상태: 같은 담당자의 호출·상담은 한 명씩 처리하며 서버 잠금으로 중복 호출을 막는다. 호출·상담 중에는 자리비움·로그아웃을 제한한다. 배정된 담당자는 근무 중이고 창구가 있으면 직급을 다시 검사하지 않고 응대할 수 있다. 직원 직급 자체는 변경하지 않는다.
- 객장 번호판: 워크스페이스의 **객장 번호판** 링크 또는 `/queue-display`를 별도 모니터 브라우저에서 연다. 1~5번 창구를 고정된 위치에 표시하며, 각 칸에 접수번호와 호출 중·상담 중·호출 대기·미운영 상태를 안내한다. 빈 창구도 칸을 유지하고, 종료·미방문·이관 후에는 해당 칸의 번호를 지운다. 호출·재호출한 창구는 잠시 테두리를 강조한다. 처음 한 번 **호출음 켜기**를 눌러 소리를 허용한다. `/api/queue/display`를 1초 주기로 조회하며 새로운 호출·재호출마다 소리를 낸다. 새로고침 시 지난 호출은 재생하지 않는다. 공개 API는 접수번호·창구번호·상태·호출 ID만 반환하고 고객 이름·업무 목적은 노출하지 않는다. 물리 번호판 장비 프로토콜 연동은 별도이며 현재는 브라우저 화면·스피커 방식이다.
- 상담 중: 고객 카드에 **업무 이관 / 업무 종료**를 표시한다. 상담 영역에는 같은 버튼을 중복 표시하지 않는다. 확인한 실제 업무를 담당자가 처리할 수 있으면 상담을 계속하고, 다른 창구의 도움이 필요할 때 이관한다. 직원 이관은 상담 시작 후에만 가능하며 서버에서도 검사한다.
- 이관: 실제 업무·사유를 입력하고 업무 권한과 근무 상태를 충족하는 직원을 선택한다. 퇴근·자리비움 직원과 창구가 없는 직원은 목록에서 제외하며, 다른 고객을 상담 중인 직원은 포함한다. 실행 시 받는 직원의 상태와 업무 권한을 다시 확인한다. **호출·상담 중 고객 → 상담 후 이관 고객(이관 시각순) → 일반 대기 고객(최초 접수순)**으로 안내한다. 관리자·로그아웃에 따른 운영상 재배정은 새 우선권을 만들지 않는다. 기존 번호표·최초 접수 시각과 이관 이력을 유지한다.
- 대기 정보: 조회 시 현재 창구 대기열로 순번·예상 시간을 계산한다. 직원 화면은 기존 10초 주기로 갱신한다. 호출·상담 중 고객도 업무별 고정 소요시간으로 포함하며 실제 잔여 시간을 측정한 값은 아니다.
- 종료: **업무 종료**를 누르면 확인창 없이 `COMPLETED`로 정리하고 목록에서 제거한다. 종료 로그는 `CLOSE`이며 최초 AI 예상이나 이관 확인을 실제 처리 업무의 정답으로 확정하지 않는다. 기록은 보존한다.
- 번호표: 업무 구분 없이 하루 단위 공통 숫자 `1, 2, 3, …`를 발급한다. AI·직접 접수가 같은 DB 카운터를 잠그고 접수 저장과 함께 커밋하므로 동시 발급 시에도 중복되지 않는다. 발급일·접수 시각은 DB 시계를 사용한다. 기존 영문 번호표와 이관 시 번호는 보존한다. 고객 화면은 접수번호·담당 창구·그 창구의 앞 대기 인수를 안내하며, 번호가 지점 전체의 호출 순서를 의미하지는 않는다.
- 배포 순서: 백엔드를 시작해 V8을 적용한 후, 변경된 프론트엔드와 AI 서버를 함께 반영한다. 기존 데이터는 유지된다.

실제 MySQL 대기열 테스트는 `BANK_QUEUE_TEST_URL`, `BANK_QUEUE_TEST_USER`, `BANK_QUEUE_TEST_PASSWORD`를 설정한 뒤 백엔드에서 `mvn -Dtest=TaskQueueSqlTest test`로 실행한다. 테스트 계정에는 별도 테스트 DB 생성·삭제 권한이 필요하다. 매 테스트가 고유한 `bankscope_queue_test_...` DB를 만들고 정리하며, 앱 DB에서는 테이블 구조만 읽는다. 환경변수가 없으면 이 SQL 테스트는 생략된다.

같은 환경변수로 AI_Server에서 `python -B -m unittest test_reception_sql -v`를 실행하면 별도 `bankscope_ticket_test_...` DB에서 Python·Spring SQL의 동시 발급, 날짜별 번호, 롤백, 기존 번호 보존, 학습 제외 조건을 검사한다.
