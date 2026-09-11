package com.bankscope.backend.entities;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public class ProductInterestRate {
    private Integer rateId;
    private Integer productId;
    private BigDecimal baseInterestRate;
    private BigDecimal maxInterestRate;
    private LocalDateTime effectiveStartDate;
    private LocalDateTime effectiveEndDate;
    private LocalDateTime createdAt;
}
/*
create table bank.product_interest_rate
        (
                rate_id             int unsigned auto_increment primary key,
                product_id          int unsigned                        not null, -- 어떤 상품의 금리인지 연결
                        duration_months     int                                 null,     -- 가입 기간 (예: 12개월)
base_interest_rate  decimal(5, 2)                       not null, -- 기본 금리
max_interest_rate   decimal(5, 2)                       null,     -- 우대 포함 최고 금리
effective_start_date datetime                           not null, -- 해당 금리의 적용 시작일 (중요!)
effective_end_date   datetime   default '9999-12-31'    null,     -- 적용 종료일
created_at          datetime default CURRENT_TIMESTAMP  null

constraint fk_rate_product
foreign key (product_id) references financial_product (product_id),
constraint fk_rate_member
foreign key (member_id) references member (id)
 );*/
