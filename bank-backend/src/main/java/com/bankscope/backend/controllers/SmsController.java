package com.bankscope.backend.controllers;

import com.bankscope.backend.entities.UserEntity;
import com.bankscope.backend.services.SmsService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@Tag(name = "SMS인증", description ="SMS인증관련 api")
@RestController // @Controller에서 @RestController로 변경
@RequestMapping("/api/sms")
@RequiredArgsConstructor
public class SmsController {
    private final SmsService smsService;

    @RequestMapping(value = "/send", method = RequestMethod.POST)
    public Map<String, String> sendSms(HttpSession session, @RequestBody Map<String, String> request) {
        String phone = request.get("phone");
        UserEntity user = (UserEntity) session.getAttribute("user");

        if (user == null) {
            return Map.of("result", "FAILURE_SESSION");
        }
        if (phone == null || phone.isEmpty()) {
            return Map.of("result", "FAILURE");
        }
        if ( !user.getPhone().equals(phone)) {
            return Map.of("result", "FAILURE_NOT_SAME_PHONE");
        }
        try {
            smsService.sendAuthSms(phone);
            return Map.of("result", "SUCCESS");
        } catch (Exception e) {
            return Map.of("result", "FAILURE");
        }
    }
    
    @RequestMapping(value = "/verify", method = RequestMethod.POST)
    public Map<String, String> verifySms(@RequestBody Map<String, String> request) {
        String phone = request.get("phone");
        String code = request.get("code");

        boolean isVerified = smsService.verifyAuthCode(phone, code);

        if (isVerified) {
            return Map.of("result", "SUCCESS");
        } else {
            return Map.of("result", "FAILURE");
        }
    }
}
