// src/main/java/com/bankscope/backend/dtos/PendingSavingsDto.java
package com.bankscope.backend.dtos;

import lombok.Getter;
import lombok.Setter;
import java.time.LocalDate;

@Getter
@Setter
public class PendingSavingsDto {
    private Long scheduleId;        // 스케줄 ID
    private Long accountId;         // 적금 계좌 ID (입금될 곳)
    private Long linkedAccountId;   // 연결 계좌 ID (돈 빼갈 곳)
    private Long installmentAmount; // 출금할 납입액
    private LocalDate dueDate;      // 약정일
}