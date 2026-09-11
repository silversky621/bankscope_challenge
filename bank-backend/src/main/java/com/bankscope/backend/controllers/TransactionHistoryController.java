package com.bankscope.backend.controllers;

import com.bankscope.backend.entities.TransactionHistoryEntity;
import com.bankscope.backend.entities.UserEntity;
import com.bankscope.backend.results.TransactionResult;
import com.bankscope.backend.services.TransactionHistoryService;
import com.bankscope.backend.utils.SessionAuth;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.tuple.Pair;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping(value = "/api/transaction")
@RequiredArgsConstructor
public class TransactionHistoryController {
    private final TransactionHistoryService transactionHistoryService;

    @PostMapping(value = "/deposit", produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Map<String, Object> postDeposit(
            HttpSession session,
            @RequestBody(required = false) Map<String, Object> body,
            @RequestParam(value = "accountNumber", required = false) String accountNumber,
            @RequestParam(value = "amount", required = false) Long amount,
            @RequestParam(value = "description", required = false, defaultValue = "DEPOSIT") String description,
            @RequestParam(value = "taskId", required = false) Long taskId) {

        Map<String, Object> response = new HashMap<>();
        if (!SessionAuth.isMemberOrAdmin(session)) {
            response.put("result", "FAILURE_SESSION");
            return response;
        }

        accountNumber = stringValue(body, "accountNumber", accountNumber);
        amount = longValue(body, "amount", amount);
        description = stringValue(body, "description", description);
        taskId = longValue(body, "taskId", taskId);

        Pair<TransactionResult, TransactionHistoryEntity> result =
                this.transactionHistoryService.deposit(accountNumber, amount, description, taskId);
        response.put("result", result.getLeft().name());
        if (result.getLeft() == TransactionResult.SUCCESS) {
            response.put("transaction", result.getRight());
        }
        return response;
    }

    @PostMapping(value = "/withdraw", produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Map<String, Object> postWithdraw(
            HttpSession session,
            @RequestBody(required = false) Map<String, Object> body,
            @RequestParam(value = "accountNumber", required = false) String accountNumber,
            @RequestParam(value = "accountPassword", required = false) String accountPassword,
            @RequestParam(value = "amount", required = false) Long amount,
            @RequestParam(value = "description", required = false, defaultValue = "WITHDRAW") String description,
            @RequestParam(value = "taskId", required = false) Long taskId) {

        Map<String, Object> response = new HashMap<>();
        if (!SessionAuth.isMemberOrAdmin(session)) {
            response.put("result", "FAILURE_SESSION");
            return response;
        }

        accountNumber = stringValue(body, "accountNumber", accountNumber);
        accountPassword = stringValue(body, "accountPassword", accountPassword);
        amount = longValue(body, "amount", amount);
        description = stringValue(body, "description", description);
        taskId = longValue(body, "taskId", taskId);

        Pair<TransactionResult, TransactionHistoryEntity> result =
                this.transactionHistoryService.withdraw(accountNumber, accountPassword, amount, description, taskId);
        response.put("result", result.getLeft().name());
        if (result.getLeft() == TransactionResult.SUCCESS) {
            response.put("transaction", result.getRight());
        }
        return response;
    }

    @PostMapping(value = "/transfer", produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Map<String, Object> postTransfer(
            HttpSession session,
            @RequestBody(required = false) Map<String, Object> body,
            @RequestParam(value = "fromAccountNumber", required = false) String fromAccountNumber,
            @RequestParam(value = "accountPassword", required = false) String accountPassword,
            @RequestParam(value = "toAccountNumber", required = false) String toAccountNumber,
            @RequestParam(value = "amount", required = false) Long amount,
            @RequestParam(value = "description", required = false, defaultValue = "TRANSFER") String description,
            @RequestParam(value = "taskId", required = false) Long taskId) {

        Map<String, Object> response = new HashMap<>();
        fromAccountNumber = stringValue(body, "fromAccountNumber", fromAccountNumber);
        accountPassword = stringValue(body, "accountPassword", accountPassword);
        toAccountNumber = stringValue(body, "toAccountNumber", toAccountNumber);
        amount = longValue(body, "amount", amount);
        description = stringValue(body, "description", description);
        taskId = longValue(body, "taskId", taskId);

        UserEntity user = SessionAuth.user(session);
        boolean authorized = SessionAuth.isMemberOrAdmin(session)
                || (SessionAuth.isWebUser(session)
                && this.transactionHistoryService.isAccountOwnedBy(fromAccountNumber, user.getId()));
        if (!authorized) {
            response.put("result", user == null && !SessionAuth.isMember(session)
                    ? "FAILURE_SESSION"
                    : "FAILURE_NOT_ALLOWED");
            return response;
        }

        Pair<TransactionResult, TransactionHistoryEntity> result =
                this.transactionHistoryService.transfer(fromAccountNumber, accountPassword, toAccountNumber, amount, description, taskId);
        response.put("result", result.getLeft() != null ? result.getLeft().name() : "FAILURE");
        if (result.getLeft() == TransactionResult.SUCCESS) {
            response.put("transaction", result.getRight());
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
