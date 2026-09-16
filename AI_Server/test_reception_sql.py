"""Opt-in MySQL checks using isolated schemas, never application rows."""
import os
import unittest
import uuid
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urlparse

import mysql.connector
from ticket_numbers import allocate_ticket_number
from RF import CONFIRMED_TASK_QUERY

ROOT = Path(__file__).resolve().parent.parent


@unittest.skipUnless(os.getenv('BANK_QUEUE_TEST_URL'), 'BANK_QUEUE_TEST_URL is required')
class ReceptionSqlTests(unittest.TestCase):
    def setUp(self):
        url = urlparse(os.environ['BANK_QUEUE_TEST_URL'].removeprefix('jdbc:'))
        self.config = dict(host=url.hostname, port=url.port or 3306,
                           user=os.environ['BANK_QUEUE_TEST_USER'], password=os.environ['BANK_QUEUE_TEST_PASSWORD'])
        self.schema = 'bankscope_ticket_test_' + uuid.uuid4().hex
        self.conn = mysql.connector.connect(**self.config)
        self.addCleanup(self.conn.close)
        self.cursor = self.conn.cursor(dictionary=True)
        self.addCleanup(self.cursor.close)
        self.cursor.execute(f'CREATE DATABASE `{self.schema}` CHARACTER SET utf8mb4')
        self.addCleanup(self.drop_schema)
        self.conn.database = self.schema
        self.cursor.execute(f'CREATE TABLE `{self.schema}`.task LIKE bank.task')
        self.cursor.execute(f'CREATE TABLE `{self.schema}`.task_processing_log LIKE bank.task_processing_log')
        self.migrate()
        self.conn.commit()
        mapper = ET.parse(ROOT / 'bank-backend/src/main/resources/mappers/TaskMapper.xml').getroot()
        self.spring_sql = {node.get('id'): ''.join(node.itertext()).replace('`bank`.', '').replace('#{ticketDate}', '%s')
                           for node in mapper if node.get('id') in (
                               'selectTicketIssueTime', 'incrementDailyTicketNumber', 'selectDailyTicketNumber')}

    def drop_schema(self):
        self.conn.rollback()
        if not self.schema.startswith('bankscope_ticket_test_') or len(self.schema.removeprefix('bankscope_ticket_test_')) != 32:
            raise AssertionError('Unexpected test schema')
        self.cursor.execute(f'DROP DATABASE `{self.schema}`')

    def migrate(self):
        sql = (ROOT / 'bank-backend/src/main/resources/db/migration/V8__daily_numeric_ticket_numbers.sql').read_text(encoding='utf-8')
        for statement in sql.replace('`bank`.', '').split(';'):
            if statement.strip():
                self.cursor.execute(statement)

    def issue(self, use_spring_sql=False):
        conn = mysql.connector.connect(**self.config, database=self.schema)
        cursor = conn.cursor(dictionary=True)
        try:
            if use_spring_sql:
                cursor.execute(self.spring_sql['selectTicketIssueTime'])
                issued_at = next(iter(cursor.fetchone().values()))
                cursor.execute(self.spring_sql['incrementDailyTicketNumber'], (issued_at.date(),))
                cursor.execute(self.spring_sql['selectDailyTicketNumber'], (issued_at.date(),))
                number = str(cursor.fetchone()['last_number'])
            else:
                number, issued_at = allocate_ticket_number(cursor)
            conn.commit()
            return number
        finally:
            cursor.close()
            conn.close()

    def test_python_and_spring_sql_share_counter_under_concurrent_reception(self):
        with ThreadPoolExecutor(max_workers=6) as executor:
            numbers = list(executor.map(self.issue, [bool(i % 2) for i in range(18)]))
        self.assertEqual(sorted(map(int, numbers)), list(range(1, 19)))

    def test_today_starts_at_one_and_restart_continues_after_999(self):
        self.cursor.execute('INSERT INTO task_ticket_sequence VALUES (CURDATE() - INTERVAL 1 DAY, 700)')
        self.conn.commit()
        self.assertEqual(self.issue(), '1')
        self.cursor.execute('UPDATE task_ticket_sequence SET last_number = 999 WHERE ticket_date = CURDATE()')
        self.conn.commit()
        self.assertEqual(self.issue(True), '1000')
        self.assertEqual(self.issue(), '1001')

    def test_rollback_does_not_consume_a_committed_ticket_number(self):
        number, _ = allocate_ticket_number(self.cursor)
        self.assertEqual(number, '1')
        self.conn.rollback()
        self.assertEqual(self.issue(True), '1')
        self.assertEqual(self.issue(), '2')

    def test_migration_keeps_legacy_tickets_and_continues_existing_numeric_tickets(self):
        self.cursor.execute('DROP TABLE task_ticket_sequence')
        for number in ('A-001', 'B-001', '99'):
            self.cursor.execute("INSERT INTO task (user_id, ticket_number, task_type, task_detail_type, created_at) VALUES (1, %s, '빠른 업무', '입금', NOW())", (number,))
        self.conn.commit()
        self.migrate()
        self.conn.commit()
        self.assertEqual(self.issue(), '100')
        self.cursor.execute('SELECT ticket_number FROM task ORDER BY task_id')
        self.assertEqual([row['ticket_number'] for row in self.cursor.fetchall()], ['A-001', 'B-001', '99'])

    def test_closure_and_no_show_cannot_turn_transfer_confirmation_into_training_label(self):
        for task_id, status, action, note in (
            (701, 'COMPLETED', 'CLOSE', '업무 종료'),
            (702, 'NO_SHOW', 'NO_SHOW', '미방문으로 접수 종료'),
            (703, 'COMPLETED', 'COMPLETE', '실제 처리 업무 확인: 입금'),
        ):
            self.cursor.execute("""
                INSERT INTO task (task_id, user_id, ticket_number, task_type, task_detail_type, status,
                    created_at, confirmed_task_detail_type, confirmed_by, confirmed_at, feature_snapshot, feature_snapshot_at)
                VALUES (%s, 1, %s, '빠른 업무', '입금', %s, NOW(), '입금', 1, NOW(), '{}', NOW())
                """, (task_id, str(task_id), status))
            self.cursor.execute('INSERT INTO task_processing_log (task_id, member_id, action_type, processing_note) VALUES (%s, 1, %s, %s)',
                                (task_id, action, note))
        self.cursor.execute(CONFIRMED_TASK_QUERY)
        self.assertEqual([row['task_id'] for row in self.cursor.fetchall()], [703])


if __name__ == '__main__':
    unittest.main()
