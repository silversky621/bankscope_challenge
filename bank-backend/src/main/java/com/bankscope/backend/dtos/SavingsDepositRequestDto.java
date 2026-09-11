package com.bankscope.backend.dtos;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SavingsDepositRequestDto {
    private String linkedAccountNumber;    // 돈이 빠져나갈 입출금 계좌번호 (from)
    private String linkedAccountPassword;  // 그 계좌의 비밀번호
    private String savingsAccountNumber;   // 돈이 들어갈 적금 계좌번호 (to)
    private Long amount;                   // 납입할 금액
}