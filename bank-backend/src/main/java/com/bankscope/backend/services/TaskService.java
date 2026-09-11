package com.bankscope.backend.services;

import com.bankscope.backend.dtos.TaskRequestDto;
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
        //유저의 id를 통해서 그 유저의 특정 업무를 조회하고 단 하나라도 IN_PROGRESS상태인 업무가
        // 있을때 FAILURE_TASK_IN_PROGRESS를 return;

        /*이제 사용자가 접수한 업무 중 현재 진행 중(IN_PROGRESS )이거나
        대기 중(WAITING)인 업무가 있다면 FAILURE_TASK_PLURAL
                (또는 FAILURE_TASK_IN_PROGRESS)이 반환되고, 이전에
        COMPLETED된 업무만 있다면 정상적으로 새 업무를 접수할 수 있게 됨.*/
        List<TaskVo> userTasks = taskMapper.selectTasksByUserId(userId);
        if (userTasks != null && userTasks.stream()
                .anyMatch(task -> "IN_PROGRESS".equals(task.getStatus()))) {
            return TaskResult.FAILURE_TASK_IN_PROGRESS;
        }
        // 이미 대기중(WAITING)이거나 진행중(IN_PROGRESS)인 업무가 있으면 추가 접수 불가
        if (userTasks != null && userTasks.stream()
                .anyMatch(task -> "WAITING".equals(task.getStatus()) || "IN_PROGRESS".equals(task.getStatus()))) {
            return TaskResult.FAILURE_TASK_PLURAL;
        }

        String taskType = requestDto.getTaskType();
        String prefix;
        String assignedLevel;
        int processingTime;
        int minLevel;

        // 1. 업무 유형별 설정
        if ("빠른 업무".equals(taskType)) {
            prefix = "A";
            processingTime = 5;
            minLevel = 1;
        } else if ("상담 업무".equals(taskType)) {
            prefix = "B";
            processingTime = 10;
            minLevel = 3;
        } else { // 기업 • 특수
            prefix = "C";
            processingTime = 25;
            minLevel = 5;
        }

        // 세부 업무 유형별 minLevel 세분화 (task_type 기준보다 우선 적용)
        minLevel = getMinLevelByTaskDetailType(requestDto.getTaskDetailType(), minLevel);
        assignedLevel = "LEVEL_" + minLevel;

        // 2. 대기표 번호 생성 (A-001)
        String lastTicket = taskMapper.selectLastTicketNumber(prefix);
        int nextNum = 1;
        if (lastTicket != null) {
            String numPart = lastTicket.split("-")[1];
            nextNum = Integer.parseInt(numPart) + 1;
        }
        String ticketNumber = String.format("%s-%03d", prefix, nextNum);

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
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .isAi(Boolean.FALSE)
                .build();

        int result = taskMapper.insert(task);
        return result > 0 ? TaskResult.SUCCESS : TaskResult.FAILURE;
    }

    private int getMinLevelByTaskDetailType(String detailType, int fallback) {
        if (detailType == null) return fallback;
        return switch (detailType) {
            // 빠른 업무 - lv.1
            case "입금", "출금", "카드수령"                          -> 1;
            // 빠른 업무 - lv.2
            case "이체", "체크카드 발급", "통장 비밀번호 변경",
                 "입출금 계좌개설", "적금", "신용카드 발급", "대출 상환" -> 2;
            // 상담 - lv.3
            case "예금", "신용대출", "전세자금대출",
                 "금융상품가입", "법인카드 발급"                        -> 3;
            // 상담 - lv.4
            case "소상공인 대출", "연금신청", "주택담보대출",
                 "법인계좌 개설", "기업대출", "연체관리"                -> 4;
            // 기업·특수 - lv.5
            case "부도관리"                                          -> 5;
            default                                                  -> fallback;
        };
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
    public TaskResult updateTaskStatus(Long taskId, String status) {
        if (taskId == null || status == null) {
            return TaskResult.FAILURE;
        }
        int result = taskMapper.updateTaskStatus(taskId, status);
        if (result > 0) {
            return TaskResult.SUCCESS;
        }
        return "IN_PROGRESS".equals(status) ? TaskResult.FAILURE_TASK_IN_PROGRESS : TaskResult.FAILURE;
    }

    public TaskResult tossTask(Long taskId, Integer targetMemberId) {
        if (taskId == null || targetMemberId == null) {
            return TaskResult.FAILURE;
        }
        // #TODO 업무를 처리할수 없는 멤버에서 할당 못하게
        int result = taskMapper.tossTask(taskId, targetMemberId, "WAITING");
        return result > 0 ? TaskResult.SUCCESS : TaskResult.FAILURE;
    }
    public TaskResult tossTaskByAdmin(UserEntity user, Long taskId, Integer targetMemberId) {
        if( !user.getUserType().equals("admin")) {
            return TaskResult.FAILURE_NOT_ALLOWED;
        }
        if (taskId == null || targetMemberId == null) {
            return TaskResult.FAILURE;
        }
        int result = taskMapper.tossTask(taskId, targetMemberId, "WAITING");
        return result > 0 ? TaskResult.SUCCESS : TaskResult.FAILURE;

    }
    public TaskVo getTask(Long taskId) {
        return this.taskMapper.getTask(taskId);
    }

    public List<TaskProcessingVo> getTaskLog(Integer userId) {
        return this.taskMapper.selectTaskLogByUserId(userId);
    }

    @Transactional
    public void reassignTasksOnMemberLogout(Long memberId) {
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
