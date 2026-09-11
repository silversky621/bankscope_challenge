package com.bankscope.backend.services;

import com.bankscope.backend.entities.MemberEntity;
import com.bankscope.backend.mappers.TaskMapper;
import com.bankscope.backend.mappers.UserMapper;
import com.bankscope.backend.results.CommonResult;
import com.bankscope.backend.vos.CounterStatusVo;
import com.bankscope.backend.vos.DashboardWaitingVo;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class MemberService {
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

    private final TaskMapper taskMapper;
    private final UserMapper userMapper;

    // 대시보드 1: 진행 중인 창구 수
    public int getInProgressCount() {
        return taskMapper.countInProgressTasks();
    }

    // 대시보드 2: 레벨별 업무 비율
    public List<Map<String, Object>> getTaskRatio() {
        return taskMapper.selectTaskRatioByLevel();
    }

    // 대시보드 3: 직원별 창구 현황
    public List<CounterStatusVo> getCounterStatus() {
        return taskMapper.selectCounterStatus();
    }

    // 대시보드 4: 대기인원과 오늘 처리된업무
    public Map<String, Object> getBranchTotalStats() {

        return taskMapper.selectBranchTotalStats();
    }

    public List<DashboardWaitingVo> getDashboardWaitingList() {
        return taskMapper.selectDashboardWaitingList();
    }

    public CommonResult patchMemberStatus(MemberEntity member, Boolean status) {
        if (member == null) {
            return CommonResult.FAILURE;
        }
        member.setStatus(status ? 1 : 0);

        int result = this.userMapper.updateMember(member);
        return result > 0 ? CommonResult.SUCCESS : CommonResult.FAILURE;
    }

    public CommonResult patchMemberPassword(MemberEntity member, String password) {
        if (member == null) {
            return CommonResult.FAILURE;
        }
        String encodedPassword = encoder.encode(password);
        member.setPassword(encodedPassword);
        int result = this.userMapper.updateMember(member);
        return result > 0 ? CommonResult.SUCCESS : CommonResult.FAILURE;
    }
}
