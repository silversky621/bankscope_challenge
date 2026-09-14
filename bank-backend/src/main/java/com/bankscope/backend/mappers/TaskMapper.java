package com.bankscope.backend.mappers;


import com.bankscope.backend.entities.TaskEntity;
import com.bankscope.backend.entities.MemberEntity;
import com.bankscope.backend.vos.CounterStatusVo;
import com.bankscope.backend.vos.DashboardWaitingVo;
import com.bankscope.backend.vos.TaskProcessingVo;
import com.bankscope.backend.vos.TaskVo;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;
import java.util.Map;

@Mapper
public interface TaskMapper {
    int insert(@Param(value = "task")TaskEntity task);
    String selectLastTicketNumber(@Param("prefix") String prefix);
    int countWaitingTasks(@Param("taskType") String taskType);
    Integer selectAvailableMemberId(@Param("minLevel") int minLevel);
    List<TaskVo> selectTasksByUserId(@Param("userId") Integer userId);
    TaskVo selectLatestTaskByUserId(@Param("userId") Integer userId);
    List<TaskVo> selectTasksByMemberId(@Param("memberId") Integer memberId);
    List<TaskVo> selectTasksByMemberLevel(@Param("memberId") Integer memberId, @Param("memberLevel") Integer memberLevel);
    String selectAverageTime();
    int countAvailableMembers();
    int countAllWaitingPerson();
    List<Map<String, Object>> countWaitingPersonByTaskType();
    List<Map<String, Object>> selectHourlyAverageWorkloadMinutes();
    int updateTaskStatus(@Param("taskId") Long taskId, @Param("status") String status);
    List<TaskEntity> selectWaitingTasksByUserId(@Param("userId") Integer userId);
    List<TaskEntity> selectWaitingTasksByMemberId(@Param("memberId") Long memberId);
    Integer selectLeastBusyMemberId(@Param("minLevel") int minLevel, @Param("excludeId") Long excludeId);
    Integer selectHighestLevelMemberId(@Param("excludeId") Long excludeId);
    int updateMemberIdForTasks(@Param("taskIds") List<Long> taskIds, @Param("memberId") Integer memberId);
    int countAvailableMembersByLevel(@Param("minLevel") int minLevel);
    int selectMemberTotalWaitTime(@Param("memberId") Integer memberId);
    int countWaitingTasksByMemberId(@Param("memberId") Integer memberId);
    TaskEntity selectTaskForUpdate(@Param("taskId") Long taskId);
    MemberEntity selectMemberForUpdate(@Param("memberId") Integer memberId);
    List<Map<String, Object>> selectTransferCandidates(@Param("minLevel") int minLevel, @Param("excludeId") Integer excludeId);
    Map<String, Object> selectQueueBeforeTask(@Param("task") TaskEntity task);
    int updateTaskOutcome(@Param("task") TaskEntity task);
    int transferTask(@Param("task") TaskEntity task);
    int insertTaskAction(@Param("taskId") Long taskId, @Param("memberId") Integer memberId,
                         @Param("action") String action, @Param("note") String note);
    int insertTransferLog(@Param("taskId") Long taskId, @Param("fromId") Integer fromId, @Param("toId") Integer toId,
                          @Param("actorId") Integer actorId, @Param("adminId") Integer adminId,
                          @Param("previousDetail") String previousDetail, @Param("actualDetail") String actualDetail,
                          @Param("reason") String reason);
    TaskVo getTask(@Param("taskId") Long taskId);
    int countInProgressTasks();
    @SuppressWarnings("MybatisXMapperMethodInspection")
    List<Map<String, Object>> selectTaskRatioByLevel();
    List<CounterStatusVo> selectCounterStatus();
    @SuppressWarnings("MybatisXMapperMethodInspection")
    Map<String, Object> selectBranchTotalStats();
    List<DashboardWaitingVo> selectDashboardWaitingList();
    List<TaskProcessingVo> selectTaskLogByUserId(@Param("userId") Integer userId);
}
