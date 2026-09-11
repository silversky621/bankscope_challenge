package com.bankscope.backend.controllers;


import com.bankscope.backend.entities.MemberEntity;
import com.bankscope.backend.results.CommonResult;
import com.bankscope.backend.results.TaskResult;
import com.bankscope.backend.services.MemberService;
import com.bankscope.backend.services.TaskService;
import com.bankscope.backend.utils.SessionAuth;
import com.bankscope.backend.vos.CounterStatusVo;
import com.bankscope.backend.vos.DashboardWaitingVo;
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

@Tag(name = "멤버(Member)", description = "행원 워크스페이스 관련 api ")
@RestController
@RequestMapping(value = "/api/member")
@RequiredArgsConstructor
public class MemberController {
    private final TaskService taskService;
    private final MemberService memberService;

    @Operation(summary = "행원 업무 조회", description = "로그인한 행원에게 할당된 업무 목록을 조회합니다.")
    @RequestMapping(value = "/task", method = RequestMethod.GET, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public List<TaskVo> getTasks (HttpSession session) {
        MemberEntity member = (MemberEntity) session.getAttribute("member");
        if (member == null) {
            return null;
        }
        return this.taskService.getTasksByMemberId(member.getId().intValue());
    }

    @Operation(summary = "업무 상태 변경", description = "특정 업무의 상태를 변경합니다. (WAITING -> IN_PROGRESS -> COMPLETED)")
    @RequestMapping(value = "/task/{taskId}/status", method = RequestMethod.PATCH, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Map<String, Object> updateTaskStatus(@PathVariable Long taskId, @RequestParam String status, HttpSession session) {
        Map<String, Object> response = new HashMap<>();
        if (session.getAttribute("member") == null) {
            response.put("result", TaskResult.FAILURE_SESSION.name());
            return response;
        }
        TaskResult result = this.taskService.updateTaskStatus(taskId, status);
        response.put("result", result.name());
        return response;
    }
    // 멤버 상태 변경 api
    @Operation(summary = "멤버의 상태를 변경합니다.", description = "멤버의 상태를 비활성상태나 활성 상태로 바꿉니다.")
    @RequestMapping(value = "/status", method = RequestMethod.PATCH, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Map<String, Object> PatchStatus(@RequestParam(value = "status") Boolean status, HttpSession session) {
        Map<String, Object> response = new HashMap<>();
        MemberEntity member = (MemberEntity) session.getAttribute("member");

        if (member == null) {
            response.put("result", CommonResult.FAILURE.name());
            return response;
        }

        CommonResult result = this.memberService.patchMemberStatus(member, status);

        if (result == CommonResult.SUCCESS) {
            session.setAttribute("member", member);
        }

        response.put("result", result.name());
        return response;
    }
    // 멤버 셀프 비밀번호 변경 api
    @Operation(summary = "멤버 셀프 비밀번호 변경 api", description = "멤버가 비밀번호를 직접 바꿉니다.")
    @RequestMapping(value = "/password", method = RequestMethod.PATCH, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Map<String, Object> PatchPassword(HttpSession session,
                                             @RequestBody(required = false) Map<String, Object> body,
                                             @RequestParam(value = "password", required = false) String password) {
        Map<String, Object> response = new HashMap<>();
        if ( session.getAttribute("member") == null) {
            response.put("result", CommonResult.FAILURE.name());
            return response;
        }
        if (body != null && body.get("password") != null) {
            password = String.valueOf(body.get("password"));
        }
        MemberEntity member = (MemberEntity) session.getAttribute("member");
        CommonResult result = this.memberService.patchMemberPassword(member, password);
        response.put("result", result.name());
        return response;
    }

    @Operation(summary = "현재 업무처리 중인 창구의 수 api", description = "현재 업무처리 중인 창구의 수를 가져옵니다.")
    @RequestMapping(value = "/in-progress-count", method = RequestMethod.GET, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Map<String, Object> getInProgressCount() {

        Map<String, Object> response = new HashMap<>();
        int count = this.memberService.getInProgressCount();

        response.put("result", CommonResult.SUCCESS.name());
        response.put("count", count);
        return response;
    }

    // 행원들에게 공지사항 전송
    @Operation(summary = "관리자 공지사항 api", description = "관리자가 공지사항을 전송합니다.")
    @RequestMapping(value = "/notice", method = RequestMethod.POST, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Map<String, Object> postNotice() {
        return null;
    }

    // 은행원에게 공지사항 뜨는 api
    @Operation(summary = "은행원 공지사항 api", description = "관리자의 공지사항을 받습니다.")
    @RequestMapping(value = "/notice", method = RequestMethod.GET, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Map<String, Object> getNotice( HttpSession session ) {
        return null;
        // 아마 pair로  return해야할듯
    }


    @Operation(summary = "Lv별 업무비율 api", description = "은행원의 레벨 별 당일 업무 처리 비율을 산정합니다.")
    @RequestMapping(value = "/task-ratio", method = RequestMethod.GET, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Map<String, Object> getTaskRatio( HttpSession session ) {

        Map<String, Object> response = new HashMap<>();
        if (!SessionAuth.isMemberOrAdmin(session)) {
            response.put("result", CommonResult.FAILURE_SESSION.name());
            return response;
        }
        List<Map<String, Object>> ratios = this.memberService.getTaskRatio();

        response.put("result", CommonResult.SUCCESS.name());
        response.put("ratios", ratios);
        return response;
    }

    @Operation(summary = "직원 업무 진행상태", description = "현재 근무 중인 직원들의 레벨, 이름, 소요시간, 상태, 오늘 처리 건수를 종합하여 반환합니다.")
    @RequestMapping(value = "/counter-status", method = RequestMethod.GET, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Map<String, Object> getCounterStatus( HttpSession session ) {
        Map<String, Object> response = new HashMap<>();
        if (!SessionAuth.isMemberOrAdmin(session)) {
            response.put("result", CommonResult.FAILURE_SESSION.name());
            return response;
        }
        List<CounterStatusVo> statusList = this.memberService.getCounterStatus();

        if (statusList != null) {
            response.put("result", CommonResult.SUCCESS.name());
            response.put("statusList", statusList);
        } else {
            response.put("result", CommonResult.FAILURE.name());
        }
        return response;
    }

    @Operation(summary = "대시보드 상단 통계 api", description = "전체 대기인원과 오늘 처리 건수를 한 번에 반환합니다.")
    @GetMapping("/main-stats")
    @ResponseBody
    public Map<String, Object> getMainStats( HttpSession session ) {
        Map<String, Object> response = new HashMap<>();
        if (!SessionAuth.isMemberOrAdmin(session)) {
            response.put("result", CommonResult.FAILURE_SESSION.name());
            return response;
        }
        Map<String, Object> stats = memberService.getBranchTotalStats();

        response.put("result", "SUCCESS");
        response.put("totalWaiting", stats.get("totalWaiting"));     //  대기인원 칸에 표시
        response.put("totalCompleted", stats.get("totalCompleted")); //  총 처리 건수 칸에 표시
        return response;
    }

    @Operation(summary = "실시간 대기 명단 조회", description = "현재 대기 중인 모든 고객의 명단과 정보를 반환합니다.")
    @GetMapping("/waiting-list")
    public Map<String, Object> getWaitingList( HttpSession session ) {

        Map<String, Object> response = new HashMap<>();
        if (!SessionAuth.isMemberOrAdmin(session)) {
            response.put("result", CommonResult.FAILURE_SESSION.name());
            return response;
        }
        List<DashboardWaitingVo> waitingList = memberService.getDashboardWaitingList();

        response.put("result", "SUCCESS");
        response.put("data", waitingList);
        return response;
    }

}
