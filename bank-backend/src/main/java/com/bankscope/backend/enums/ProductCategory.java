package com.bankscope.backend.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum ProductCategory {
    CHECKING("입출금"),
    DEPOSIT("예금"),
    SAVINGS("적금"),
    LOAN("대출"),
    FUND("펀드"),
    CORPORATE("법인");

    // DB에는 Enum의 이름인 'DEPOSIT'이 자동으로 들어갑니다.
    // 이 description은 화면에 "예금"이라고 출력할 때만 꺼내 씁니다.
    private final String description;
}