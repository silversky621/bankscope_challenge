package com.bankscope.backend.entities;

import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Builder
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = "subscriptionId")
public class ProductSubscriptionEntity {
    private Integer subscriptionId;
    private Integer userId;
    private Integer productId;
    private Long taskId;
    private Long amount;
    private Integer durationMonths;
    private BigDecimal appliedInterestRate;
    private String status;
    private LocalDateTime createdAt;
}
