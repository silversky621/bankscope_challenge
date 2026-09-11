package com.bankscope.backend.controllers;

import com.bankscope.backend.dtos.CardRequestDto;
import com.bankscope.backend.entities.CardEntity;
import com.bankscope.backend.entities.UserEntity;
import com.bankscope.backend.services.CardService;
import com.bankscope.backend.results.CommonResult;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.tuple.Pair;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Tag(name = "카드(Card)", description = "카드 발급 및 관리 API")
@RestController
@RequestMapping(value = "/api/card")
@RequiredArgsConstructor
public class CardController {

    private final CardService cardService;
    private static final String CARD_STATUS_ISSUING = "ISSUING";
    private static final String CARD_STATUS_ACTIVE = "ACTIVE";
    private static final String CARD_STATUS_SUSPENDED = "SUSPENDED";

    // =================================================================
    // 🌐 [웹사이트/앱] 일반 고객 전용 API
    // =================================================================

    @Operation(summary = "카드 발급 (웹사이트용)", description = "웹사이트에서 일반 고객이 카드를 발급받습니다.")
    @PostMapping(value = "/", produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> createCard(@RequestBody CardRequestDto requestDto, HttpSession session) {
        Map<String, Object> response = new HashMap<>();
        UserEntity user = (UserEntity) session.getAttribute("user");

        // 1. 로그인 여부 확인
        if (user == null) {
            response.put("result", "FAILURE_SESSION");
            return response;
        }
        if (!"web".equals(session.getAttribute("loginType"))) {
            response.put("result", "FAILURE_NOT_ALLOWED");
            response.put("message", "카드 발급은 웹 로그인 후 이용 가능합니다.");
            return response;
        }
        // 핀번호 인증은 프론트에서 확인해줍니다.

        // 3. 🚫 법인(corporate) 회원의 비대면 웹사이트 발급 원천 차단
        if (user.getUserType().equals("corporate")) {
            response.put("result", "FAILURE_CORPORATE_NOT_ALLOWED");
            response.put("message", "법인 카드는 영업점을 방문하여 발급해야 합니다.");
            return response;
        }

        // 4. 안전한 서비스 발급 로직 호출
        CommonResult result = this.cardService.createCard(requestDto, user);

        // 5. 발급이 완료되면 보안을 위해 핀 인증 통과 세션을 즉시 파기 (일회성 인증)
        if (result == CommonResult.SUCCESS) {
            response.put("result", result.name());
        }
        return response;
    }

    @Operation(summary = "내 카드 목록 조회", description = "로그인한 사용자가 보유한 모든 카드 목록을 조회합니다.")
    @GetMapping(value = "/", produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> getMyCards(HttpSession session) {
        Map<String, Object> response = new HashMap<>();
        UserEntity user = (UserEntity) session.getAttribute("user");

        if (user == null) {
            response.put("result", "FAILURE_SESSION");
            return response;
        }

        List<CardEntity> cards = this.cardService.getCardsByUserId(user.getId());
        response.put("result", CommonResult.SUCCESS.name());
        response.put("cards", cards);
        return response;
    }

    @Operation(summary = "카드 상세 조회", description = "특정 카드의 상세 정보(CVC, 유효기간 등)를 조회합니다.")
    @GetMapping(value = "/{cardId}", produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> getCardDetail(@PathVariable("cardId") Long cardId, HttpSession session) {
        Map<String, Object> response = new HashMap<>();
        UserEntity user = (UserEntity) session.getAttribute("user");

        if (user == null) {
            response.put("result", "FAILURE_SESSION");
            return response;
        }

        // 서비스에서 본인 소유인지 다시 한번 검증함
        Pair<CommonResult, CardEntity> result = this.cardService.getCardById(cardId, user.getId());
        response.put("result", result.getLeft().name());

        if (result.getLeft() == CommonResult.SUCCESS) {
            response.put("card", result.getRight());
        }
        return response;
    }

    @Operation(summary = "카드 상태 변경", description = "카드의 상태를 변경합니다 (예: 분실 신고, 정지 해제).")
    @PatchMapping(value = "/{cardId}/status", produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> updateCardStatus(
            @PathVariable("cardId") Long cardId,
            @RequestParam("status") String status,
            HttpSession session) {
        Map<String, Object> response = new HashMap<>();
        UserEntity user = (UserEntity) session.getAttribute("user");

        if (user == null) {
            response.put("result", "FAILURE_SESSION");
            return response;
        }

        // 고객은 활성 카드 정지와 정지 카드 해제만 직접 요청할 수 있다.
        // 발급대기(ISSUING) 카드의 활성화는 창구 수령 절차이므로 고객 API로는 차단한다(수령 우회 방지).
        Pair<CommonResult, CardEntity> cardResult = this.cardService.getCardById(cardId, user.getId());
        if (cardResult.getLeft() != CommonResult.SUCCESS) {
            response.put("result", "FAILURE");
            return response;
        }
        String current = cardResult.getRight().getStatus();
        String targetStatus = normalizeCardStatus(status);
        if (!isCustomerStatusTransitionAllowed(current, targetStatus)) {
            response.put("result", "FAILURE_NOT_ALLOWED");
            return response;
        }

        CommonResult result = this.cardService.updateCardStatus(cardId, targetStatus, user.getId());
        response.put("result", result.name());
        return response;
    }

    @Operation(summary = "카드 해지/삭제", description = "카드를 해지(또는 삭제)합니다.")
    @DeleteMapping(value = "/{cardId}", produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> deleteCard(@PathVariable("cardId") Long cardId, HttpSession session) {
        Map<String, Object> response = new HashMap<>();
        UserEntity user = (UserEntity) session.getAttribute("user");

        if (user == null) {
            response.put("result", "FAILURE_SESSION");
            return response;
        }

        CommonResult result = this.cardService.deleteCard(cardId, user.getId());
        response.put("result", result.name());
        return response;
    }

    // =================================================================
    // 🏢 [워크스페이스] 행원 전용 API
    // =================================================================

    @Operation(summary = "카드 발급 (행원용)", description = "워크스페이스에서 법인/개인 고객을 대신하여 카드를 발급합니다.")
    @PostMapping(value = "/workspace", produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> createCardByWorkspace(@RequestBody CardRequestDto requestDto, HttpSession session) {
        Map<String, Object> response = new HashMap<>();

        // 행원 권한 검증 (member 세션 확인)
        if (session.getAttribute("member") == null) {
            response.put("result", "FAILURE_SESSION");
            return response;
        }

        // 행원은 대면 확인을 하므로 핀 인증 없이 DTO만 넘겨 발급 처리
        CommonResult result = this.cardService.createCardByMember(requestDto);
        response.put("result", result.name());
        return response;
    }

    @Operation(summary = "고객 카드 목록 조회 (행원용)", description = "행원이 특정 고객(userId)의 카드 목록을 조회합니다.")
    @GetMapping(value = "/workspace/list", produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> getWorkspaceCards(@RequestParam("userId") Integer targetUserId, HttpSession session) {
        Map<String, Object> response = new HashMap<>();

        if (session.getAttribute("member") == null) {
            response.put("result", "FAILURE_SESSION");
            return response;
        }

        List<CardEntity> cards = this.cardService.getCardsByUserId(targetUserId);
        response.put("result", CommonResult.SUCCESS.name());
        response.put("cards", cards);
        return response;
    }

    @Operation(summary = "고객 카드 상태 변경 (행원용)", description = "행원이 특정 고객의 카드 상태를 강제로 변경합니다.")
    @PatchMapping(value = "/workspace/{cardId}/status", produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> updateWorkspaceCardStatus(
            @PathVariable("cardId") Long cardId,
            @RequestParam("status") String status,
            @RequestParam("userId") Integer targetUserId,
            HttpSession session) {
        Map<String, Object> response = new HashMap<>();

        if (session.getAttribute("member") == null) {
            response.put("result", "FAILURE_SESSION");
            return response;
        }

        Pair<CommonResult, CardEntity> cardResult = this.cardService.getCardById(cardId, targetUserId);
        if (cardResult.getLeft() != CommonResult.SUCCESS) {
            response.put("result", "FAILURE");
            return response;
        }

        String targetStatus = normalizeCardStatus(status);
        if (!isWorkspaceStatusTransitionAllowed(cardResult.getRight().getStatus(), targetStatus)) {
            response.put("result", "FAILURE_NOT_ALLOWED");
            return response;
        }

        CommonResult result = this.cardService.updateCardStatus(cardId, targetStatus, targetUserId);
        response.put("result", result.name());
        return response;
    }

    @Operation(summary = "고객 카드 해지/삭제 (행원용)", description = "행원이 특정 고객의 카드를 해지(삭제)합니다.")
    @DeleteMapping(value = "/workspace/{cardId}", produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> deleteWorkspaceCard(
            @PathVariable("cardId") Long cardId,
            @RequestParam("userId") Integer targetUserId,
            HttpSession session) {
        Map<String, Object> response = new HashMap<>();

        if (session.getAttribute("member") == null) {
            response.put("result", "FAILURE_SESSION");
            return response;
        }

        CommonResult result = this.cardService.deleteCard(cardId, targetUserId);
        response.put("result", result.name());
        return response;
    }

    private static String normalizeCardStatus(String status) {
        return status == null ? null : status.trim().toUpperCase(Locale.ROOT);
    }

    private static boolean isCustomerStatusTransitionAllowed(String currentStatus, String targetStatus) {
        return (CARD_STATUS_ACTIVE.equals(currentStatus) && CARD_STATUS_SUSPENDED.equals(targetStatus))
                || (CARD_STATUS_SUSPENDED.equals(currentStatus) && CARD_STATUS_ACTIVE.equals(targetStatus));
    }

    private static boolean isWorkspaceStatusTransitionAllowed(String currentStatus, String targetStatus) {
        return CARD_STATUS_ISSUING.equals(currentStatus) && CARD_STATUS_ACTIVE.equals(targetStatus);
    }
}
