package com.bankscope.backend.controllers;

import com.bankscope.backend.dtos.RepayRequestDto;
import com.bankscope.backend.entities.LoanEntity;
import com.bankscope.backend.entities.LoanScheduleEntity;
import com.bankscope.backend.entities.MemberEntity;
import com.bankscope.backend.entities.UserEntity;
import com.bankscope.backend.mappers.LoanScheduleMapper;
import com.bankscope.backend.results.CommonResult;
import com.bankscope.backend.results.LoanResult;
import com.bankscope.backend.services.LoanService;
import com.bankscope.backend.services.UserService;
import com.bankscope.backend.utils.SessionAuth;
import com.bankscope.backend.vos.LoanVo;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.tuple.Pair;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Tag(name = "대출(Loan)", description = "대출 조회 및 상환 API")
@RestController
@RequestMapping(value = "/api/loan")
@RequiredArgsConstructor
public class LoanController {

    private final LoanService loanService;
    private final UserService userService;
    private final LoanScheduleMapper loanScheduleMapper;

    @Operation(summary = "내 대출 목록 조회", description = "로그인한 고객의 전체 대출 목록을 조회합니다.")
    @GetMapping(value = "", produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> getMyLoans(HttpSession session) {
        Map<String, Object> response = new HashMap<>();
        UserEntity user = (UserEntity) session.getAttribute("user");
        Pair<LoanResult, List<LoanVo>> result = loanService.getMyLoans(user);
        response.put("result", result.getLeft().name());
        if (result.getLeft() == LoanResult.SUCCESS) {
            response.put("loans", result.getRight());
        }
        return response;
    }

    @Operation(summary = "특정유저의 대출 목록 조회", description = "로그인한 고객의 전체 대출 목록을 조회합니다.")
    @GetMapping(value = "/user", produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> getUserLoans(@RequestParam("userId") Integer userId, HttpSession session) {
        Map<String, Object> response = new HashMap<>();
        if (!SessionAuth.isMemberOrAdmin(session) && !SessionAuth.isSameUser(session, userId)) {
            response.put("result", SessionAuth.user(session) == null && !SessionAuth.isMember(session)
                    ? LoanResult.FAILURE_SESSION.name()
                    : LoanResult.FAILURE_UNAUTHORIZED.name());
            return response;
        }
        Pair<LoanResult, List<LoanVo>> result = loanService.getUserLoans(userId);
        response.put("result", result.getLeft().name());
        if (result.getLeft() == LoanResult.SUCCESS) {
            response.put("loans", result.getRight());
        }
        return response;
    }

    @Operation(summary = "대출 상세 조회", description = "관리자가 특정 대출의 상세 정보를 조회합니다.")
    @GetMapping(value = "/{loanId}", produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> getLoanDetail(@PathVariable Integer loanId,
                                             HttpSession session) {
        Map<String, Object> response = new HashMap<>();
        UserEntity user = (UserEntity) session.getAttribute("user");
        Pair<LoanResult, LoanEntity> result = loanService.getLoanDetail(loanId, user, SessionAuth.isMemberOrAdmin(session));
        response.put("result", result.getLeft().name());
        if (result.getLeft() == LoanResult.SUCCESS) {
            response.put("loan", result.getRight());
        }
        return response;
    }
    @Operation(summary = "대출 상세 조회", description = "관리자가 특정 대출의 상세 정보를 조회합니다.")
    @GetMapping(value = "/{loanId}/", produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> getLoanVoDetail(@PathVariable Integer loanId,
                                             HttpSession session) {
        Map<String, Object> response = new HashMap<>();
        UserEntity user = (UserEntity) session.getAttribute("user");
        Pair<LoanResult, LoanVo> result = loanService.getLoanVoDetail(loanId, user, SessionAuth.isMemberOrAdmin(session));
        response.put("result", result.getLeft().name());
        if (result.getLeft() == LoanResult.SUCCESS) {
            response.put("loan", result.getRight());
        }
        return response;
    }

    @Operation(summary = "대출 신청 (비대면 웹/앱용)", description = "고객이 직접 비대면으로 대출을 신청합니다.")
    @PostMapping(value = "/apply", produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> applyLoan(@RequestBody Map<String, Object> requestBody, HttpSession session) {
        Map<String, Object> response = new HashMap<>();
        UserEntity user = (UserEntity) session.getAttribute("user");

        if (user == null) {
            response.put("result", LoanResult.FAILURE_SESSION.name());
            return response;
        }
        if (!"web".equals(session.getAttribute("loginType"))) {
            response.put("result", LoanResult.FAILURE_NOT_ALLOWED.name());
            return response;
        }

        try {
            Integer productId = (Integer) requestBody.get("productId");
            Long linkedAccountId = ((Number) requestBody.get("linkedAccountId")).longValue();
            Long principalAmount = ((Number) requestBody.get("principalAmount")).longValue();
            Integer durationMonths = (Integer) requestBody.get("durationMonths");
            Integer paymentDay = (Integer) requestBody.get("paymentDay");
            String info = (String) requestBody.get("info");

            Pair<LoanResult, LoanEntity> result = loanService.applyLoanFromWeb(
                    user, productId, linkedAccountId, principalAmount, durationMonths, paymentDay, info);

            response.put("result", result.getLeft().name());
            if (result.getLeft() == LoanResult.SUCCESS) {
                response.put("loan", result.getRight());
            }
        } catch (Exception e) {
            response.put("result", LoanResult.FAILURE.name());
            response.put("message", "요청 파라가 올바르지 않습니다.");
        }
        
        return response;
    }

    @Operation(summary = "대출 신청 (행원 워크스페이스용)", description = "행원이 상담 후 고객의 대출을 개설해 줍니다.")
    @PostMapping(value = "/workspace/apply", produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> applyLoanByWorkspace(@RequestBody Map<String, Object> requestBody, HttpSession session) {
        Map<String, Object> response = new HashMap<>();
        MemberEntity member = (MemberEntity) session.getAttribute("member");

        if (member == null) {
            response.put("result", LoanResult.FAILURE_SESSION.name());
            return response;
        }

        try {
            Integer targetUserId = (Integer) requestBody.get("userId");
            Integer productId = ((Number) requestBody.get("productId")).intValue();
            Long linkedAccountId = ((Number) requestBody.get("linkedAccountId")).longValue();
            Long principalAmount = ((Number) requestBody.get("principalAmount")).longValue();
            Integer durationMonths = ((Number) requestBody.get("durationMonths")).intValue();
            Integer paymentDay = ((Number) requestBody.get("paymentDay")).intValue();
            String info = (String) requestBody.get("info");
            Long taskId = requestBody.containsKey("taskId") ? ((Number) requestBody.get("taskId")).longValue() : null;

            Pair<LoanResult, LoanEntity> result = loanService.applyLoanByMember(
                    member, targetUserId, productId, linkedAccountId, principalAmount, durationMonths, paymentDay, info, taskId);

            response.put("result", result.getLeft().name());
            if (result.getLeft() == LoanResult.SUCCESS) {
                response.put("loan", result.getRight());
            }
        } catch (Exception e) {
            System.err.println("[대출 신청 오류] " + e.getMessage());
            e.printStackTrace();
            response.put("result", LoanResult.FAILURE.name());
            response.put("message", "요청 파라미터가 올바르지 않습니다.");
        }
        
        return response;
    }



    @Operation(summary = "대출 정보 수정 (관리자용)",
            description = "기존 대출의 정보(이율, 상환일 등)를 수정합니다.")
    @PatchMapping(value = "/{loanId}", produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> updateLoanInfo(@PathVariable("loanId") Integer loanId,
                                              @RequestBody LoanEntity loanInfo,
                                              HttpSession session) {
        Map<String, Object> response = new HashMap<>();
        UserEntity user = (UserEntity) session.getAttribute("user");
        loanInfo.setLoanId(loanId);
        LoanResult result = loanService.updateLoan(loanInfo, user);
        response.put("result", result.name());
        return response;
    }

    /**
     * 대출 상환 API
     * POST /api/loans/{loanId}/repay
     */
    @Operation(summary = "대출 상환",
            description ="계좌에서 출금하여 대출을 스케줄대로 상환합니다.")
    @PostMapping(value = "/{loanId}/repay", produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String,Object> repayLoan(
            @PathVariable Integer loanId,
            @RequestBody RepayRequestDto request,
            HttpSession session) {
        Map<String,Object> response = new HashMap<>();

        MemberEntity member = (MemberEntity) session.getAttribute("member");
        if (member == null) {
            response.put("result", LoanResult.FAILURE_SESSION.name());
            return response;
        }

        Pair<CommonResult, UserEntity> user = this.userService.getUserInfo(request.getUserId());
        if (user.getLeft() != CommonResult.SUCCESS) {
             response.put("result", LoanResult.FAILURE.name());
             return response;
        }

        // 서비스의 상환 비즈니스 로직 호출
        Pair<LoanResult, LoanEntity> result = loanService.repayLoan(
                loanId,
                request.getAccountNumber(),
                request.getAccountPassword(),
                user.getRight()
        );
        response.put("result", result.getLeft().name());
        if (result.getLeft() == LoanResult.SUCCESS) {
            response.put("loan", result.getRight());
        }
        return response;
    }
    
    @Operation(summary = "대출 중도 상환",
            description ="계좌에서 출금하여 잔여대출의 원금을 깎거나 전부 완납(청산)합니다. ")
    @PostMapping(value = "/{loanId}/repay-early", produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> repayEarlyLoan(@PathVariable Integer loanId,
                                            @RequestBody RepayRequestDto request,
                                            HttpSession session
                                            ){
        Map<String, Object> response = new HashMap<>();
        MemberEntity member = (MemberEntity) session.getAttribute("member");
        if (member == null) {
            response.put("result", LoanResult.FAILURE_SESSION.name());
            return response;
        }

        Pair<CommonResult, UserEntity> user = this.userService.getUserInfo(request.getUserId());
        if (user.getLeft() != CommonResult.SUCCESS) {
             response.put("result", LoanResult.FAILURE.name());
             return response;
        }

        Pair<LoanResult, LoanEntity> result = loanService.earlyRepayLoan(
                loanId,
                request.getAccountNumber(),
                request.getAccountPassword(),
                request.getRepayAmount(),
                user.getRight()
        );
        response.put("result", result.getLeft().name());
        if (result.getLeft() == LoanResult.SUCCESS) {
            response.put("loan", result.getRight());
        }

        return response;
    }

    @Operation(summary = "대출 상환상태 조회",
            description ="현재 연체횟수가 얼마인지 얼마나 완료되었는지 확인가능합니다.")
    @RequestMapping(value = "/schedules", method = RequestMethod.GET, produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String,Object> getLoanSchedules(@RequestParam(value = "loanId") Long loanId, HttpSession session) {
        Map<String,Object> response = new HashMap<>();
        Pair<LoanResult, List<LoanScheduleEntity>> result = loanService.getLoanSchedules(loanId, SessionAuth.user(session), SessionAuth.isMemberOrAdmin(session));
        if (result.getLeft() == LoanResult.SUCCESS) {
            response.put("result", result.getRight());
        } else {
            response.put("result", result.getLeft().name());
        }
        return  response;
    }
}
