package com.bankscope.backend.vos;


import lombok.*;
import lombok.experimental.SuperBuilder;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@SuperBuilder
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@ToString(callSuper = true)
public class LoanVo {
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
    private String productName;
    private String description;

}
