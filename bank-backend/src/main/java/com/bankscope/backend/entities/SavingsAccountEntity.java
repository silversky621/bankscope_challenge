package com.bankscope.backend.entities;

import lombok.*;
import java.time.LocalDate;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SavingsAccountEntity {
    private Long accountId;         // 적금 계좌 ID
    private Long linkedAccountId;   // 연결된 출금 계좌 ID
    private Long installmentAmount; // 약정 납입액
    private Integer termMonths;     // 가입 기간
    private Integer paymentDay;     // 자동이체 일자
    private LocalDate maturityDate; // 만기일
}