package com.bankscope.backend.controllers;

import com.bankscope.backend.entities.UserEntity;
import com.bankscope.backend.results.CommonResult;
import com.bankscope.backend.results.PinResult;
import com.bankscope.backend.services.UserPinService;
import com.bankscope.backend.utils.SessionAuth;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping(value = "/api/pin")
@RequiredArgsConstructor
public class UserPinController {
    private final UserPinService userPinService;

    @PostMapping(value = "/", produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Map<String, Object> postUserPin(
            HttpSession session,
            @RequestBody(required = false) Map<String, Object> body,
            @RequestParam(value = "pin", required = false) String pin) {

        UserEntity user = SessionAuth.user(session);
        if (user == null) {
            return Map.of("result", CommonResult.FAILURE_SESSION.name());
        }
        CommonResult result = this.userPinService.createUserPin(user, stringValue(body, "pin", pin));
        Map<String, Object> response = new HashMap<>();
        response.put("result", result.name());
        return response;
    }

    @PatchMapping(value = "/", produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Map<String, Object> patchUserPin(
            HttpSession session,
            @RequestBody(required = false) Map<String, Object> body,
            @RequestParam(value = "pin", required = false) String pin) {

        UserEntity user = SessionAuth.user(session);
        if (user == null) {
            return Map.of("result", CommonResult.FAILURE_SESSION.name());
        }
        PinResult result = this.userPinService.updateUserPin(user, stringValue(body, "pin", pin));
        return Map.of("result", result.name());
    }

    @DeleteMapping(value = "/", produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Map<String, Object> deleteUserPin(HttpSession session) {
        UserEntity user = SessionAuth.user(session);
        if (user == null) {
            return Map.of("result", CommonResult.FAILURE_SESSION.name());
        }
        CommonResult result = this.userPinService.deleteUserPin(user);
        return Map.of("result", result.name());
    }

    @PostMapping(value = "/confirm", produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Map<String, Object> confirmUserPin(
            HttpSession session,
            @RequestBody(required = false) Map<String, Object> body,
            @RequestParam(value = "pin", required = false) String pin) {

        UserEntity user = SessionAuth.user(session);
        if (user == null) {
            return Map.of("result", CommonResult.FAILURE_SESSION.name());
        }
        CommonResult result = this.userPinService.checkUserPin(user, stringValue(body, "pin", pin));
        return Map.of("result", result.name());
    }

    private static String stringValue(Map<String, Object> body, String key, String fallback) {
        if (body == null || !body.containsKey(key) || body.get(key) == null) {
            return fallback;
        }
        return String.valueOf(body.get(key));
    }
}
