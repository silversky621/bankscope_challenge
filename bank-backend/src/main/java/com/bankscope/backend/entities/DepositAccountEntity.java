package com.bankscope.backend.entities;


import com.bankscope.backend.enums.MaturityTreatment;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DepositAccountEntity {
        private Long accountId;
        private Long linkedAccountId;
        private MaturityTreatment maturityTreatment;
}
