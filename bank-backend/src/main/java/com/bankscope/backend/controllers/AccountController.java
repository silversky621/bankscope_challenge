package com.bankscope.backend.controllers;


import com.bankscope.backend.dtos.CorporateAccountRequestDto;
import com.bankscope.backend.dtos.DepositAccountRequestDto;
import com.bankscope.backend.dtos.SavingsAccountRequestDto;
import com.bankscope.backend.entities.UserEntity;
import com.bankscope.backend.results.AccountResult;
import com.bankscope.backend.services.AccountService;
import com.bankscope.backend.services.SavingsService;
import com.bankscope.backend.utils.SessionAuth;
import com.bankscope.backend.vos.AccountVo;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.tuple.Pair;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


@Tag(name = "계좌(Account)", description = "계좌 관련 api ")
@RestController
@RequestMapping(value = "/api/account")
@RequiredArgsConstructor
public class AccountController {

    private final AccountService accountService;
    private final SavingsService savingsService;

    @Operation(summary = "일반예금 계좌 개설", description = "손님(개인)의 일반 입출금 예금통장을 등록합니다.")
    @RequestMapping(value = "/register", method = RequestMethod.POST, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Map<String, Object> postAccount(HttpSession session, @RequestBody DepositAccountRequestDto requestDto) {
        Map<String, Object> response = new HashMap<>();
        Object sessionMember = session.getAttribute("member");

        if (sessionMember == null) {
            response.put("result", "FAILURE");
            response.put("message", "세션에 로그인 정보가 없습니다.");
            return response;
        }

        // 일반 예금(입출금) 계좌 개설 서비스 호출
        Pair<AccountResult, AccountVo> result = this.accountService.createAccount(requestDto);
        response.put("result", result.getLeft().name());

        if (result.getLeft() == AccountResult.SUCCESS) {
            response.put("account", result.getRight());
        }

        return response;
    }

    @Operation(summary = "통장비밀번호 일치조회", description = "손님의 통장비밀번호의 일치여부를 조회합니다.")
    @RequestMapping(value = "/account-password", method = RequestMethod.POST, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Map<String, Object> postAccountPassword(HttpSession session,
                                                   @RequestBody(required = false) Map<String, Object> body,
                                                   @RequestParam(value = "accountId", required = false) Long accountId,
                                                   @RequestParam(value = "accountPassword", required = false) String accountPassword) {
        Map<String, Object> response = new HashMap<>();
        accountId = longValue(body, "accountId", accountId);
        accountPassword = stringValue(body, "accountPassword", accountPassword);

        AccountVo account = accountId == null ? null : this.accountService.getAccountById(accountId);
        if (account == null) {
            response.put("result", AccountResult.FAILURE.name());
            return response;
        }

        UserEntity user = (UserEntity) session.getAttribute("user");
        boolean authorized = SessionAuth.isMemberOrAdmin(session)
                || (SessionAuth.isWebUser(session) && user != null && account.getUserId().equals(user.getId()));
        if (!authorized) {
            response.put("result", user == null && !SessionAuth.isMember(session) ? "FAILURE_SESSION" : "FAILURE_NOT_ALLOWED");
            return response;
        }

        AccountResult result = this.accountService.checkAccountPassword(accountId, accountPassword);
        response.put("result", result.name());
        return response;
    }

    @Operation(summary = "통장비밀번호 변경", description = "손님의 통장비밀번호를 변경합니다.")
    @PatchMapping(value = "/account-password", produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Map<String, Object> patchAccountPassword(
            HttpSession session,
            @RequestParam(value = "accountId") Long accountId,
            @RequestParam(value = "oldPassword") String oldPassword,
            @RequestParam(value = "newPassword") String newPassword) {

        Map<String, Object> response = new HashMap<>();
        Object sessionMember = session.getAttribute("member");

        // 1. 세션 체크
        if (sessionMember == null) {
            response.put("result", "FAILURE");
            response.put("message", "세션에 로그인 정보가 없습니다.");
            return response;
        }

        AccountResult result = this.accountService.modifyAccountPassword(accountId, oldPassword ,newPassword);

        if (result == AccountResult.SUCCESS) {
            response.put("result", AccountResult.SUCCESS.name());
            response.put("message", "비밀번호가 성공적으로 변경되었습니다.");
        } else {
            response.put("result", AccountResult.FAILURE.name());
            response.put("message", "계좌 정보를 찾을 수 없거나 변경에 실패했습니다.");
        }

        return response;
    }

    @Operation(summary = "내 계좌 목록 및 잔액 조회", description = "로그인한 사용자의 계좌 목록과 잔액을 조회합니다.")
    @RequestMapping(value = "/list", method = RequestMethod.GET, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Map<String, Object> getMyAccounts(HttpSession session) {
        Map<String, Object> response = new HashMap<>();
        UserEntity user = (UserEntity) session.getAttribute("user");

        if (user == null) {
            response.put("result", AccountResult.FAILURE.name());
            response.put("message", "로그인이 필요합니다.");
            return response;
        }

        List<AccountVo> accounts = this.accountService.getMyAccounts(user.getId());
        response.put("result", AccountResult.SUCCESS.name());
        response.put("accounts", accounts);

        return response;
    }

    @Operation(summary = "특정 유저의 계좌 목록 조회 (행원용)", description = "유저 ID를 통해 해당 유저의 모든 계좌 목록을 조회합니다.")
    @RequestMapping(value = "/user/{userId}", method = RequestMethod.GET, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Map<String, Object> getUserAccounts(@PathVariable("userId") Integer userId, HttpSession session) {
        Map<String, Object> response = new HashMap<>();
        if (!SessionAuth.isMemberOrAdmin(session) && !SessionAuth.isSameUser(session, userId)) {
            response.put("result", SessionAuth.user(session) == null && !SessionAuth.isMember(session) ? "FAILURE_SESSION" : "FAILURE_NOT_ALLOWED");
            return response;
        }
        
        List<AccountVo> accounts = this.accountService.getMyAccounts(userId);
        response.put("result", AccountResult.SUCCESS.name());
        response.put("accounts", accounts);
        
        return response;
    }

    @Operation(summary = "특정 계좌 잔고 조회", description = "계좌번호로 특정 계좌의 정보 및 잔고를 조회합니다.")
    @RequestMapping(value = "/balance", method = RequestMethod.GET, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Map<String, Object> getAccountBalance(@RequestParam(value = "accountNumber") String accountNumber, HttpSession session) {
        Map<String, Object> response = new HashMap<>();
        
        AccountVo account = this.accountService.getAccountByAccountNumber(accountNumber);
        if (account != null) {
            if (!SessionAuth.isMemberOrAdmin(session) && !SessionAuth.isSameUser(session, account.getUserId())) {
                response.put("result", SessionAuth.user(session) == null && !SessionAuth.isMember(session) ? "FAILURE_SESSION" : "FAILURE_NOT_ALLOWED");
                return response;
            }
            response.put("result", AccountResult.SUCCESS.name());
            response.put("balance", account.getBalance());
            response.put("accountAlias", account.getAccountAlias());
        } else {
            response.put("result", AccountResult.FAILURE.name());
            response.put("message", "계좌를 찾을 수 없습니다.");
        }
        
        return response;
    }

    @Operation(summary = "예금 계좌 개설", description = "손님의 예금계좌를 개설합니다.")
    @RequestMapping(value = "/deposit", method = RequestMethod.POST, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Map<String, Object> postDepositAccount(HttpSession session, @RequestBody DepositAccountRequestDto requestDto) {
        Map<String, Object> response = new HashMap<>();
        Object sessionMember = session.getAttribute("member");

        if (sessionMember == null) {
            response.put("result", "FAILURE");
            response.put("message", "세션에 로그인 정보가 없습니다.");
            return response;
        }

        Pair<AccountResult, AccountVo> result = this.accountService.createDepositAccount(requestDto);
        response.put("result", result.getLeft().name());

        if (result.getLeft() == AccountResult.SUCCESS) {
            response.put("account", result.getRight());
        }

        return response;
    }

    /**
     * 정기 적금 계좌 개설 API
     */
    @Operation(summary = "적금 계좌 개설", description = "손님의 적금계좌를 개설합니다.")
    @RequestMapping(value = "/savings", method = RequestMethod.POST, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public ResponseEntity<Map<String, Object>> createSavingsAccount(
            @RequestBody SavingsAccountRequestDto dto,
            HttpSession session) {

        Map<String, Object> response = new HashMap<>();
        Object sessionMember = session.getAttribute("member");


        if (sessionMember == null) {
            response.put("result", "FAILURE");
            response.put("message", "세션에 로그인 정보가 없습니다.");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
        }

        Pair<AccountResult, AccountVo> resultPair =
                savingsService.createSavingsAccount(dto);


        AccountResult status = resultPair.getLeft();
        AccountVo createdAccount = resultPair.getRight();

        if (status == AccountResult.SUCCESS) {

            response.put("result", "SUCCESS");
            response.put("message", "적금 계좌가 성공적으로 개설되었습니다.");
            response.put("data", createdAccount);
            return ResponseEntity.ok(response);
        } else {
            response.put("result", status.name());
            response.put("message", "계좌 개설에 실패했습니다. (사유: " + status.name() + ")");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
        }
    }

    @Operation(summary = "법인 계좌 개설", description = "법인 회원의 운영 자금 보관을 위한 만기 없는 입출금 계좌를 개설합니다.")
    @RequestMapping(value = "/corporate", method = RequestMethod.POST, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Map<String, Object> postCorporateAccount(HttpSession session, @RequestBody CorporateAccountRequestDto requestDto) {
        Map<String, Object> response = new HashMap<>();
        Object sessionMember = session.getAttribute("member");

        // 1. 세션 체크
        if (sessionMember == null) {
            response.put("result", "FAILURE");
            response.put("message", "세션에 로그인 정보가 없습니다.");
            return response;
        }

        // 2. 서비스 단 호출
        Pair<AccountResult, AccountVo> result = this.accountService.createCorporateAccount(requestDto);
        response.put("result", result.getLeft().name());

        // 3. 결과 반환
        if (result.getLeft() == AccountResult.SUCCESS) {
            response.put("account", result.getRight());
        } else if (result.getLeft() == AccountResult.FAILURE_USER_NOT_EXIST) {
            response.put("message", "존재하지않는 사람입니다.");
        } else if (result.getLeft() == AccountResult.FAILURE_NOT_CORPORATE_USER) {
            response.put("message", "법인 회원이 아닙니다.");
        } else {
            response.put("message", "계좌 개설에 실패하였습니다.");

        }
            return response;
    }

    private static String stringValue(Map<String, Object> body, String key, String fallback) {
        if (body == null || !body.containsKey(key) || body.get(key) == null) {
            return fallback;
        }
        return String.valueOf(body.get(key));
    }

    private static Long longValue(Map<String, Object> body, String key, Long fallback) {
        if (body == null || !body.containsKey(key) || body.get(key) == null) {
            return fallback;
        }
        Object value = body.get(key);
        if (value instanceof Number number) {
            return number.longValue();
        }
        try {
            return Long.valueOf(String.valueOf(value));
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }


}
