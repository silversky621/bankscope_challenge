package com.bankscope.backend.utils;

import java.util.List;

/** Canonical task names and the minimum staff level used by reception and transfer. */
public final class TaskRouting {
    private TaskRouting() {}

    public record Route(String detailType, String taskType, int minLevel, int minutes) {}

    public static final List<Route> ROUTES = List.of(
            new Route("입금", "빠른 업무", 1, 5), new Route("출금", "빠른 업무", 1, 5),
            new Route("카드수령", "빠른 업무", 1, 5), new Route("이체", "빠른 업무", 2, 5),
            new Route("체크카드 발급", "빠른 업무", 2, 5), new Route("통장 비밀번호 변경", "빠른 업무", 2, 5),
            new Route("입출금 계좌개설", "빠른 업무", 2, 5), new Route("적금", "상담 업무", 2, 10),
            new Route("신용카드 발급", "상담 업무", 2, 10), new Route("대출 상환", "상담 업무", 2, 10),
            new Route("예금", "상담 업무", 3, 10), new Route("신용대출", "상담 업무", 3, 10),
            new Route("전세자금대출", "상담 업무", 3, 10), new Route("금융상품가입", "상담 업무", 3, 10),
            new Route("소상공인 대출", "상담 업무", 4, 10), new Route("연금신청", "상담 업무", 4, 10),
            new Route("주택담보대출", "상담 업무", 4, 10), new Route("법인카드 발급", "기업 • 특수", 3, 25),
            new Route("법인계좌 개설", "기업 • 특수", 4, 25), new Route("기업대출", "기업 • 특수", 4, 25),
            new Route("연체관리", "기업 • 특수", 4, 25), new Route("부도관리", "기업 • 특수", 5, 25));

    public static Route find(String detailType) {
        return ROUTES.stream().filter(r -> r.detailType().equals(detailType)).findFirst().orElse(null);
    }
}
