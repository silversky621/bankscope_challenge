package com.bankscope.backend.controllers;

import com.bankscope.backend.dtos.CorporateManagementDto;
import com.bankscope.backend.dtos.CorporateRiskDto;
import com.bankscope.backend.results.CorporateManagementResult;
import com.bankscope.backend.services.CorporateManageService;
import com.bankscope.backend.utils.SessionAuth;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping(value = "/api/corporate")
@RequiredArgsConstructor
public class CorporateManagementController {
    private final CorporateManageService corporateManageService;

    @GetMapping(value = "/", produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> getCorporateInfo(@RequestParam("userId") Integer id, HttpSession session) {
        Map<String, Object> result = new HashMap<>();
        if (!SessionAuth.isMemberOrAdmin(session)) {
            result.put("result", "FAILURE_SESSION");
            return result;
        }
        try {
            CorporateManagementDto data = corporateManageService.getCorporateInfoById(id);
            if (data == null) {
                result.put("result", CorporateManagementResult.FAILURE_NO_DATA.name());
            } else {
                result.put("result", CorporateManagementResult.SUCCESS.name());
                result.put("data", data);
            }
        } catch (Exception e) {
            result.put("result", "FAILURE");
            result.put("message", e.getMessage());
        }
        return result;
    }

    @PostMapping(
            value = "/bankruptcy",
            produces = MediaType.APPLICATION_JSON_VALUE,
            consumes = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> postCorporateBankruptcy(
            @RequestBody CorporateManagementDto dto,
            HttpSession session) {

        Map<String, Object> result = new HashMap<>();
        if (!SessionAuth.isMemberOrAdmin(session)) {
            result.put("result", "FAILURE_SESSION");
            return result;
        }
        try {
            CorporateManagementDto created = corporateManageService.createCorporateBankruptcy(dto);
            result.put("result", "SUCCESS");
            result.put("data", created);
        } catch (Exception e) {
            result.put("result", "FAILURE");
            result.put("message", e.getMessage());
        }
        return result;
    }

    @GetMapping(value = "/risk-status", produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> getCorporateRiskStatus(
            @RequestParam("userId") Integer userId,
            HttpSession session) {

        Map<String, Object> result = new HashMap<>();
        if (!SessionAuth.isMemberOrAdmin(session)) {
            result.put("result", "FAILURE_SESSION");
            return result;
        }
        try {
            CorporateRiskDto data = corporateManageService.getCorporateRiskStatus(userId);
            if (data == null) {
                result.put("result", "FAILURE");
            } else {
                result.put("result", "SUCCESS");
                result.put("data", data);
            }
        } catch (Exception e) {
            result.put("result", "ERROR");
            result.put("message", e.getMessage());
        }
        return result;
    }
}
