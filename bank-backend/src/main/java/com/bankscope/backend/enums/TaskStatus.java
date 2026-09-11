package com.bankscope.backend.enums;

import lombok.Getter;

@Getter
public enum TaskStatus {
    WAITING("키오스크 접수 후 대기 중"),
    IN_PROGRESS("행원과 고객이 만나 업무를 처리 중"),
    COMPLETED("업무 처리 완료");
    private final String description;

    TaskStatus(String description) {
        this.description = description;
    }

}