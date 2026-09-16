package com.bankscope.backend.services;

import com.bankscope.backend.dtos.TaskRequestDto;
import com.bankscope.backend.dtos.TaskTransferRequest;
import com.bankscope.backend.entities.MemberEntity;
import com.bankscope.backend.utils.TaskRouting;
import com.bankscope.backend.entities.TaskEntity;
import com.bankscope.backend.entities.UserEntity;
import com.bankscope.backend.enums.TaskStatus;
import com.bankscope.backend.mappers.TaskMapper;
import com.bankscope.backend.results.TaskResult;
import com.bankscope.backend.vos.TaskProcessingVo;
import com.bankscope.backend.vos.TaskVo;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class TaskService {
    private final TaskMapper taskMapper;


    // TODO: ai 설정 및 스케줄링 알고리즘 추가예정
    @Transactional
    public TaskResult createTask(TaskRequestDto requestDto, Integer userId) {

        if (requestDto == null || userId == null) {
            return TaskResult.FAILURE;
        }
        // 대기·호출·상담 중인 접수가 있으면 추가 접수를 막는다.
        List<TaskVo> userTasks = taskMapper.selectTasksByUserId(userId);
        if (userTasks != null && userTasks.stream()
                .anyMatch(task -> "IN_PROGRESS".equals(task.getStatus()))) {
            return TaskResult.FAILURE_TASK_IN_PROGRESS;
        }
        if (userTasks != null && userTasks.stream()
                .anyMatch(task -> "WAITING".equals(task.getStatus()) || "CALLED".equals(task.getStatus())
                        || "IN_PROGRESS".equals(task.getStatus()))) {
            return TaskResult.FAILURE_TASK_PLURAL;
        }

        String taskType = requestDto.getTaskType();
        String assignedLevel;
        int minLevel;

        // 1. 업무 유형별 설정
        if ("빠른 업무".equals(taskType)) {
            minLevel = 1;
        } else if ("상담 업무".equals(taskType)) {
            minLevel = 3;
        } else { // 기업 • 특수
            minLevel = 5;
        }

        // 세부 업무 유형별 minLevel 세분화 (task_type 기준보다 우선 적용)
        minLevel = getMinLevelByTaskDetailType(requestDto.getTaskDetailType(), minLevel);
        assignedLevel = "LEVEL_" + minLevel;

        // 2. AI 접수와 같은 일별 숫자 번호를 사용한다. 발급일과 접수 시각은 DB 시계로 고정한다.
        LocalDateTime issuedAt = taskMapper.selectTicketIssueTime();
        taskMapper.incrementDailyTicketNumber(issuedAt.toLocalDate());
        String ticketNumber = String.valueOf(taskMapper.selectDailyTicketNumber(issuedAt.toLocalDate()));

        // 3. 직원 배정 (가중 대기시간 기준 가장 한가한 직원)
        Integer memberId = taskMapper.selectAvailableMemberId(minLevel);

        // 4. 예상 대기 시간 + 순번 (배정된 직원 기준)
        int expectedWaitingTime = memberId != null ? taskMapper.selectMemberTotalWaitTime(memberId) : 0;
        int ranking = memberId != null ? taskMapper.countWaitingTasksByMemberId(memberId) + 1 : 1;

        // 6. 엔티티 생성 및 저장
        TaskEntity task = TaskEntity.builder()
                .userId(userId)
                .ticketNumber(ticketNumber)
                .taskType(taskType)
                .taskDetailType(requestDto.getTaskDetailType())
                .assignedLevel(assignedLevel)
                .expectedWaitingTime(expectedWaitingTime)
                .status(TaskStatus.WAITING.name())
                .memberId(memberId)
                .ranking(ranking)
                .createdAt(issuedAt)
                .updatedAt(issuedAt)
                .isAi(Boolean.FALSE)
                .build();

        int result = taskMapper.insert(task);
        return result > 0 ? TaskResult.SUCCESS : TaskResult.FAILURE;
    }

    private int getMinLevelByTaskDetailType(String detailType, int fallback) {
        TaskRouting.Route route = TaskRouting.find(detailType);
        return route == null ? fallback : route.minLevel();
    }

    public List<TaskVo> getTask(Integer userId) {
        return taskMapper.selectTasksByUserId(userId);
    }
    
    public TaskVo getLatestTask(Integer userId) {
        return taskMapper.selectLatestTaskByUserId(userId);
    }

    public String getAverageTime() {
        return taskMapper.selectAverageTime();
    }

    
    public int getAvailableMemberCount() {
        return taskMapper.countAvailableMembers();
    }
    public int getTotalWaitingPerson() {
        return taskMapper.countAllWaitingPerson();
    }

    public List<Map<String, Object>> getHourlyCongestionStats() {
        List<Map<String, Object>> rows = taskMapper.selectHourlyAverageWorkloadMinutes();
        int availableMembers = taskMapper.countAvailableMembers();
        double hourlyCapacityMinutes = availableMembers * 60.0;

        Map<Integer, Long> congestionByHour = new java.util.LinkedHashMap<>();
        for (int h = 9; h <= 17; h++) congestionByHour.put(h, 0L);

        if (hourlyCapacityMinutes > 0) {
            for (Map<String, Object> row : rows) {
                int hour = ((Number) row.get("hour")).intValue();
                double avgWorkloadMinutes = ((Number) row.get("avgWorkloadMinutes")).doubleValue();
                long congestionRate = Math.round((avgWorkloadMinutes / hourlyCapacityMinutes) * 100);
                congestionByHour.put(hour, congestionRate);
            }
        }

        List<Map<String, Object>> result = new java.util.ArrayList<>();
        congestionByHour.forEach((h, congestionRate) -> {
            Map<String, Object> entry = new java.util.HashMap<>();
            entry.put("h", String.format("%02d", h));
            entry.put("total", congestionRate);
            result.add(entry);
        });
        return result;
    }

    public Map<String, Integer> getWaitingCountByTaskType() {
        List<Map<String, Object>> rows = taskMapper.countWaitingPersonByTaskType();
        Map<String, Integer> result = new java.util.HashMap<>();
        result.put("빠른 업무", 0);
        result.put("상담 업무", 0);
        result.put("기업 • 특수", 0);
        for (Map<String, Object> row : rows) {
            String taskType = (String) row.get("taskType");
            int cnt = ((Number) row.get("cnt")).intValue();
            result.put(taskType, cnt);
        }
        return result;
    }
    public List<TaskVo> getTasksByMemberId(Integer memberId) {
        try {
            if (memberId == null) {
                throw new IllegalArgumentException("memberId cannot be null");
            }
            return taskMapper.selectTasksByMemberId(memberId);
        } catch (IllegalArgumentException e) {
            System.err.println("Invalid memberId: " + e.getMessage());
            return new ArrayList<>();
        }
    }

    public List<TaskVo> getTasksByMemberLevel(Integer memberId, Integer memberLevel) {
        if (memberId == null || memberLevel == null) return new ArrayList<>();
        return taskMapper.selectTasksByMemberLevel(memberId, memberLevel);
    }
    @Transactional
    public TaskResult updateTaskStatus(MemberEntity actor, Long taskId, String status) {
        return changeTaskStatus(actor, taskId, status, false);
    }

    @Transactional
    public TaskResult recallTask(MemberEntity actor, Long taskId) {
        return changeTaskStatus(actor, taskId, "CALLED", true);
    }

    public List<Map<String, Object>> getQueueDisplay() {
        return taskMapper.selectQueueDisplay();
    }

    private TaskResult changeTaskStatus(MemberEntity actor, Long taskId, String status, boolean recall) {
        if (actor == null || actor.getId() == null) return TaskResult.FAILURE_SESSION;
        if (taskId == null || status == null) return TaskResult.FAILURE;
        // Serialize calls at this counter, including requests from multiple browser tabs.
        MemberEntity workingMember = taskMapper.selectMemberForUpdate(actor.getId().intValue());
        TaskEntity task = taskMapper.selectTaskForUpdate(taskId);
        if (task == null) return TaskResult.FAILURE;
        if (!Objects.equals(task.getMemberId(), actor.getId().intValue())) return TaskResult.FAILURE_NOT_ALLOWED;
        boolean calling = !recall && "CALLED".equals(status) && "WAITING".equals(task.getStatus());
        boolean recalling = recall && "CALLED".equals(task.getStatus());
        boolean accepting = !recall && "IN_PROGRESS".equals(status) && "CALLED".equals(task.getStatus());
        boolean cancelling = "WAITING".equals(status) && "IN_PROGRESS".equals(task.getStatus());
        boolean completing = "COMPLETED".equals(status) && "IN_PROGRESS".equals(task.getStatus());
        boolean noShow = "NO_SHOW".equals(status) && "CALLED".equals(task.getStatus());
        if (!calling && !recalling && !accepting && !cancelling && !completing && !noShow) return TaskResult.FAILURE_INVALID_STATUS;
        if (accepting && TaskRouting.find(task.getTaskDetailType()) == null) return TaskResult.FAILURE_INVALID_TASK_TYPE;
        // Assignment authorizes this task, including fallback to the highest-level remaining staff.
        // Recheck working status, but do not require the assignee to meet the routing level again.
        if (!cancelling && !isWorkingMember(workingMember))
            return TaskResult.FAILURE_TARGET_UNAVAILABLE;
        if ((calling || accepting) && taskMapper.selectOtherActiveTaskForUpdate(actor.getId().intValue(), taskId) != null)
            return TaskResult.FAILURE_TASK_IN_PROGRESS;
        task.setStatus(status);
        // Closing a visit does not confirm the prediction or the actual work performed.
        if (taskMapper.updateTaskOutcome(task) != 1) throw new IllegalStateException("Task update failed");
        if (taskMapper.insertTaskAction(taskId, actor.getId().intValue(),
                calling ? "CALL" : recalling ? "RECALL" : completing ? "CLOSE" : noShow ? "NO_SHOW" : accepting ? "START_PROCESSING" : "CANCEL_ACCEPT",
                calling ? "고객 호출" : recalling ? "고객 재호출" : completing ? "업무 종료" : noShow ? "미방문으로 접수 종료" : accepting ? "상담 시작" : "수락 취소 (거래 취소 아님)") != 1)
            throw new IllegalStateException("Task action log failed");
        return TaskResult.SUCCESS;
    }

    public List<Map<String, Object>> getTransferCandidates(MemberEntity actor, Long taskId, String detail) {
        TaskVo task = taskId == null ? null : taskMapper.getTask(taskId);
        if (actor == null || actor.getId() == null || task == null || !Objects.equals(task.getMemberId(), actor.getId().intValue()))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        if (!"IN_PROGRESS".equals(task.getStatus()))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "상담 중인 업무만 이관할 수 있습니다. 상담 시작 후 방문 목적을 확인해주세요.");
        TaskRouting.Route route = TaskRouting.find(detail);
        if (route == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "유효하지 않은 업무입니다.");
        return taskMapper.selectTransferCandidates(route.minLevel(), task.getMemberId());
    }

    @Transactional
    public TaskResult tossTask(MemberEntity actor, TaskTransferRequest request) {
        if (actor == null || actor.getId() == null) return TaskResult.FAILURE_SESSION;
        if (request == null) return TaskResult.FAILURE;
        return transferTask(request, actor.getId().intValue(), null);
    }

    @Transactional
    public TaskResult tossTaskByAdmin(UserEntity user, Long taskId, Integer targetMemberId) {
        if (user == null || !"admin".equals(user.getUserType())) return TaskResult.FAILURE_NOT_ALLOWED;
        return transferTask(new TaskTransferRequest(taskId, targetMemberId, null, "관리자 창구 재배정"), null, user.getId());
    }

    private TaskResult transferTask(TaskTransferRequest request, Integer actorId, Integer adminId) {
        if (request.taskId() == null || request.targetMemberId() == null) return TaskResult.FAILURE;
        TaskEntity task = taskMapper.selectTaskForUpdate(request.taskId());
        if (task == null) return TaskResult.FAILURE;
        if (adminId == null && !Objects.equals(task.getMemberId(), actorId)) return TaskResult.FAILURE_NOT_ALLOWED;
        if (!List.of("WAITING", "CALLED", "IN_PROGRESS").contains(task.getStatus())) return TaskResult.FAILURE_INVALID_STATUS;
        if (adminId == null && !"IN_PROGRESS".equals(task.getStatus())) return TaskResult.FAILURE_INVALID_STATUS;
        if (Objects.equals(task.getMemberId(), request.targetMemberId())) return TaskResult.FAILURE_TARGET_UNAVAILABLE;
        String detail = adminId == null ? request.actualTaskDetailType() : task.getTaskDetailType();
        TaskRouting.Route route = TaskRouting.find(detail);
        if (route == null) return TaskResult.FAILURE_INVALID_TASK_TYPE;
        String reason = request.reason() == null ? "" : request.reason().trim();
        if (reason.isEmpty() || reason.length() > 1000) return TaskResult.FAILURE;
        // Recheck under a lock: staff may have gone off duty since the list was loaded.
        MemberEntity target = taskMapper.selectMemberForUpdate(request.targetMemberId());
        if (!canHandle(target, route)) return TaskResult.FAILURE_TARGET_UNAVAILABLE;
        Integer previousMember = task.getMemberId();
        String previousDetail = task.getTaskDetailType();
        // Consultation grants priority; moving an already-prioritized customer keeps it.
        // At each receiving counter, join behind customers already waiting with priority.
        if ((adminId == null && "IN_PROGRESS".equals(task.getStatus())) || task.getPriorityTransferredAt() != null)
            task.setPriorityTransferredAt(LocalDateTime.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS));
        if (adminId == null) applyConfirmedTask(task, route, actorId);
        task.setMemberId(request.targetMemberId());
        task.setStatus("WAITING");
        Map<String, Object> queue = taskMapper.selectQueueBeforeTask(task);
        task.setRanking(((Number) queue.get("waitingCount")).intValue() + 1);
        task.setExpectedWaitingTime(((Number) queue.get("waitingMinutes")).intValue());
        if (taskMapper.transferTask(task) != 1) throw new IllegalStateException("Transfer failed");
        if (taskMapper.insertTransferLog(task.getTaskId(), previousMember, task.getMemberId(), actorId, adminId,
                previousDetail, detail, reason) != 1) throw new IllegalStateException("Transfer log failed");
        if (actorId != null && taskMapper.insertTaskAction(task.getTaskId(), actorId, "TRANSFER",
                previousDetail + " → " + detail + " / " + target.getName() + "에게 이관 / " + reason) != 1)
            throw new IllegalStateException("Task action log failed");
        return TaskResult.SUCCESS;
    }

    private boolean isWorkingMember(MemberEntity member) {
        return member != null && Integer.valueOf(1).equals(member.getStatus()) && member.getCounterNumber() > 0;
    }

    private boolean canHandle(MemberEntity member, TaskRouting.Route route) {
        return isWorkingMember(member) && member.getLevel() != null && member.getLevel() >= route.minLevel();
    }

    private void applyConfirmedTask(TaskEntity task, TaskRouting.Route route, Integer actorId) {
        task.setTaskDetailType(route.detailType());
        task.setTaskType(route.taskType());
        task.setAssignedLevel("LEVEL_" + route.minLevel());
        task.setConfirmedTaskDetailType(route.detailType());
        task.setConfirmedBy(actorId);
        task.setConfirmedAt(LocalDateTime.now());
    }
    public TaskVo getTask(Long taskId) {
        return this.taskMapper.getTask(taskId);
    }

    public List<TaskProcessingVo> getTaskLog(Integer userId) {
        return this.taskMapper.selectTaskLogByUserId(userId);
    }

    @Transactional
    public void reassignTasksOnMemberLogout(Long memberId) {
        taskMapper.selectMemberForUpdate(memberId.intValue());
        if (taskMapper.selectOtherActiveTaskForUpdate(memberId.intValue(), -1L) != null)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "호출 중이거나 상담 중인 고객을 먼저 처리해주세요.");
        // Closing the counter and reassigning its waiting queue share the call lock.
        taskMapper.markMemberOffDuty(memberId.intValue());
        List<TaskEntity> waitingTasks = taskMapper.selectWaitingTasksByMemberId(memberId);
        if (waitingTasks == null || waitingTasks.isEmpty()) return;

        for (TaskEntity task : waitingTasks) {
            int minLevel = assignedLevelToMinLevel(task.getAssignedLevel());
            Integer newMemberId = taskMapper.selectLeastBusyMemberId(minLevel, memberId);
            if (newMemberId == null) {
                newMemberId = taskMapper.selectHighestLevelMemberId(memberId);
            }
            taskMapper.updateMemberIdForTasks(List.of(task.getTaskId()), newMemberId);
        }
    }

    private int assignedLevelToMinLevel(String assignedLevel) {
        try {
            return Integer.parseInt(assignedLevel.replace("LEVEL_", ""));
        } catch (Exception e) {
            return 1;
        }
    }

}
