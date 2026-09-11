package com.bankscope.backend.mappers;

import com.bankscope.backend.dtos.PendingSavingsDto;
import com.bankscope.backend.entities.SavingsScheduleEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDate;
import java.util.List;

@Mapper
public interface SavingsScheduleMapper {
    // 1. 스케줄 일괄 생성 (Batch Insert)
    void insertSavingsSchedules(@Param("schedules") List<SavingsScheduleEntity> schedules);

    // 2. 납입 대기 중(PENDING)인 스케줄을 날짜순으로 조회
    /*List<SavingsScheduleEntity> findPendingSchedulesByAccountId(@Param("accountId") Long accountId);*/

    // 3. 스케줄 상태 업데이트 (COMPLETED, MISSED 등)
    void updateScheduleStatus(SavingsScheduleEntity schedule);

    // 오늘 날짜(또는 그 이전)가 예정일인데 아직 PENDING인 스케줄 조회
    /*List<SavingsScheduleEntity> findSchedulesToProcess(@Param("today") LocalDate today);*/


    // 👇 누락되었던 메서드: 가장 오래된 PENDING 스케줄 찾기
    SavingsScheduleEntity findEarliestPendingSchedule(@Param("accountId") Long accountId);

    // 👇 파라미터 개수 에러 수정 (@Param 명시 필수)
    void updateScheduleStatus(@Param("scheduleId") Long scheduleId, @Param("status") String status);

    // 오늘 날짜 기준으로 돈을 빼가야 할 대기중(PENDING) 스케줄 목록 조회
    List<PendingSavingsDto> findDueSchedules(@Param("currentDate") LocalDate currentDate);
}
