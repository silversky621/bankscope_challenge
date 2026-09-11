package com.bankscope.backend.entities;


import lombok.*;

import java.time.LocalDateTime;

@Builder
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class TransactionHistoryEntity {
    private Long transactionId;
    private Long accountId;
    private Integer userId;
    private Long taskId;
    private String transactionType;
    private Long amount;
    private Long balanceAfter;
    private String description;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
