package com.bankscope.backend.dtos;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CorporateAccountRequestDto {
    private Integer taskId;       // 창구 발급 시 연결할 업무 ID (비대면이면 null)
    private Integer productId;    // 가입할 법인용 예금 상품 ID
    private Long amount;          // 최초 개설 시 입금할 금액 (보통 0원도 가능)
    private String accountPassword; // 계좌 비밀번호
    private String accountAlias;    // 계좌 별칭 (예: "본사 운영자금 계좌")
    private Integer userId;
    private String identificationNumber; // 사업자 등록번호
}
