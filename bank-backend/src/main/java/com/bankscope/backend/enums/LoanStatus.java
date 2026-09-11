package com.bankscope.backend.enums;

public enum LoanStatus {
    ACTIVE,      // 대출 중
    COMPLETED,   // 완납
    OVERDUE,     // 연체
    PENDING,      // 승인 대기
    BANKRUPTCY    // 부도
}