package com.bankscope.backend.controllers;

import com.bankscope.backend.dtos.RiskDto;
import com.bankscope.backend.dtos.TaskRequestDto;
import com.bankscope.backend.entities.MemberEntity;
import com.bankscope.backend.entities.UserEntity;
import com.bankscope.backend.results.CommonResult;
import com.bankscope.backend.results.TaskResult;
import com.bankscope.backend.services.RiskService;
import com.bankscope.backend.services.TaskService;
import com.bankscope.backend.utils.SessionAuth;
import com.bankscope.backend.vos.TaskVo;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


@Tag(name = "은행업무-키오스크(Task)", description = "은행 창구 접수 관련 API")
@RestController
@RequestMapping("/api/kiosk")
@RequiredArgsConstructor
public class TaskController {
    private final TaskService taskService;
    private final RiskService riskService;

    @Operation(summary = "대기표 발급", description = "업무 유형을 받아 대기표를 발급합니다.")
    @RequestMapping(value = "/task",method = RequestMethod.POST,produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> createTask(@RequestBody TaskRequestDto requestDto) {
        Map<String, Object> response = new HashMap<>();

        // 키오스크는 세션리스로 동작하므로 요청 본문의 userId를 사용한다.
        if (requestDto.getUserId() == null) {
            response.put("result", CommonResult.FAILURE.name());
            response.put("message", "고객 정보가 필요합니다.");
            return response;
        }

        TaskResult result = taskService.createTask(requestDto, requestDto.getUserId());
        response.put("result", result.name());
        return response;
    }
    @Operation(summary = "대기표 발급 확인", description = "업무 유형입력하여 발급된 대기표를 고객이 확인하기 위한 api입니다. ( 고객의 가장 최근 데이터를 반환 )")
    @RequestMapping(value = "/task", method = RequestMethod.GET , produces =  MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Map<String, Object> getTask(@RequestParam(value = "userId") Integer userId) {
        Map<String, Object> response = new HashMap<>();
        if (userId == null) {
            response.put("result", CommonResult.FAILURE.name());
            return response;
        }
        TaskVo task = taskService.getLatestTask(userId);
        if (task != null) {
            response.put("result", CommonResult.SUCCESS.name());
            response.put("task", task);
        } else {
            response.put("result", CommonResult.FAILURE.name());
        }
        return response;
    }
    @Operation(summary = "평균 대기 시간", description = "평균 대기 시간을 구하여 , 현재 창구 대기 시간을 반환합니다.")
    @RequestMapping(value = "/average-time", method = RequestMethod.GET, produces = MediaType.TEXT_HTML_VALUE)
    @ResponseBody
    public String getAverageTime() {
        return taskService.getAverageTime();
    }
    @Operation(summary = "현재 대기 고객", description = "모든 대기 상태의 고객수를 반환합니다. ")
    @RequestMapping(value = "/waiting-count", method = RequestMethod.GET, produces = MediaType.TEXT_HTML_VALUE)
    @ResponseBody
    public String getWaitingCount() {
        return String.valueOf(taskService.getTotalWaitingPerson());
    }
    @Operation(summary = "현재 운영중인 창구", description = "현재 로그인중인 멤버의 수를 반환합니다.")
    @RequestMapping(value = "/available-count", method = RequestMethod.GET, produces = MediaType.TEXT_HTML_VALUE)
    @ResponseBody
    public String getAvailableCounter() {
        return String.valueOf(taskService.getAvailableMemberCount());
    }

    @Operation(summary = "카테고리별 대기 인원", description = "빠른 업무/상담 업무/기업 특수 카테고리별 WAITING 상태 task 수를 반환합니다.")
    @GetMapping(value = "/waiting-count-by-type", produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Map<String, Integer> getWaitingCountByType() {
        return taskService.getWaitingCountByTaskType();
    }

    @Operation(summary = "시간대별 예상 혼잡도", description = "최근 8주 동일 요일의 시간대별 접수 이력을 업무별 처리시간으로 환산해 현재 운영 창구 수 대비 혼잡도를 반환합니다.")
    @GetMapping(value = "/hourly-stats", produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public List<Map<String, Object>> getHourlyStats() {
        return taskService.getHourlyCongestionStats();
    }

    @Operation(summary = "창구 토스", description = "내가 처리할수 없는 업무 창구 토스하기 , task의 memberId와 WAITING 이나 IN_PROGRESS 상태인 업무를 WAITING으로 전환" )
    @RequestMapping(value = "/toss", method = RequestMethod.PATCH, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Map<String, Object> tossTask(HttpSession session,
            @RequestParam(value = "taskId") Long taskId, 
            @RequestParam(value = "targetMemberId") Integer targetMemberId) {
        Map<String, Object> response = new HashMap<>();
        MemberEntity member = (MemberEntity) session.getAttribute("member");
        if (member == null) {
            response.put("result", TaskResult.FAILURE_SESSION.name());
            return response;
        }
        TaskResult result = this.taskService.tossTask(taskId, targetMemberId);
        response.put("result", result.name());
        return response;
    }

    @Operation(summary = "고객 리스크 조회", description = "고객의 대출 및 연체 정보를 기반으로 리스크를 백분율 점수로 조회합니다.")
    @RequestMapping(value = "/risk-score", method = RequestMethod.GET, produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> getRiskScore(@RequestParam("userId") Integer userId, HttpSession session) {
        Map<String, Object> response = new HashMap<>();
        // 고객 리스크 정보는 행원/관리자만 조회 가능
        if (!SessionAuth.isMemberOrAdmin(session)) {
            response.put("result", "FAILURE_SESSION");
            return response;
        }
        try {
            RiskDto data = riskService.getUserRiskStatus(userId);
            if (data == null) {
                response.put("result", "FAILURE");
                response.put("message", "해당 유저 정보를 찾을 수 없습니다.");
            } else {
                response.put("result", "SUCCESS");
                response.put("data", data);
            }
        } catch (Exception e) {
            response.put("result", "ERROR");
            response.put("message", "리스크 조회 중 오류가 발생했습니다: " + e.getMessage());
        }
        return response;
    }

    // 강제 창구 이관
    @Operation(summary = "관리자용 창구 토스", description = "관리자가 업무를 강제로 다른 창구로 이관합니다." )
    @RequestMapping(value = "/toss-admin", method = RequestMethod.PATCH, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Map<String,Object> tossTaskByAdmin ( HttpSession session,
                                                @RequestParam(value = "taskId") Long taskId,
                                                @RequestParam(value = "targetMemberId") Integer targetMemberId) {
        Map<String, Object> response = new HashMap<>();
        UserEntity user = (UserEntity) session.getAttribute("user");
        if (user == null) {
            response.put("result", TaskResult.FAILURE_SESSION.name());
            return response;
        }
        TaskResult result = this.taskService.tossTaskByAdmin(user,taskId, targetMemberId);
        response.put("result", result.name());
        return response;
    }

}
