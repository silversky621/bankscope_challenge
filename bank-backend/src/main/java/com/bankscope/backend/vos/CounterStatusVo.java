package com.bankscope.backend.vos;


import lombok.Data;

@Data
public class CounterStatusVo {
    private Integer memberId;
    private String memberName;
    private Integer memberLevel;
    private String currentTaskStatus;    // '업무중' 또는 '대기중'이 담김
    private java.time.LocalDateTime taskStartedAt; // 업무 시작 시점 (수락 버튼 누른 시점)
    private Integer todayCompletedCount;
    private Integer waitingCount;
    private String currentTicket;
    private Integer userId;
    private String taskType;
    private Integer expectedWaitingTime;
}