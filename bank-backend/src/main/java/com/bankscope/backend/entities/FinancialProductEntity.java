package com.bankscope.backend.entities;


import com.bankscope.backend.enums.ProductCategory;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Builder
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = "productId")
public class FinancialProductEntity {
    private Integer productId;
    private ProductCategory productCategory;
    private String targetType;
    private String productName;
    private BigDecimal baseInterestRate;
    private BigDecimal maxInterestRate;
    private Integer minDurationMonths;
    private Integer maxDurationMonths;
    private Long minAmount;
    private Long maxAmount;
    private String description;
    private Boolean isActive;
    private Integer minAge;
    private Integer maxAge;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    // 자동 이체 로 할지 직접 납부할지 결정
}
/*
create table `bank`.`financial_product`
        (
product_id          int unsigned auto_increment primary key,
product_category    enum('DEPOSIT','SAVINGS','LOAN','FUND')   not null, -- 예금,적금,대출,펀드
product_name        varchar(100)  not null,
base_interest_rate  decimal(5, 2) not null, -- 기본 이율 (예: 3.50)
max_interest_rate   decimal(5, 2) null,     -- 최고 이율 (예: 5.00)
min_duration_months int           null,     -- 최소 계약 기간(개월) (예: 6)
max_duration_months int           null,     -- 최대 계약 기간(개월) (예: 36)
min_amount          bigint        null,     -- 최소 가입/대출 금액
max_amount          bigint        null,     -- 최대 가입/대출 한도
description         text          null,     -- 상품 상세 설명
is_active           tinyint(1)    default 1 -- 현재 판매중인지 여부
);*/
