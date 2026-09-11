package com.bankscope.backend.entities;


import lombok.*;

import java.time.LocalDateTime;

@Builder
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = "corporateManageId")
public class CorporateManagementEntity {
    private Integer corporateManageId;
    private Integer userId;
    private Integer loanId;
    private String riskGrade;
    private LocalDateTime defaultDate; // 부도 발생일
    private String reason; // 부모 발생이유 ( select 태그로 선택 )
    private String description; // 상세경위
    private LocalDateTime createdAt;

}
