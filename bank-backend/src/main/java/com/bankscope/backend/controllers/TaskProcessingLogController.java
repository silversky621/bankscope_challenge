package com.bankscope.backend.controllers;

import com.bankscope.backend.entities.MemberEntity;
import com.bankscope.backend.entities.TaskProcessingLogEntity;
import com.bankscope.backend.mappers.FinancialProductMapper;
import com.bankscope.backend.results.CommonResult;
import com.bankscope.backend.services.TaskService;
import com.bankscope.backend.vos.TaskProcessingVo;
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

@Tag(name = "상담업무 작성", description = "로그작성입니다.")
@RestController
@RequiredArgsConstructor
@RequestMapping(value = "/api/task-processing-log")
public class TaskProcessingLogController {
    // 메모장 insert api
    // 메모장 delete api
    private final FinancialProductMapper financialProductMapper;
    private final TaskService taskService;

    @Operation(summary = "업무로그 작성", description = "업무 처리 말미에 업무로그를 작성합니다. 프론트에서는 null값이 아닐때만 요청을 보내는 방식으로 구현하면 됩니다.")
    @RequestMapping(value = "/", method = RequestMethod.POST,produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Map<String, Object> postProcessingLog(HttpSession session,
                                                 @RequestParam("note") String note,
                                                 @RequestParam(value = "taskId", required = false) Long taskId) {
        Map<String, Object> response = new HashMap<>();

        Object sessionMember = session.getAttribute("member");
        if (sessionMember == null) {
            response.put("result", "FAILURE");
            response.put("message", "세션에 로그인 정보가 없습니다.");
            return response;
        }

        MemberEntity member = (MemberEntity) sessionMember;
        TaskVo task = this.taskService.getTask(taskId);
        if (task == null) {
            response.put("result", "FAILURE");
        }
        if ( task.getStatus() == null || !task.getStatus().equals("IN_PROGRESS")) {
            response.put("result", "FAILURE_NOT_IN_PROGRESS");
        }
        try {
            TaskProcessingLogEntity newLog = TaskProcessingLogEntity.builder()
                    .taskId(taskId)
                    .memberId(member.getId().intValue())
                    .actionType("ADD_NOTE")
                    .processingNote(note)
                    .build();

            int resultCount = this.financialProductMapper.insertProcessingLog(newLog);

            if (resultCount > 0) {
                response.put("result", CommonResult.SUCCESS.name());
            } else {
                response.put("result", CommonResult.FAILURE.name());
            }
        } catch (Exception e) {
            response.put("result", "ERROR");
            response.put("message", e.getMessage());
        }

        return response;
    }

    @Operation(summary = "업무로그 가져오기", description = "특정 인물과 관련된 업무로그를 상담원이 가져옵니다.")
    @RequestMapping(value = "/", method = RequestMethod.GET, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Map<String, Object> getProcessingLog(HttpSession session, @RequestParam("userId") Integer userId) {
        Map<String, Object> response = new HashMap<>();

        Object sessionMember = session.getAttribute("member");
        if (sessionMember == null) {
            response.put("result", "FAILURE");
            response.put("message", "세션에 로그인 정보가 없습니다.");
            return response;
        }
        List<TaskProcessingVo> taskLogs = this.taskService.getTaskLog(userId);
        if (taskLogs == null || taskLogs.isEmpty()) {
            response.put("result", "FAILURE");
            response.put("message", "조회된 업무로그가 없습니다.");
        } else {
            response.put("result", CommonResult.SUCCESS.name());
        }
        response.put("taskLogs", taskLogs);
        return response;
    }

}