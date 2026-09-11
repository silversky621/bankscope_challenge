package com.bankscope.backend.dtos;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class CorporateRiskDto {
    // 기본 정보
    private String companyName;
    private String businessNumber;

    // 부채 현황
    private int totalLoanCount; // 총 대출 건수
    private long totalOutstandingAmount; // 총 대출 잔액

    // 연체 현황 (가장 중요한 위험 지표)
    private int overdueCount; // 연체 중인 회차 수
    private long totalOverdueAmount; // 총 연체 금액
    private int maxOverdueDays; // 최장 연체 일수

    // 위험 등급 (로직에 따라 E, D, C 등으로 계산)
    private String riskGrade;

    // 상세 대출 목록
    private List<LoanInfo> loanDetails;

    @Data
    @Builder
    public static class LoanInfo {
        private Integer loanId;
        private String loanName; // 예: "다이렉트 직장인 신용대출"
        private long outstandingAmount;
        private String status; // ACTIVE, OVERDUE
        private int currentOverdueCount; // 해당 대출의 연체 회차 수
    }
}
