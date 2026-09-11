package com.bankscope.backend.dtos;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SavingsAccountRequestDto {
    private Integer userId;             // 유저 ID
    private Integer productId;          // 금융 상품 ID

    // 👇 서비스 로직과 일치하도록 이름 변경 및 타입 맞춤
    private Long installmentAmount;     // 월 납입액 (amount -> installmentAmount)
    private Integer termMonths;         // 가입 개월 수 (durationMonths -> termMonths)

    // 👇 적금 스케줄 및 자동이체를 위해 반드시 추가되어야 하는 필수 필드
    private Long linkedAccountId;       // 첫 달치 돈이 빠져나갈 연결(입출금) 계좌 ID
    private Integer paymentDay;         // 매월 자동이체 약정일 (예: 매월 15일 -> 15)

    private String accountPassword;     // 계좌 비밀번호
    private String accountAlias;        // 계좌 별칭 (선택)
    private Integer taskId;             // 창구 업무 ID (선택)

    private String linkedAccountNumber;    // 출금할 연결 계좌번호
    private String linkedAccountPassword;  // 연결 계좌 비밀번호
}