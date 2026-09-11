-- 관리자 대시보드 '시간대별 예상 혼잡도' 시연용 합성 완료 업무 이력.
-- DCG prefix는 실제 업무 이력과 구분하기 위한 표식이며, RF.py 모델 학습에서는 제외한다.
-- 최근 8주 월~금 이력을 생성해 어느 영업일에 실행해도 동일 요일 기준 차트가 채워지게 한다.

SET NAMES utf8mb4;

DELETE FROM `bank`.`task`
WHERE `ticket_number` LIKE 'DCG%';

INSERT INTO `bank`.`task` (
  `user_id`,
  `ticket_number`,
  `task_type`,
  `task_detail_type`,
  `assigned_level`,
  `expected_waiting_time`,
  `status`,
  `member_id`,
  `ranking`,
  `created_at`,
  `updated_at`,
  `is_ai`
)
WITH RECURSIVE
calendar(n, work_date) AS (
  SELECT 1, DATE_SUB(CURDATE(), INTERVAL 1 DAY)
  UNION ALL
  SELECT n + 1, DATE_SUB(CURDATE(), INTERVAL n + 1 DAY)
  FROM calendar
  WHERE n < 56
),
business_days AS (
  SELECT
    work_date,
    CASE DAYOFWEEK(work_date)
      WHEN 2 THEN 1.00 -- Monday
      WHEN 3 THEN 0.82 -- Tuesday
      WHEN 4 THEN 0.92 -- Wednesday
      WHEN 5 THEN 1.05 -- Thursday
      WHEN 6 THEN 1.15 -- Friday
    END AS day_factor
  FROM calendar
  WHERE DAYOFWEEK(work_date) BETWEEN 2 AND 6
),
seq(n) AS (
  SELECT 1
  UNION ALL
  SELECT n + 1 FROM seq WHERE n < 40
),
customer_pool AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY id) AS rn,
    COUNT(*) OVER () AS total
  FROM `bank`.`user`
  WHERE `user_type` = 'customer'
),
profiles(hour_value, task_type, task_detail_type, assigned_level, processing_min, base_task_count) AS (
  SELECT 9,  '빠른 업무',   '입금',              'LEVEL_1', 5,  5 UNION ALL
  SELECT 9,  '상담 업무',   '적금',              'LEVEL_2', 10, 5 UNION ALL
  SELECT 10, '빠른 업무',   '출금',              'LEVEL_1', 5,  10 UNION ALL
  SELECT 10, '상담 업무',   '예금',              'LEVEL_2', 10, 10 UNION ALL
  SELECT 11, '빠른 업무',   '이체',              'LEVEL_2', 5,  6 UNION ALL
  SELECT 11, '상담 업무',   '신용대출',          'LEVEL_3', 10, 6 UNION ALL
  SELECT 11, '기업 • 특수', '기업대출',          'LEVEL_5', 25, 6 UNION ALL
  SELECT 12, '빠른 업무',   '카드수령',          'LEVEL_1', 5,  6 UNION ALL
  SELECT 12, '상담 업무',   '대출 상환',         'LEVEL_2', 10, 3 UNION ALL
  SELECT 13, '빠른 업무',   '입출금 계좌개설',   'LEVEL_2', 5,  8 UNION ALL
  SELECT 13, '상담 업무',   '금융상품가입',      'LEVEL_3', 10, 4 UNION ALL
  SELECT 13, '기업 • 특수', '법인계좌 개설',     'LEVEL_5', 25, 4 UNION ALL
  SELECT 14, '빠른 업무',   '체크카드 발급',     'LEVEL_2', 5,  4 UNION ALL
  SELECT 14, '상담 업무',   '주택담보대출',      'LEVEL_4', 10, 5 UNION ALL
  SELECT 14, '기업 • 특수', '법인카드 발급',     'LEVEL_5', 25, 8 UNION ALL
  SELECT 15, '빠른 업무',   '통장 비밀번호 변경', 'LEVEL_2', 5,  6 UNION ALL
  SELECT 15, '상담 업무',   '전세자금대출',      'LEVEL_4', 10, 8 UNION ALL
  SELECT 15, '기업 • 특수', '연체관리',          'LEVEL_5', 25, 10 UNION ALL
  SELECT 16, '빠른 업무',   '입금',              'LEVEL_1', 5,  5 UNION ALL
  SELECT 16, '상담 업무',   '신용카드 발급',     'LEVEL_2', 10, 6 UNION ALL
  SELECT 16, '기업 • 특수', '부도관리',          'LEVEL_5', 25, 5 UNION ALL
  SELECT 17, '빠른 업무',   '출금',              'LEVEL_1', 5,  4 UNION ALL
  SELECT 17, '상담 업무',   '예금',              'LEVEL_2', 10, 2 UNION ALL
  SELECT 17, '기업 • 특수', '기업대출',          'LEVEL_5', 25, 2
),
expanded AS (
  SELECT
    bd.work_date,
    p.hour_value,
    p.task_type,
    p.task_detail_type,
    p.assigned_level,
    p.processing_min,
    s.n AS seq_no,
    ROW_NUMBER() OVER (ORDER BY bd.work_date, p.hour_value, p.task_type, s.n) AS global_seq
  FROM business_days bd
  JOIN profiles p
  JOIN seq s ON s.n <= GREATEST(1, CAST(ROUND(p.base_task_count * bd.day_factor) AS UNSIGNED))
)
SELECT
  cp.id AS `user_id`,
  CONCAT('DCG', DATE_FORMAT(e.work_date, '%y%m%d'), LPAD(e.global_seq, 5, '0')) AS `ticket_number`,
  e.task_type AS `task_type`,
  e.task_detail_type AS `task_detail_type`,
  e.assigned_level AS `assigned_level`,
  0 AS `expected_waiting_time`,
  'COMPLETED' AS `status`,
  1 + MOD(e.global_seq, 5) AS `member_id`,
  NULL AS `ranking`,
  TIMESTAMP(e.work_date, MAKETIME(e.hour_value, MOD(e.seq_no * 7, 60), 0)) AS `created_at`,
  DATE_ADD(
    TIMESTAMP(e.work_date, MAKETIME(e.hour_value, MOD(e.seq_no * 7, 60), 0)),
    INTERVAL e.processing_min MINUTE
  ) AS `updated_at`,
  0 AS `is_ai`
FROM expanded e
JOIN customer_pool cp ON cp.rn = 1 + MOD(e.global_seq - 1, cp.total)
ORDER BY e.global_seq;
