package com.bankscope.backend.services;

import com.bankscope.backend.dtos.TaskTransferRequest;
import com.bankscope.backend.entities.MemberEntity;
import com.bankscope.backend.entities.TaskEntity;
import com.bankscope.backend.entities.UserEntity;
import com.bankscope.backend.mappers.TaskMapper;
import com.bankscope.backend.results.TaskResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
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
        verify(mapper).insertTransferLog(7L, 1, 2, 1, null, "카드수령", "주택담보대출", "실제 대출 상담 요청");
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
        assertEquals(TaskResult.FAILURE_NOT_ALLOWED, service.updateTaskStatus(actor, 7L, "COMPLETED", "입금"));
        task.setStatus("WAITING");
        assertEquals(TaskResult.FAILURE_NOT_ALLOWED, service.updateTaskStatus(actor, 7L, "IN_PROGRESS", null));
        verify(mapper, never()).transferTask(any());
        verify(mapper, never()).updateTaskOutcome(any());
    }

    @Test void rejectsCompletedTransferAndSelfTransfer() {
        assertEquals(TaskResult.FAILURE_TARGET_UNAVAILABLE, service.tossTask(actor, new TaskTransferRequest(7L, 1, "입금", "상담 요청")));
        task.setStatus("COMPLETED");
        assertEquals(TaskResult.FAILURE_INVALID_STATUS, service.tossTask(actor, new TaskTransferRequest(7L, 2, "입금", "상담 요청")));
    }

    @Test void cannotCompleteWaitingTaskOrSkipPurposeConfirmation() {
        assertEquals(TaskResult.FAILURE_INVALID_TASK_TYPE, service.updateTaskStatus(actor, 7L, "COMPLETED", null));
        task.setStatus("WAITING");
        assertEquals(TaskResult.FAILURE_INVALID_STATUS, service.updateTaskStatus(actor, 7L, "COMPLETED", "입금"));
        verify(mapper, never()).updateTaskOutcome(any());
    }

    @Test void completionStoresHumanOutcomeWithoutChangingPrediction() {
        successfulWrites();
        when(mapper.selectMemberForUpdate(1)).thenReturn(actor);
        assertEquals(TaskResult.SUCCESS, service.updateTaskStatus(actor, 7L, "COMPLETED", "출금"));
        assertEquals("COMPLETED", task.getStatus());
        assertEquals("출금", task.getConfirmedTaskDetailType());
        assertEquals("카드수령", task.getPredictedTaskDetailType());
        verify(mapper).insertTaskAction(7L, 1, "COMPLETE", "실제 처리 업무 확인: 출금");
    }

    @Test void assignedHigherLevelTaskCanBeAcceptedAndCompleted() {
        successfulWrites();
        when(mapper.selectMemberForUpdate(1)).thenReturn(actor);
        task.setTaskType("상담 업무");
        task.setTaskDetailType("주택담보대출");
        task.setAssignedLevel("LEVEL_4");
        task.setStatus("WAITING");

        assertEquals(TaskResult.SUCCESS, service.updateTaskStatus(actor, 7L, "IN_PROGRESS", null));
        assertEquals("IN_PROGRESS", task.getStatus());
        assertNull(task.getConfirmedTaskDetailType());
        assertEquals(TaskResult.SUCCESS, service.updateTaskStatus(actor, 7L, "COMPLETED", "주택담보대출"));
        assertEquals("COMPLETED", task.getStatus());
        assertEquals("주택담보대출", task.getConfirmedTaskDetailType());
        assertEquals(1, task.getConfirmedBy());
        assertEquals("카드수령", task.getPredictedTaskDetailType());
        assertEquals("LEVEL_4", task.getAssignedLevel());
        assertEquals(1, actor.getLevel());
        verify(mapper, times(2)).updateTaskOutcome(task);
        verify(mapper).insertTaskAction(7L, 1, "START_PROCESSING", "업무 수락");
        verify(mapper).insertTaskAction(7L, 1, "COMPLETE", "실제 처리 업무 확인: 주택담보대출");
    }

    @Test void completionCanConfirmHigherLevelActualPurpose() {
        successfulWrites();
        when(mapper.selectMemberForUpdate(1)).thenReturn(actor);
        assertEquals(TaskResult.SUCCESS, service.updateTaskStatus(actor, 7L, "COMPLETED", "주택담보대출"));
        assertEquals("주택담보대출", task.getTaskDetailType());
        assertEquals("주택담보대출", task.getConfirmedTaskDetailType());
        assertEquals("LEVEL_4", task.getAssignedLevel());
        assertEquals("카드수령", task.getPredictedTaskDetailType());
        assertEquals(1, actor.getLevel());
    }

    @ParameterizedTest
    @CsvSource({"0,1,WAITING,IN_PROGRESS", "1,0,WAITING,IN_PROGRESS",
            "0,1,IN_PROGRESS,COMPLETED", "1,0,IN_PROGRESS,COMPLETED"})
    void rejectsAssignedProcessingWhenOffDutyOrWithoutCounter(int workingStatus, int counter,
                                                              String currentStatus, String nextStatus) {
        actor.setStatus(workingStatus);
        actor.setCounterNumber(counter);
        when(mapper.selectMemberForUpdate(1)).thenReturn(actor);
        task.setStatus(currentStatus);
        assertEquals(TaskResult.FAILURE_TARGET_UNAVAILABLE,
                service.updateTaskStatus(actor, 7L, nextStatus, "주택담보대출"));
        assertEquals(currentStatus, task.getStatus());
        verify(mapper, never()).updateTaskOutcome(any());
    }

    @Test void cancellingAcceptanceDoesNotRecordTrainingLabel() {
        successfulWrites();
        assertEquals(TaskResult.SUCCESS, service.updateTaskStatus(actor, 7L, "WAITING", null));
        assertNull(task.getConfirmedTaskDetailType());
        assertNull(task.getConfirmedAt());
        verify(mapper).insertTaskAction(7L, 1, "CANCEL_ACCEPT", "수락 취소 (거래 취소 아님)");
    }

    @Test void adminReassignmentIsNotHumanPurposeConfirmation() {
        successfulWrites();
        when(mapper.selectMemberForUpdate(2)).thenReturn(target(1, 1, 2));
        UserEntity admin = new UserEntity(); admin.setId(99); admin.setUserType("admin");
        assertEquals(TaskResult.SUCCESS, service.tossTaskByAdmin(admin, 7L, 2));
        assertNull(task.getConfirmedAt());
        assertNull(task.getConfirmedTaskDetailType());
        verify(mapper).insertTransferLog(7L, 1, 2, null, 99, "카드수령", "카드수령", "관리자 창구 재배정");
    }

    @Test void missingAuditWriteThrowsToRollBackTransaction() {
        successfulWrites();
        when(mapper.selectMemberForUpdate(2)).thenReturn(target(4, 1, 2));
        when(mapper.insertTransferLog(anyLong(), any(), anyInt(), any(), any(), anyString(), anyString(), anyString())).thenReturn(0);
        assertThrows(IllegalStateException.class, () -> service.tossTask(actor, new TaskTransferRequest(7L, 2, "주택담보대출", "상담 요청")));
    }
}
