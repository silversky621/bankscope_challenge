package com.bankscope.backend.enums;

public enum OtpStatus {
    ACTIVE,     // 정상 사용중
    LOCKED,     // 비밀번호 5회 오류 등으로 잠김
    REVOKED     // 재발급/해지 등으로 폐기됨
}