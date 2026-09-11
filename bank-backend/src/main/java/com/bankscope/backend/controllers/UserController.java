package com.bankscope.backend.controllers;

import com.bankscope.backend.entities.EmailTokenEntity;
import com.bankscope.backend.entities.MemberEntity;
import com.bankscope.backend.entities.UserEntity;
import com.bankscope.backend.results.CommonResult;
import com.bankscope.backend.results.EmailResult;
import com.bankscope.backend.results.KioskResult;
import com.bankscope.backend.services.TaskService;
import com.bankscope.backend.services.UserService;
import com.bankscope.backend.utils.SessionAuth;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.tuple.Pair;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping(value = "/api/user")
@RequiredArgsConstructor
public class UserController {
    private final UserService userService;
    private final TaskService taskService;
    private final StringRedisTemplate redisTemplate;

    @PostMapping(value = "/register", produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Map<String, Object> postUserRegister(@RequestBody UserEntity user) {
        return Map.of("result", this.userService.register(user).name());
    }

    @PostMapping(value = "/semi-register", produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Map<String, Object> postUnregisteredUser(@RequestBody UserEntity user) {
        KioskResult result = this.userService.seminRegister(user);
        return Map.of("result", result.name());
    }

    @PostMapping(value = "/update-corporate", produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Map<String, Object> updateCorporate(
            @RequestBody(required = false) Map<String, Object> body,
            @RequestParam(value = "identificationNumber", required = false) String identificationNumber,
            @RequestParam(value = "userId", required = false) Integer userId,
            HttpSession session) {

        Map<String, Object> response = new HashMap<>();
        if (!SessionAuth.isMemberOrAdmin(session)) {
            response.put("result", "FAILURE_SESSION");
            return response;
        }

        identificationNumber = stringValue(body, "identificationNumber", identificationNumber);
        userId = intValue(body, "userId", userId);
        CommonResult result = this.userService.updateCorporateIdentification(identificationNumber, userId);
        response.put("result", result.name());
        return response;
    }

    @PostMapping(value = "/member", produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Map<String, Object> postMemberRegister(@RequestBody MemberEntity member, HttpSession session) {
        Map<String, Object> response = new HashMap<>();
        if (!SessionAuth.isAdmin(session)) {
            response.put("result", "FAILURE_NOT_ALLOWED");
            return response;
        }
        response.put("result", this.userService.registerMember(member).name());
        return response;
    }

    @RequestMapping(value = "/member", method = RequestMethod.DELETE, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Map<String, Object> deleteMember(@RequestParam(value = "id") Long id, HttpSession session) {
        Map<String, Object> response = new HashMap<>();
        if (!SessionAuth.isAdmin(session)) {
            response.put("result", "FAILURE_NOT_ALLOWED");
            return response;
        }
        response.put("result", this.userService.deleteUser(id).name());
        return response;
    }

    @PatchMapping(value = "/member", produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Map<String, Object> patchMember(@RequestBody MemberEntity member, HttpSession session) {
        Map<String, Object> response = new HashMap<>();
        if (!SessionAuth.isAdmin(session)) {
            response.put("result", "FAILURE_NOT_ALLOWED");
            return response;
        }
        response.put("result", this.userService.modifyMember(member).name());
        return response;
    }

    @GetMapping(value = "/members", produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Object getMembers(HttpSession session) {
        if (!SessionAuth.isMemberOrAdmin(session)) {
            return Map.of("result", "FAILURE_SESSION");
        }
        return this.userService.getMembers();
    }

    @PostMapping(value = "/login", produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Map<String, Object> postLogin(
            @RequestBody(required = false) Map<String, Object> body,
            @RequestParam(value = "email", required = false) String email,
            @RequestParam(value = "password", required = false) String password,
            HttpSession session) {

        email = stringValue(body, "email", email);
        password = stringValue(body, "password", password);
        UserEntity user = this.userService.login(email, password);
        Map<String, Object> response = new HashMap<>();
        if (user != null && ("customer".equals(user.getUserType()) || "corporate".equals(user.getUserType()))) {
            response.put("result", CommonResult.SUCCESS.name());
            session.setAttribute("user", user);
            session.setAttribute("loginType", "web");
            redisTemplate.opsForValue().set(
                    "bankscope:chat:" + session.getId(),
                    String.valueOf(user.getId()),
                    Duration.ofHours(2));
        } else {
            response.put("result", CommonResult.FAILURE.name());
        }
        return response;
    }

    @PostMapping(value = "/kiosk/login", produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Map<String, Object> postKioskLogin(
            @RequestBody(required = false) Map<String, Object> body,
            @RequestParam(value = "residentNumber", required = false) String residentNumber) {

        residentNumber = stringValue(body, "residentNumber", residentNumber);
        UserEntity user = this.userService.loginKiosk(residentNumber);
        Map<String, Object> response = new HashMap<>();
        if (user != null) {
            if ("customer".equals(user.getUserType())
                    || "unregisterCustomer".equals(user.getUserType())
                    || "corporate".equals(user.getUserType())) {
                response.put("result", CommonResult.SUCCESS.name());
                response.put("userId", user.getId());
                response.put("userName", user.getName());
            } else {
                response.put("result", "FAILURE_NOT_ALLOWED");
            }
        } else {
            response.put("result", CommonResult.FAILURE.name());
        }
        return response;
    }

    @PostMapping(value = "/member/login", produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Map<String, Object> postMemberLogin(
            @RequestBody(required = false) Map<String, Object> body,
            @RequestParam(value = "email", required = false) String email,
            @RequestParam(value = "password", required = false) String password,
            HttpSession session) {

        email = stringValue(body, "email", email);
        password = stringValue(body, "password", password);
        MemberEntity member = this.userService.loginMember(email, password);
        Map<String, Object> response = new HashMap<>();
        if (member != null) {
            response.put("result", CommonResult.SUCCESS.name());
            session.setAttribute("member", member);
        } else {
            response.put("result", CommonResult.FAILURE.name());
        }
        return response;
    }

    @PostMapping(value = "/login-admin", produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Map<String, Object> postAdminLogin(
            @RequestBody(required = false) Map<String, Object> body,
            @RequestParam(value = "email", required = false) String email,
            @RequestParam(value = "password", required = false) String password,
            HttpSession session) {

        email = stringValue(body, "email", email);
        password = stringValue(body, "password", password);
        UserEntity user = this.userService.loginAdmin(email, password);
        Map<String, Object> response = new HashMap<>();
        if (user != null && "admin".equals(user.getUserType())) {
            response.put("result", CommonResult.SUCCESS.name());
            session.setAttribute("user", user);
        } else {
            response.put("result", CommonResult.FAILURE.name());
        }
        return response;
    }

    @RequestMapping(value = "/session", method = RequestMethod.GET, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Map<String, Object> getSession(HttpSession session) {
        Map<String, Object> response = new HashMap<>();
        UserEntity user = SessionAuth.user(session);
        MemberEntity member = SessionAuth.member(session);

        if (user != null) {
            response.put("result", "SUCCESS");
            response.put("type", "user");
            response.put("id", user.getId());
            response.put("email", user.getEmail());
            response.put("name", user.getName());
            response.put("userType", user.getUserType());
            response.put("loginType", session.getAttribute("loginType"));
        } else if (member != null) {
            response.put("result", "SUCCESS");
            response.put("type", "member");
            response.put("email", member.getEmail());
            response.put("name", member.getName());
            response.put("level", member.getLevel());
            response.put("auth", member.getAuth());
            response.put("team", member.getTeam());
        } else {
            response.put("result", "FAILURE");
        }
        return response;
    }

    @RequestMapping(value = "/info", method = RequestMethod.GET)
    @ResponseBody
    public Map<String, Object> getUserInfo(HttpSession session, @RequestParam(value = "userId") String userId) {
        Map<String, Object> response = new HashMap<>();
        if (!SessionAuth.isMemberOrAdmin(session)) {
            response.put("result", "FAILURE_SESSION");
            return response;
        }

        Pair<CommonResult, UserEntity> result = this.userService.getUserInfo(Integer.valueOf(userId));
        if (result.getLeft() == CommonResult.SUCCESS) {
            UserEntity userInfo = result.getRight();
            if (userInfo.getResidentNumber() != null) {
                userInfo.setResidentNumber(maskResidentNumber(userInfo.getResidentNumber()));
            }
            response.put("result", "SUCCESS");
            response.put("user", userInfo);
        } else {
            response.put("result", "FAILURE");
        }
        return response;
    }

    @RequestMapping(value = "/logout", method = RequestMethod.POST)
    @ResponseBody
    public Map<String, Object> postLogout(HttpSession session) {
        MemberEntity member = SessionAuth.member(session);
        if (member != null) {
            this.taskService.reassignTasksOnMemberLogout(member.getId());
            this.userService.setMemberStatus(member.getEmail(), 0);
        }
        redisTemplate.delete("bankscope:chat:" + session.getId());
        session.invalidate();
        return Map.of("result", "SUCCESS");
    }

    @RequestMapping(value = "/password", method = RequestMethod.PATCH, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Map<String, Object> patchPassword(@RequestBody Map<String, String> requestBody, HttpSession session) {
        UserEntity user = SessionAuth.user(session);
        if (user == null) {
            return Map.of("result", CommonResult.FAILURE_SESSION.name());
        }
        if (!"web".equals(session.getAttribute("loginType"))) {
            return Map.of("result", "FAILURE_NOT_ALLOWED");
        }

        String oldPassword = requestBody.get("oldPassword");
        String newPassword = requestBody.get("newPassword");
        String name = requestBody.get("name");
        if (oldPassword == null || newPassword == null) {
            return Map.of("result", CommonResult.FAILURE.name());
        }

        return Map.of("result", this.userService.changePassword(user, oldPassword, newPassword, name).name());
    }

    @RequestMapping(value = "/email-send", method = RequestMethod.POST, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Map<String, Object> postEmailSend(
            @RequestParam("email") String email,
            @RequestParam(value = "type", defaultValue = "register") String type) {
        EmailResult result = this.userService.sendVerificationEmail(email, type);
        return Map.of("result", result.name());
    }

    @RequestMapping(value = "/email-code-verify", method = RequestMethod.PATCH, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Map<String, Object> patchEmailCodeVerify(@RequestBody EmailTokenEntity emailToken) {
        EmailResult result = this.userService.verifyEmailCode(emailToken.getEmail(), emailToken.getCode());
        return Map.of("result", result.name());
    }

    private static String maskResidentNumber(String residentNumber) {
        String digits = residentNumber.replace("-", "");
        if (digits.length() != 13) {
            return "*".repeat(residentNumber.length());
        }
        return digits.substring(0, 6) + "-" + digits.charAt(6) + "******";
    }

    private static String stringValue(Map<String, Object> body, String key, String fallback) {
        if (body == null || !body.containsKey(key) || body.get(key) == null) {
            return fallback;
        }
        return String.valueOf(body.get(key));
    }

    private static Integer intValue(Map<String, Object> body, String key, Integer fallback) {
        if (body == null || !body.containsKey(key) || body.get(key) == null) {
            return fallback;
        }
        Object value = body.get(key);
        if (value instanceof Number number) {
            return number.intValue();
        }
        try {
            return Integer.valueOf(String.valueOf(value));
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }
}
