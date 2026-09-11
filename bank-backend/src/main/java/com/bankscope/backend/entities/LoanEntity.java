package com.bankscope.backend.entities;


import lombok.*;
import lombok.experimental.SuperBuilder;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@SuperBuilder
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = "loanId")
public class LoanEntity {
    private Integer loanId;
    private Integer userId;
    private Integer productId;
    private Long linkedAccountId;
    private Long principalAmount;
    private Long outstandingAmount;
    private BigDecimal interestRate;
    private int paymentDay;
    private String info;
    private String status;
    private LocalDateTime overdueDate;
    private Long overdueAmount;
    private String maturityDate;
    private String createdAt;
    private String updatedAt;
}
