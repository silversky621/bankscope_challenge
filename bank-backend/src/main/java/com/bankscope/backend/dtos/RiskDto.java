package com.bankscope.backend.dtos;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class RiskDto {
    private String userName;
    private String userType;
    private String identificationNumber;

    private int totalLoanCount;
    private long totalOutstandingAmount;

    private int totalOverdueCount;
    private long totalOverdueAmount;
    private int maxOverdueDays;

    private int riskScore;

    private List<LoanInfo> loanDetails;

    @Data
    @Builder
    public static class LoanInfo {
        private Integer loanId;
        private String loanName;
        private long outstandingAmount;
        private String status;
        private int currentOverdueCount;
    }
}
