package com.bankscope.backend.entities;

import lombok.*;
import java.time.LocalDateTime;

@Builder
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = "cardId")
public class CardEntity {
    private Long cardId;
    private Integer userId;
    private Long accountId;
    private String cardName;     // 법인카드일 경우 "법인명" 또는 "법인명/사용자명"이 들어감
    private String cardNumber;
    private String cardType;     // "CHECK", "CREDIT", "CORP_CHECK", "CORP_CREDIT" 등
    private String cvc;
    private String status;       // "ACTIVE", "SUSPENDED", "REVOKED" 등
    private String validThru;
    private LocalDateTime issuedAt;

    // --- 💡 신용카드 처리를 위해 새로 추가된 3개의 필드 ---

    // 총 신용 한도 (체크카드는 null 또는 0)
    private Long creditLimit;

    // 현재까지 사용한 금액 (나중에 자동이체로 빠져나갈 결제 예정 금액)
    private Long usedAmount;
    // 매월 대금이 결제(출금)되는 날짜 (1~28 사이의 값)
    private Integer paymentDay;
    private String cardColor;
    private Boolean isActivated;
}
