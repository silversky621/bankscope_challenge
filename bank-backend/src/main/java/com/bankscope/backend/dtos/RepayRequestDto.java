package com.bankscope.backend.dtos;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RepayRequestDto {
    private String accountNumber;    // 돈이 빠져나갈 출금 계좌번호
    private String accountPassword;  // 계좌 비밀번호
    private Long repayAmount;        // 상환할 금액
    private Integer userId;   // 유저아이디
}