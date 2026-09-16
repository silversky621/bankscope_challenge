package com.bankscope.backend.services;

import com.bankscope.backend.dtos.TaskTransferRequest;
import com.bankscope.backend.entities.MemberEntity;
import com.bankscope.backend.entities.TaskEntity;
import com.bankscope.backend.entities.UserEntity;
import com.bankscope.backend.mappers.TaskMapper;
import com.bankscope.backend.results.TaskResult;
import com.bankscope.backend.vos.TaskVo;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDateTime;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class TaskServiceTest {
    private final TaskMapper mapper = mock(TaskMapper.class);
    private final TaskService service = new TaskService(mapper);
    private final MemberEntity actor = MemberEntity.builder().id(1L).level(1).status(1).counterNumber(1).build();
    private TaskEntity task;

    @BeforeEach void setup() {
        task = TaskEntity.builder().taskId(7L).userId(21).memberId(1).ticketNumber("A-012")
                .taskType("빠른 업무").taskDetailType("카드수령").predictedTaskDetailType("카드수령")
                .assignedLevel("LEVEL_1").status("IN_PROGRESS").isAi(true)
                .createdAt(LocalDateTime.of(2026, 9, 14, 10, 0)).build();
        when(mapper.selectTaskForUpdate(7L)).thenReturn(task);
        when(mapper.selectOtherActiveTaskForUpdate(anyInt(), anyLong())).thenReturn(null);
    }

    private void successfulWrites() {
        when(mapper.selectQueueBeforeTask(any())).thenReturn(Map.of("waitingCount", 2, "waitingMinutes", 15));
        when(mapper.transferTask(any())).thenReturn(1);
        when(mapper.updateTaskOutcome(any())).thenReturn(1);
        when(mapper.insertTransferLog(anyLong(), any(), anyInt(), any(), any(), anyString(), anyString(), anyString())).thenReturn(1);
        when(mapper.insertTaskAction(anyLong(), anyInt(), anyString(), anyString())).thenReturn(1);
    }

    private MemberEntity target(int level, int status, int counter) {
        return MemberEntity.builder().id(2L).name("받는 직원").level(level).status(status).counterNumber(counter).build();
    }

    @Test void transferDuringConsultationCorrectsPurposeAndPreservesReception() {
        successfulWrites();
        when(mapper.selectMemberForUpdate(2)).thenReturn(target(4, 1, 2));
        LocalDateTime reception = task.getCreatedAt();
        assertEquals(TaskResult.SUCCESS, service.tossTask(actor, new TaskTransferRequest(7L, 2, "주택담보대출", "  실제 대출 상담 요청  ")));
        assertEquals("주택담보대출", task.getTaskDetailType());
        assertEquals("상담 업무", task.getTaskType());
        assertEquals("LEVEL_4", task.getAssignedLevel());
        assertEquals("주택담보대출", task.getConfirmedTaskDetailType());
        assertEquals(1, task.getConfirmedBy());
        assertNotNull(task.getConfirmedAt());
        assertEquals("카드수령", task.getPredictedTaskDetailType());
        assertEquals("A-012", task.getTicketNumber());
        assertEquals(reception, task.getCreatedAt());
        assertEquals("WAITING", task.getStatus());
        assertEquals(2, task.getMemberId());
        assertEquals(3, task.getRanking());
        assertEquals(15, task.getExpectedWaitingTime());
        assertNotNull(task.getPriorityTransferredAt());
        verify(mapper).insertTransferLog(7L, 1, 2, 1, null, "카드수령", "주택담보대출", "실제 대출 상담 요청");
    }

    @ParameterizedTest @CsvSource({"WAITING", "CALLED"})
    void rejectsTransferBeforeAcceptance(String status) {
        task.setStatus(status);
        assertEquals(TaskResult.FAILURE_INVALID_STATUS, service.tossTask(actor,
                new TaskTransferRequest(7L, 2, "주택담보대출", "상담 전 창구 변경")));
        assertNull(task.getPriorityTransferredAt());
        assertEquals(1, task.getMemberId());
        assertEquals(status, task.getStatus());
        verify(mapper, never()).transferTask(any());

    }

    @ParameterizedTest @CsvSource({"WAITING", "CALLED"})
    void cannotLoadTransferCandidatesBeforeAcceptance(String status) {
        when(mapper.getTask(7L)).thenReturn(TaskVo.builder().taskId(7L).memberId(1).status(status).build());
        var error = assertThrows(ResponseStatusException.class,
                () -> service.getTransferCandidates(actor, 7L, "예금"));
        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
        verify(mapper, never()).selectTransferCandidates(anyInt(), anyInt());
    }

    @Test void existingPrioritySurvivesReassignmentAndJoinsReceivingPriorityQueue() {
        successfulWrites();
        when(mapper.selectMemberForUpdate(2)).thenReturn(target(4, 1, 2));
        task.setStatus("WAITING");
        LocalDateTime previousTransfer = LocalDateTime.now().minusDays(1);
        task.setPriorityTransferredAt(previousTransfer);
        UserEntity admin = new UserEntity(); admin.setId(99); admin.setUserType("admin");
        assertEquals(TaskResult.SUCCESS, service.tossTaskByAdmin(admin, 7L, 2));
        assertTrue(task.getPriorityTransferredAt().isAfter(previousTransfer));
    }

    @ParameterizedTest @CsvSource({"3,1,2", "4,0,2", "4,1,0"})
    void rejectsUnderqualifiedOrUnavailableRecipient(int level, int status, int counter) {
        when(mapper.selectMemberForUpdate(2)).thenReturn(target(level, status, counter));
        assertEquals(TaskResult.FAILURE_TARGET_UNAVAILABLE, service.tossTask(actor, new TaskTransferRequest(7L, 2, "주택담보대출", "상담 요청")));
        verify(mapper, never()).transferTask(any());
        assertEquals("IN_PROGRESS", task.getStatus());
    }

    @Test void rejectsOtherBankersTask() {
        task.setMemberId(3);
        assertEquals(TaskResult.FAILURE_NOT_ALLOWED, service.tossTask(actor, new TaskTransferRequest(7L, 2, "입금", "상담 요청")));
        assertEquals(TaskResult.FAILURE_NOT_ALLOWED, service.updateTaskStatus(actor, 7L, "COMPLETED"));
        task.setStatus("WAITING");
        assertEquals(TaskResult.FAILURE_NOT_ALLOWED, service.updateTaskStatus(actor, 7L, "IN_PROGRESS"));
        verify(mapper, never()).transferTask(any());
        verify(mapper, never()).updateTaskOutcome(any());
    }

    @Test void rejectsCompletedTransferAndSelfTransfer() {
        assertEquals(TaskResult.FAILURE_TARGET_UNAVAILABLE, service.tossTask(actor, new TaskTransferRequest(7L, 1, "입금", "상담 요청")));
        task.setStatus("COMPLETED");
        assertEquals(TaskResult.FAILURE_INVALID_STATUS, service.tossTask(actor, new TaskTransferRequest(7L, 2, "입금", "상담 요청")));
    }

    @Test void cannotCompleteWaitingTask() {
        task.setStatus("WAITING");
        assertEquals(TaskResult.FAILURE_INVALID_STATUS, service.updateTaskStatus(actor, 7L, "COMPLETED"));
        verify(mapper, never()).updateTaskOutcome(any());
    }

    @Test void oneClickCompletionDoesNotConfirmPredictionAsActualWork() {
        successfulWrites();
        when(mapper.selectMemberForUpdate(1)).thenReturn(actor);
        assertEquals(TaskResult.SUCCESS, service.updateTaskStatus(actor, 7L, "COMPLETED"));
        assertEquals("COMPLETED", task.getStatus());
        assertNull(task.getConfirmedTaskDetailType());
        assertNull(task.getConfirmedAt());
        assertEquals("카드수령", task.getTaskDetailType());
        assertEquals("카드수령", task.getPredictedTaskDetailType());
        verify(mapper).insertTaskAction(7L, 1, "CLOSE", "업무 종료");
    }

    @Test void assignedHigherLevelTaskCanBeAcceptedAndCompleted() {
        successfulWrites();
        when(mapper.selectMemberForUpdate(1)).thenReturn(actor);
        task.setTaskType("상담 업무");
        task.setTaskDetailType("주택담보대출");
        task.setAssignedLevel("LEVEL_4");
        task.setStatus("WAITING");

        assertEquals(TaskResult.SUCCESS, service.updateTaskStatus(actor, 7L, "CALLED"));
        assertEquals(TaskResult.SUCCESS, service.updateTaskStatus(actor, 7L, "IN_PROGRESS"));
        assertEquals("IN_PROGRESS", task.getStatus());
        assertNull(task.getConfirmedTaskDetailType());
        assertEquals(TaskResult.SUCCESS, service.updateTaskStatus(actor, 7L, "COMPLETED"));
        assertEquals("COMPLETED", task.getStatus());
        assertNull(task.getConfirmedTaskDetailType());
        assertNull(task.getConfirmedBy());
        assertEquals("카드수령", task.getPredictedTaskDetailType());
        assertEquals("LEVEL_4", task.getAssignedLevel());
        assertEquals(1, actor.getLevel());
        verify(mapper, times(3)).updateTaskOutcome(task);
        verify(mapper).insertTaskAction(7L, 1, "START_PROCESSING", "상담 시작");
        verify(mapper).insertTaskAction(7L, 1, "CLOSE", "업무 종료");
    }

    @Test void completionPreservesEarlierTransferConfirmationWithoutReconfirmingIt() {
        successfulWrites();
        when(mapper.selectMemberForUpdate(1)).thenReturn(actor);
        task.setTaskDetailType("주택담보대출");
        task.setAssignedLevel("LEVEL_4");
        task.setConfirmedTaskDetailType("주택담보대출");
        task.setConfirmedBy(2);
        LocalDateTime confirmedAt = LocalDateTime.now().minusHours(1);
        task.setConfirmedAt(confirmedAt);
        assertEquals(TaskResult.SUCCESS, service.updateTaskStatus(actor, 7L, "COMPLETED"));
        assertEquals("주택담보대출", task.getTaskDetailType());
        assertEquals("주택담보대출", task.getConfirmedTaskDetailType());
        assertEquals("LEVEL_4", task.getAssignedLevel());
        assertEquals("카드수령", task.getPredictedTaskDetailType());
        assertEquals(2, task.getConfirmedBy());
        assertEquals(confirmedAt, task.getConfirmedAt());
        assertEquals(1, actor.getLevel());
        verify(mapper).insertTaskAction(7L, 1, "CLOSE", "업무 종료");
    }

    @Test void noShowClosesCalledReceptionWithoutCompletionOrTrainingConfirmation() {
        successfulWrites();
        when(mapper.selectMemberForUpdate(1)).thenReturn(actor);
        task.setStatus("CALLED");
        assertEquals(TaskResult.SUCCESS, service.updateTaskStatus(actor, 7L, "NO_SHOW"));
        assertEquals("NO_SHOW", task.getStatus());
        assertNull(task.getConfirmedAt());
        assertNull(task.getConfirmedTaskDetailType());
        assertEquals("A-012", task.getTicketNumber());
        verify(mapper).insertTaskAction(7L, 1, "NO_SHOW", "미방문으로 접수 종료");
    }

    @ParameterizedTest @CsvSource({"WAITING", "IN_PROGRESS", "COMPLETED", "NO_SHOW"})
    void noShowCannotCloseAnAlreadyAcceptedOrFinishedTask(String status) {
        task.setStatus(status);
        assertEquals(TaskResult.FAILURE_INVALID_STATUS, service.updateTaskStatus(actor, 7L, "NO_SHOW"));
        assertEquals(status, task.getStatus());
        verify(mapper, never()).updateTaskOutcome(any());
    }

    @Test void noShowCannotCloseAnotherEmployeesCustomer() {
        task.setStatus("WAITING"); task.setMemberId(2);
        assertEquals(TaskResult.FAILURE_NOT_ALLOWED, service.updateTaskStatus(actor, 7L, "NO_SHOW"));
        verify(mapper, never()).updateTaskOutcome(any());
    }

    @ParameterizedTest
    @CsvSource({"0,1,WAITING,CALLED", "1,0,WAITING,CALLED", "0,1,CALLED,IN_PROGRESS", "1,0,CALLED,IN_PROGRESS",
            "0,1,IN_PROGRESS,COMPLETED", "1,0,IN_PROGRESS,COMPLETED", "0,1,CALLED,NO_SHOW", "1,0,CALLED,NO_SHOW"})
    void rejectsAssignedProcessingWhenOffDutyOrWithoutCounter(int workingStatus, int counter,
                                                              String currentStatus, String nextStatus) {
        actor.setStatus(workingStatus);
        actor.setCounterNumber(counter);
        when(mapper.selectMemberForUpdate(1)).thenReturn(actor);
        task.setStatus(currentStatus);
        assertEquals(TaskResult.FAILURE_TARGET_UNAVAILABLE,
                service.updateTaskStatus(actor, 7L, nextStatus));
        assertEquals(currentStatus, task.getStatus());
        verify(mapper, never()).updateTaskOutcome(any());
    }

    @Test void cancellingAcceptanceDoesNotRecordTrainingLabel() {
        successfulWrites();
        LocalDateTime priority = task.getCreatedAt().plusMinutes(10);
        task.setPriorityTransferredAt(priority);
        assertEquals(TaskResult.SUCCESS, service.updateTaskStatus(actor, 7L, "WAITING"));
        assertNull(task.getConfirmedTaskDetailType());
        assertNull(task.getConfirmedAt());
        assertEquals(priority, task.getPriorityTransferredAt());
        verify(mapper).insertTaskAction(7L, 1, "CANCEL_ACCEPT", "수락 취소 (거래 취소 아님)");
    }

    @Test void adminReassignmentIsNotHumanPurposeConfirmation() {
        successfulWrites();
        when(mapper.selectMemberForUpdate(2)).thenReturn(target(1, 1, 2));
        UserEntity admin = new UserEntity(); admin.setId(99); admin.setUserType("admin");
        assertEquals(TaskResult.SUCCESS, service.tossTaskByAdmin(admin, 7L, 2));
        assertNull(task.getConfirmedAt());
        assertNull(task.getConfirmedTaskDetailType());
        assertNull(task.getPriorityTransferredAt());
        verify(mapper).insertTransferLog(7L, 1, 2, null, 99, "카드수령", "카드수령", "관리자 창구 재배정");
    }

    @Test void missingAuditWriteThrowsToRollBackTransaction() {
        successfulWrites();
        when(mapper.selectMemberForUpdate(2)).thenReturn(target(4, 1, 2));
        when(mapper.insertTransferLog(anyLong(), any(), anyInt(), any(), any(), anyString(), anyString(), anyString())).thenReturn(0);
        assertThrows(IllegalStateException.class, () -> service.tossTask(actor, new TaskTransferRequest(7L, 2, "주택담보대출", "상담 요청")));
    }

    @Test void callAndRecallWaitForArrivalWithoutConfirmingPurpose() {
        successfulWrites();
        when(mapper.selectMemberForUpdate(1)).thenReturn(actor);
        task.setStatus("WAITING");
        var reception = task.getCreatedAt();
        assertEquals(TaskResult.SUCCESS, service.updateTaskStatus(actor, 7L, "CALLED"));
        assertEquals("CALLED", task.getStatus());
        assertEquals(TaskResult.SUCCESS, service.recallTask(actor, 7L));
        assertEquals("CALLED", task.getStatus());
        assertEquals(reception, task.getCreatedAt());
        assertEquals("A-012", task.getTicketNumber());
        assertNull(task.getConfirmedAt());
        verify(mapper).insertTaskAction(7L, 1, "CALL", "고객 호출");
        verify(mapper).insertTaskAction(7L, 1, "RECALL", "고객 재호출");
        verify(mapper, never()).insertTaskAction(anyLong(), anyInt(), eq("START_PROCESSING"), anyString());
    }

    @ParameterizedTest @CsvSource({"WAITING,IN_PROGRESS", "WAITING,NO_SHOW", "CALLED,COMPLETED", "CALLED,CALLED", "IN_PROGRESS,CALLED", "NO_SHOW,CALLED"})
    void rejectsSkippingOrRepeatingLifecycleStages(String before, String after) {
        task.setStatus(before);
        assertEquals(TaskResult.FAILURE_INVALID_STATUS, service.updateTaskStatus(actor, 7L, after));
        assertEquals(before, task.getStatus());
        verify(mapper, never()).updateTaskOutcome(any());
    }

    @ParameterizedTest @CsvSource({"WAITING", "IN_PROGRESS", "COMPLETED", "NO_SHOW"})
    void recallOnlyWorksWhileWaitingForArrival(String before) {
        task.setStatus(before);
        assertEquals(TaskResult.FAILURE_INVALID_STATUS, service.recallTask(actor, 7L));
        verify(mapper, never()).insertTaskAction(anyLong(), anyInt(), anyString(), anyString());
    }

    @Test void cannotCallAnotherCustomerWhileCounterIsOccupied() {
        when(mapper.selectMemberForUpdate(1)).thenReturn(actor);
        when(mapper.selectOtherActiveTaskForUpdate(1, 7L)).thenReturn(8L);
        task.setStatus("WAITING");
        assertEquals(TaskResult.FAILURE_TASK_IN_PROGRESS, service.updateTaskStatus(actor, 7L, "CALLED"));
        assertEquals("WAITING", task.getStatus());
        verify(mapper, never()).updateTaskOutcome(any());
    }

    @Test void cannotLogOutWhileACustomerIsCalledOrBeingServed() {
        when(mapper.selectOtherActiveTaskForUpdate(1, -1L)).thenReturn(7L);
        var error = assertThrows(ResponseStatusException.class, () -> service.reassignTasksOnMemberLogout(1L));
        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
        verify(mapper, never()).markMemberOffDuty(anyInt());
        verify(mapper, never()).updateMemberIdForTasks(anyList(), any());
    }
}
