package com.bankscope.backend.entities;

import lombok.*;

import java.math.BigInteger;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LoanScheduleEntity {
    private BigInteger scheduleId;
    private int loanId;
    private LocalDate dueDate;
    private Long repayAmount;
    private String status; // SCHEDULED, PAID, OVERDUE
    private LocalDateTime paidAt;
    private LocalDateTime createdAt;
}