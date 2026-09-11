package com.bankscope.backend.entities;

import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SavingsScheduleEntity {
    private Long scheduleId;
    private Long accountId;         // 적금 계좌 ID
    private LocalDate dueDate;      // 납입 예정일
    private Long installmentAmount; // 약정 납입액
    private String status;          // PENDING, COMPLETED, MISSED
    private LocalDateTime paidAt;   // 실제 납부 일시
    private LocalDateTime createdAt;
}