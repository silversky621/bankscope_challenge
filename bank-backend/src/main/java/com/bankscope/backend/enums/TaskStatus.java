package com.bankscope.backend.enums;

import lombok.Getter;

@Getter
public enum TaskStatus {
    WAITING("키오스크 접수 후 대기 중"),
    CALLED("호출 후 고객의 창구 도착을 기다리는 중"),
    IN_PROGRESS("행원과 고객이 만나 업무를 처리 중"),
    COMPLETED("상담 종료"),
    NO_SHOW("미방문으로 접수 종료");
    private final String description;

    TaskStatus(String description) {
        this.description = description;
    }

}
