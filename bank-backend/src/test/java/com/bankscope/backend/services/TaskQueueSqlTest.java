package com.bankscope.backend.services;

import com.bankscope.backend.dtos.TaskTransferRequest;
import com.bankscope.backend.dtos.TaskRequestDto;
import com.bankscope.backend.entities.MemberEntity;
import com.bankscope.backend.entities.TaskEntity;
import com.bankscope.backend.entities.UserEntity;
import com.bankscope.backend.mappers.TaskMapper;
import com.bankscope.backend.results.TaskResult;
import com.bankscope.backend.vos.TaskVo;
import org.apache.ibatis.builder.xml.XMLMapperBuilder;
import org.apache.ibatis.datasource.unpooled.UnpooledDataSource;
import org.apache.ibatis.mapping.Environment;
import org.apache.ibatis.session.Configuration;
import org.apache.ibatis.session.SqlSession;
import org.apache.ibatis.session.SqlSessionFactoryBuilder;
import org.apache.ibatis.transaction.jdbc.JdbcTransactionFactory;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

import java.sql.Connection;
import java.io.StringReader;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/** Opt-in MySQL checks. Writes stay in a uniquely named disposable schema, never application rows. */
@EnabledIfEnvironmentVariable(named = "BANK_QUEUE_TEST_URL", matches = ".+")
class TaskQueueSqlTest {
    private static final LocalDateTime RECEPTION_DAY = LocalDateTime.now().minusDays(1).toLocalDate().atStartOfDay();
    private SqlSession session;
    private Connection connection;
    private TaskMapper mapper;
    private TaskService service;
    private org.apache.ibatis.session.SqlSessionFactory sessionFactory;
    private final String schema = "bankscope_queue_test_" + UUID.randomUUID().toString().replace("-", "");
    private boolean schemaCreated;
    private final MemberEntity actor = MemberEntity.builder().id(1L).level(4).status(1).counterNumber(1).build();

    @BeforeEach void setup() throws Exception {
        var dataSource = new UnpooledDataSource("com.mysql.cj.jdbc.Driver",
                System.getenv("BANK_QUEUE_TEST_URL"), System.getenv("BANK_QUEUE_TEST_USER"),
                System.getenv("BANK_QUEUE_TEST_PASSWORD"));
        var config = new Configuration(new Environment("queue-test", new JdbcTransactionFactory(), dataSource));
        try (var input = getClass().getResourceAsStream("/mappers/TaskMapper.xml")) {
            assertNotNull(input);
            String xml = inTestSchema(new String(input.readAllBytes(), StandardCharsets.UTF_8));
            new XMLMapperBuilder(new StringReader(xml), config, "mappers/TaskMapper.xml", config.getSqlFragments()).parse();
        }
        sessionFactory = new SqlSessionFactoryBuilder().build(config);
        session = sessionFactory.openSession(false);
        connection = session.getConnection();
        raw("CREATE DATABASE `" + schema + "` CHARACTER SET utf8mb4");
        schemaCreated = true;
        raw("CREATE TABLE `" + schema + "`.task LIKE bank.task");
        try (var statement = connection.createStatement();
             var columns = statement.executeQuery(inTestSchema("SHOW COLUMNS FROM bank.task LIKE 'priority_transferred_at'"))) {
            if (!columns.next()) execute("ALTER TABLE bank.task ADD COLUMN priority_transferred_at DATETIME(6) NULL");
        }
        raw("CREATE TABLE `" + schema + "`.task_processing_log LIKE bank.task_processing_log");
        raw("CREATE TABLE `" + schema + "`.task_transfer_log LIKE bank.task_transfer_log");
        try (var input = getClass().getResourceAsStream("/db/migration/V8__daily_numeric_ticket_numbers.sql")) {
            assertNotNull(input);
            for (String sql : new String(input.readAllBytes(), StandardCharsets.UTF_8).split(";")) {
                if (!sql.isBlank()) execute(sql);
            }
        }
        execute("CREATE TABLE bank.member (id INT PRIMARY KEY, name VARCHAR(30), level INT, status INT, counter_number INT)");
        execute("CREATE TABLE bank.user (id INT PRIMARY KEY, name VARCHAR(30), grade VARCHAR(30), gender VARCHAR(30), age VARCHAR(30))");
        execute("INSERT INTO bank.member VALUES (1, 'source', 4, 1, 1), (2, 'target', 4, 1, 2), (3, 'empty', 4, 1, 3)");
        mapper = session.getMapper(TaskMapper.class);
        service = new TaskService(mapper);
    }

    @AfterEach void cleanup() throws Exception {
        if (session == null) return;
        try {
            session.rollback();
            if (schemaCreated) {
                assertTrue(schema.matches("bankscope_queue_test_[0-9a-f]{32}"));
                raw("DROP DATABASE `" + schema + "`");
            }
        } finally { session.close(); }
    }

    private String inTestSchema(String sql) {
        return sql.replace("`bank`.", "`" + schema + "`.").replace("bank.", "`" + schema + "`.");
    }

    private void raw(String sql) throws Exception {
        try (var statement = connection.createStatement()) { statement.execute(sql); }
        if (session != null) session.clearCache();
    }

    private void execute(String sql) throws Exception { raw(inTestSchema(sql)); }

    private String historical(String timestamp) {
        return timestamp == null ? null : timestamp.replace("2026-09-15", RECEPTION_DAY.toLocalDate().toString());
    }

    private void task(long id, int member, String status, String created, String priority, boolean consultation) throws Exception {
        try (var statement = connection.prepareStatement(inTestSchema("""
                INSERT INTO bank.task (task_id, user_id, member_id, ticket_number, task_type, task_detail_type,
                    assigned_level, status, created_at, updated_at, expected_waiting_time, ranking, is_ai, priority_transferred_at)
                VALUES (?, 987654321, ?, ?, ?, ?, ?, ?, ?, ?, 999, 999, 0, ?)
                """))) {
            statement.setLong(1, id); statement.setInt(2, member); statement.setString(3, "QA-" + id);
            statement.setString(4, consultation ? "상담 업무" : "빠른 업무");
            statement.setString(5, consultation ? "예금" : "입금");
            statement.setString(6, consultation ? "LEVEL_3" : "LEVEL_1");
            statement.setString(7, status); statement.setString(8, historical(created)); statement.setString(9, historical(created));
            statement.setString(10, historical(priority)); statement.executeUpdate();
        }
        session.clearCache();
    }

    private void receivingQueue() throws Exception {
        task(100, 2, "IN_PROGRESS", "2026-09-15 10:30:00", null, true);
        task(101, 2, "WAITING", "2026-09-15 09:00:00", null, false);
        task(102, 2, "WAITING", "2026-09-15 09:10:00", null, false);
        task(103, 2, "WAITING", "2026-09-15 10:00:00", "2026-09-15 10:40:00", false);
    }

    private List<Long> order(int member) {
        return mapper.selectTasksByMemberId(member).stream().filter(t -> List.of("WAITING", "CALLED", "IN_PROGRESS").contains(t.getStatus()))
                .map(TaskVo::getTaskId).toList();
    }

    private void position(long id, int rank, int minutes) {
        var task = mapper.getTask(id);
        assertEquals(rank, task.getRanking(), "position of " + id);
        assertEquals(minutes, task.getExpectedWaitingTime(), "wait of " + id);
    }

    @Test void noShowLeavesQueueAndAllowsReceptionAgainWithoutCountingAsCompleted() throws Exception {
        receivingQueue();
        execute("UPDATE bank.task SET created_at = NOW(), status = 'CALLED' WHERE task_id = 103");
        var receiver = MemberEntity.builder().id(2L).level(4).status(1).counterNumber(2).build();
        assertEquals(TaskResult.SUCCESS, service.updateTaskStatus(receiver, 103L, "NO_SHOW"));
        assertEquals(List.of(100L, 101L, 102L), order(2));
        position(101, 1, 10);
        assertEquals(0, ((Number) mapper.selectBranchTotalStats().get("totalCompleted")).intValue());
        execute("UPDATE bank.task SET user_id = 777 WHERE task_id = 103");
        var request = new TaskRequestDto();
        request.setTaskType("빠른 업무"); request.setTaskDetailType("입금");
        assertEquals(TaskResult.SUCCESS, service.createTask(request, 777));
        // DATETIME stores seconds. A new reception in the same second must win the tie.
        execute("UPDATE bank.task old JOIN bank.task newer ON newer.user_id = old.user_id AND newer.status = 'WAITING' SET old.created_at = newer.created_at WHERE old.task_id = 103");
        assertEquals("WAITING", mapper.selectLatestTaskByUserId(777).getStatus());
    }

    @Test void directReceptionSharesOneNumericSeriesAcrossTaskTypesAndKeepsLegacyTickets() throws Exception {
        task(104, 1, "COMPLETED", "2026-09-15 08:00:00", null, false);
        execute("UPDATE bank.task SET ticket_number = 'A-001' WHERE task_id = 104");
        String[] details = {"입금", "예금", "기업대출"};
        String[] types = {"빠른 업무", "상담 업무", "기업 • 특수"};
        for (int i = 0; i < details.length; i++) {
            var request = new TaskRequestDto();
            request.setTaskType(types[i]); request.setTaskDetailType(details[i]);
            assertEquals(TaskResult.SUCCESS, service.createTask(request, 800 + i));
            assertEquals(String.valueOf(i + 1), mapper.selectLatestTaskByUserId(800 + i).getTicketNumber());
        }
        assertEquals("A-001", mapper.getTask(104L).getTicketNumber());
    }

    @Test void callRecallArrivalAndCloseKeepDisplayAndQueueConsistent() throws Exception {
        task(201, 1, "WAITING", "2026-09-15 09:00:00", null, false);
        task(202, 1, "WAITING", "2026-09-15 09:10:00", null, false);
        assertEquals(TaskResult.SUCCESS, service.updateTaskStatus(actor, 201L, "CALLED"));
        assertEquals(List.of(201L, 202L), order(1));
        assertThrows(org.springframework.web.server.ResponseStatusException.class,
                () -> service.reassignTasksOnMemberLogout(1L));
        assertEquals(1, mapper.selectMemberForUpdate(1).getStatus());
        position(202, 1, 5);
        assertEquals(10, mapper.selectMemberTotalWaitTime(1));
        assertEquals(TaskResult.FAILURE_TASK_IN_PROGRESS, service.updateTaskStatus(actor, 202L, "CALLED"));
        var display = service.getQueueDisplay();
        assertEquals(5, display.size());
        assertEquals(java.util.Set.of("ticketNumber", "counterNumber", "status", "callId"), display.get(0).keySet());
        assertEquals("QA-201", display.get(0).get("ticketNumber"));
        long firstCall = ((Number) display.get(0).get("callId")).longValue();
        assertEquals(TaskResult.SUCCESS, service.recallTask(actor, 201L));
        long recall = ((Number) service.getQueueDisplay().get(0).get("callId")).longValue();
        assertTrue(recall > firstCall);
        assertEquals(TaskResult.SUCCESS, service.updateTaskStatus(actor, 201L, "IN_PROGRESS"));
        assertEquals("IN_PROGRESS", service.getQueueDisplay().get(0).get("status"));
        assertEquals(recall, ((Number) service.getQueueDisplay().get(0).get("callId")).longValue());
        assertEquals(TaskResult.SUCCESS, service.updateTaskStatus(actor, 201L, "COMPLETED"));
        assertEquals("WAITING", service.getQueueDisplay().get(0).get("status"));
        assertEquals("", service.getQueueDisplay().get(0).get("ticketNumber"));
        position(202, 1, 0);
        assertEquals(TaskResult.SUCCESS, service.updateTaskStatus(actor, 202L, "CALLED"));
        assertEquals(TaskResult.SUCCESS, service.updateTaskStatus(actor, 202L, "NO_SHOW"));
        assertEquals("WAITING", service.getQueueDisplay().get(0).get("status"));
        assertEquals("", service.getQueueDisplay().get(0).get("ticketNumber"));
        assertEquals(1, ((Number) mapper.selectBranchTotalStats().get("totalCompleted")).intValue());
        task(203, 1, "WAITING", "2026-09-15 09:20:00", null, false);
        service.reassignTasksOnMemberLogout(1L);
        assertEquals(0, mapper.selectMemberForUpdate(1).getStatus());
        assertNotEquals(1, mapper.getTask(203L).getMemberId());
        assertEquals("WAITING", mapper.getTask(203L).getStatus());
    }

    @Test void displayKeepsFiveOrderedCountersWhenIdleOffDutyOrUnstaffed() throws Exception {
        var display = service.getQueueDisplay();
        assertEquals(List.of(1, 2, 3, 4, 5), display.stream()
                .map(row -> ((Number) row.get("counterNumber")).intValue()).toList());
        assertEquals(List.of("WAITING", "WAITING", "WAITING", "OFFLINE", "OFFLINE"), display.stream()
                .map(row -> row.get("status")).toList());
        assertTrue(display.stream().allMatch(row -> "".equals(row.get("ticketNumber"))));

        // Existing consultations remain visible even if they predate call logging.
        task(201, 1, "IN_PROGRESS", "2026-09-15 09:00:00", null, false);
        task(202, 2, "IN_PROGRESS", "2026-09-15 09:10:00", null, false);
        execute("UPDATE bank.member SET status = 0 WHERE id = 2");
        display = service.getQueueDisplay();
        assertEquals("IN_PROGRESS", display.get(0).get("status"));
        assertEquals("QA-201", display.get(0).get("ticketNumber"));
        assertEquals(0, ((Number) display.get(0).get("callId")).intValue());
        assertEquals("OFFLINE", display.get(1).get("status"));
        assertEquals("", display.get(1).get("ticketNumber"));
        assertTrue(display.stream().allMatch(row -> row.keySet().equals(
                java.util.Set.of("ticketNumber", "counterNumber", "status", "callId"))));

        execute("UPDATE bank.member SET status = 0");
        assertEquals(5, service.getQueueDisplay().size());
        assertTrue(service.getQueueDisplay().stream().allMatch(row -> "OFFLINE".equals(row.get("status"))));
    }

    @Test void calledCustomerCannotReceiveAnotherTicketOrBeTransferredBeforeConsultation() throws Exception {
        task(201, 1, "WAITING", "2026-09-15 09:00:00", null, false);
        assertEquals(TaskResult.SUCCESS, service.updateTaskStatus(actor, 201L, "CALLED"));
        var request = new TaskRequestDto(); request.setTaskType("빠른 업무"); request.setTaskDetailType("입금");
        assertEquals(TaskResult.FAILURE_TASK_PLURAL, service.createTask(request, 987654321));
        assertEquals(TaskResult.FAILURE_INVALID_STATUS, service.tossTask(actor,
                new TaskTransferRequest(201L, 2, "예금", "도착 전 이관")));
        assertEquals(TaskResult.SUCCESS, service.updateTaskStatus(actor, 201L, "IN_PROGRESS"));
        assertEquals(TaskResult.SUCCESS, service.tossTask(actor, new TaskTransferRequest(201L, 2, "예금", "상담 후 이관")));
        assertEquals("WAITING", service.getQueueDisplay().get(0).get("status"));
        assertEquals("", service.getQueueDisplay().get(0).get("ticketNumber"));
        var receiver = MemberEntity.builder().id(2L).status(1).level(4).counterNumber(2).build();
        assertEquals(TaskResult.SUCCESS, service.updateTaskStatus(receiver, 201L, "CALLED"));
        assertEquals(2, ((Number) service.getQueueDisplay().get(1).get("counterNumber")).intValue());
        assertEquals("QA-201", service.getQueueDisplay().get(1).get("ticketNumber"));
        assertEquals("CALLED", service.getQueueDisplay().get(1).get("status"));
        assertEquals("WAITING", service.getQueueDisplay().get(0).get("status"));
    }

    @Test void simultaneousCallsAtSameCounterOnlyCallOneCustomer() throws Exception {
        task(201, 1, "WAITING", "2026-09-15 09:00:00", null, false);
        task(202, 1, "WAITING", "2026-09-15 09:10:00", null, false);
        session.commit(true); // Fixture inserts use raw JDBC, so MyBatis has no dirty flag.
        var pool = java.util.concurrent.Executors.newFixedThreadPool(2);
        var ready = new java.util.concurrent.CountDownLatch(2);
        var start = new java.util.concurrent.CountDownLatch(1);
        try {
            var futures = new java.util.ArrayList<java.util.concurrent.Future<TaskResult>>();
            for (long id : new long[]{201L, 202L}) {
                futures.add(pool.submit(() -> {
                    try (var worker = sessionFactory.openSession(false)) {
                        ready.countDown();
                        if (!start.await(5, java.util.concurrent.TimeUnit.SECONDS)) throw new IllegalStateException("Call test did not start");
                        var result = new TaskService(worker.getMapper(TaskMapper.class)).updateTaskStatus(actor, id, "CALLED");
                        worker.commit();
                        return result;
                    }
                }));
            }
            assertTrue(ready.await(5, java.util.concurrent.TimeUnit.SECONDS));
            start.countDown();
            var results = new java.util.ArrayList<TaskResult>();
            for (var future : futures) results.add(future.get(10, java.util.concurrent.TimeUnit.SECONDS));
            assertEquals(1, results.stream().filter(r -> r == TaskResult.SUCCESS).count());
            assertEquals(1, results.stream().filter(r -> r == TaskResult.FAILURE_TASK_IN_PROGRESS).count());
            assertEquals(1, service.getQueueDisplay().stream().filter(row -> "CALLED".equals(row.get("status"))).count());
        } finally {
            start.countDown();
            pool.shutdownNow();
            assertTrue(pool.awaitTermination(10, java.util.concurrent.TimeUnit.SECONDS));
        }
    }

    @Test void consultationTransferFollowsOngoingAndEarlierTransfersBeforeOrdinaryQueue() throws Exception {
        receivingQueue();
        task(104, 1, "IN_PROGRESS", "2026-09-15 08:00:00", null, false);
        assertEquals(TaskResult.SUCCESS, service.tossTask(actor,
                new TaskTransferRequest(104L, 2, "예금", "상담 후 이관")));
        assertEquals(List.of(100L, 103L, 104L, 101L, 102L), order(2));
        position(103, 1, 10); position(104, 2, 15); position(101, 3, 25); position(102, 4, 30);
        assertTrue(mapper.getTask(104L).getPriorityTransfer());
        assertEquals("QA-104", mapper.getTask(104L).getTicketNumber());
        assertEquals(RECEPTION_DAY.plusHours(8), mapper.selectTaskForUpdate(104L).getCreatedAt());
    }

    @Test void waitingStaffTransferIsRejectedAndAdminReassignmentDoesNotCreatePriority() throws Exception {
        receivingQueue();
        task(104, 1, "WAITING", "2026-09-15 09:05:00", null, false);
        assertEquals(TaskResult.FAILURE_INVALID_STATUS, service.tossTask(actor,
                new TaskTransferRequest(104L, 2, "입금", "상담 전 재배정")));
        assertEquals(1, mapper.getTask(104L).getMemberId());
        assertEquals("WAITING", mapper.getTask(104L).getStatus());
        assertFalse(mapper.getTask(104L).getPriorityTransfer());
        UserEntity admin = new UserEntity(); admin.setId(99); admin.setUserType("admin");
        assertEquals(TaskResult.SUCCESS, service.tossTaskByAdmin(admin, 104L, 2));
        assertEquals(List.of(100L, 103L, 101L, 104L, 102L), order(2));
        assertFalse(mapper.getTask(104L).getPriorityTransfer());
        position(104, 3, 20);
        task(105, 1, "IN_PROGRESS", "2026-09-15 09:07:00", null, false);
        assertEquals(TaskResult.SUCCESS, service.tossTaskByAdmin(admin, 105L, 2));
        assertFalse(mapper.getTask(105L).getPriorityTransfer());
        assertEquals(List.of(100L, 103L, 101L, 104L, 105L, 102L), order(2));
    }

    @Test void busyStaffRemainEligibleAndUnavailableRecipientsAreFilteredAndRechecked() throws Exception {
        receivingQueue();
        task(104, 1, "IN_PROGRESS", "2026-09-15 08:00:00", null, false);
        execute("INSERT INTO bank.member VALUES (4, 'off-duty', 4, 0, 4), (5, 'no-counter', 4, 1, 0), (6, 'junior', 1, 1, 6)");
        assertEquals(List.of(2, 3), service.getTransferCandidates(actor, 104L, "예금").stream()
                .map(row -> ((Number) row.get("id")).intValue()).sorted().toList());

        // The chosen employee goes off duty after the candidate list was opened.
        execute("UPDATE bank.member SET status = 0 WHERE id = 2");
        assertEquals(TaskResult.FAILURE_TARGET_UNAVAILABLE, service.tossTask(actor,
                new TaskTransferRequest(104L, 2, "예금", "상담 후 이관")));
        var unchanged = mapper.getTask(104L);
        assertEquals(1, unchanged.getMemberId());
        assertEquals("IN_PROGRESS", unchanged.getStatus());
        assertFalse(unchanged.getPriorityTransfer());
        assertEquals(List.of(3), service.getTransferCandidates(actor, 104L, "예금").stream()
                .map(row -> ((Number) row.get("id")).intValue()).toList());
    }

    @Test void customerAndStaffReadersReflectCompletionAndTransferAway() throws Exception {
        receivingQueue();
        position(101, 2, 15);
        execute("UPDATE bank.task SET status = 'COMPLETED', user_id = 987654322 WHERE task_id = 100");
        position(101, 2, 5);
        execute("UPDATE bank.task SET member_id = 3 WHERE task_id = 103");
        position(101, 1, 0); position(102, 2, 5); position(103, 1, 0);
        for (var tasks : List.of(mapper.selectTasksByUserId(987654321), mapper.selectTasksByMemberId(2),
                mapper.selectTasksByMemberLevel(2, 4))) {
            var normal = tasks.stream().filter(t -> t.getTaskId() == 101L).findFirst().orElseThrow();
            assertEquals(1, normal.getRanking()); assertEquals(0, normal.getExpectedWaitingTime());
        }
        assertEquals(1, mapper.selectLatestTaskByUserId(987654321).getRanking());
        assertEquals(1, mapper.selectWaitingTasksByUserId(987654321).stream()
                .filter(t -> t.getTaskId() == 101L).findFirst().orElseThrow().getRanking());
        assertNotNull(mapper.selectAverageTime());
    }

    @Test void simultaneousTimestampHasDeterministicOrderAndEmptyCounterHasNoWait() throws Exception {
        task(201, 2, "WAITING", "2026-09-15 10:00:00", "2026-09-15 10:40:00.123456", false);
        task(202, 2, "WAITING", "2026-09-15 09:00:00", "2026-09-15 10:40:00.123456", false);
        assertEquals(List.of(201L, 202L), order(2));
        position(201, 1, 0); position(202, 2, 5);
        task(203, 1, "IN_PROGRESS", "2026-09-15 08:00:00", null, false);
        assertEquals(TaskResult.SUCCESS, service.tossTask(actor,
                new TaskTransferRequest(203L, 3, "입금", "상담 후 이관")));
        position(203, 1, 0);
    }

    @Test void newReceptionEstimateAndPriorityCancellationRemainConsistent() throws Exception {
        receivingQueue();
        assertEquals(25, mapper.selectMemberTotalWaitTime(2));
        TaskEntity incoming = TaskEntity.builder().taskId(999L).memberId(2)
                .createdAt(RECEPTION_DAY.plusHours(11)).build();
        var queue = mapper.selectQueueBeforeTask(incoming);
        assertEquals(3, ((Number) queue.get("waitingCount")).intValue());
        assertEquals(25, ((Number) queue.get("waitingMinutes")).intValue());
        var receiver = MemberEntity.builder().id(2L).level(4).status(1).counterNumber(2).build();
        assertEquals(TaskResult.SUCCESS, service.updateTaskStatus(receiver, 100L, "COMPLETED"));
        assertEquals(TaskResult.SUCCESS, service.updateTaskStatus(receiver, 103L, "CALLED"));
        assertEquals(TaskResult.SUCCESS, service.updateTaskStatus(receiver, 103L, "IN_PROGRESS"));
        assertEquals(TaskResult.SUCCESS, service.updateTaskStatus(receiver, 103L, "WAITING"));
        assertTrue(mapper.getTask(103L).getPriorityTransfer());
        assertEquals(List.of(103L, 101L, 102L), order(2));
    }
}
