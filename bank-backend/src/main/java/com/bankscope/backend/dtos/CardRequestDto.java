package com.bankscope.backend.dtos;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CardRequestDto {
    // [공통 필수] 연결할 결제 계좌 ID (프론트엔드에서 사용자가 선택한 계좌)
    private Long accountId;

    // [공통 필수] 카드 타입 (예: "CHECK", "CREDIT")
    private String cardType;
    private String cardName;
    // [신용카드 전용] 사용자가 선택한 매월 결제일 (예: 14일)
    // 체크카드일 경우에는 프론트에서 보내지 않아도 됩니다.
    private Integer paymentDay;

    // [워크스페이스 전용] 행원이 카드를 발급해 줄 대상 고객의 ID
    // 웹사이트(비대면) 발급 시에는 세션의 User ID를 쓰므로 필요 없습니다.
    private Integer userId;
    private String cardColor;
    private Long creditLimit;
}