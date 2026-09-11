package com.bankscope.backend.dtos;

import com.bankscope.backend.entities.CorporateManagementEntity;
import lombok.*;

import java.time.LocalDateTime;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CorporateManagementDto {
    private Integer corporateManageId;
    private Integer userId;
    private Integer loanId;
    private String riskGrade;
    private LocalDateTime defaultDate;
    private String reason;
    private String description;
    private LocalDateTime createdAt;

    public static CorporateManagementEntity toEntity(CorporateManagementDto dto) {
        if (dto == null) {
            return null;
        }
        return CorporateManagementEntity.builder()
                .corporateManageId(dto.getCorporateManageId())
                .userId(dto.getUserId())
                .loanId(dto.getLoanId())
                .riskGrade(dto.getRiskGrade())
                .defaultDate(dto.getDefaultDate())
                .reason(dto.getReason())
                .description(dto.getDescription())
                .createdAt(dto.getCreatedAt())
                .build();
    }

    public static CorporateManagementDto fromEntity(CorporateManagementEntity entity) {
        if (entity == null) {
            return null;
        }
        return CorporateManagementDto.builder()
                .corporateManageId(entity.getCorporateManageId())
                .userId(entity.getUserId())
                .loanId(entity.getLoanId())
                .riskGrade(entity.getRiskGrade())
                .defaultDate(entity.getDefaultDate())
                .reason(entity.getReason())
                .description(entity.getDescription())
                .createdAt(entity.getCreatedAt())
                .build();
    }
}
