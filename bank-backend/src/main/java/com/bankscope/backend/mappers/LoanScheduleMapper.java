package com.bankscope.backend.mappers;

import com.bankscope.backend.entities.LoanScheduleEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.math.BigInteger;
import java.time.LocalDate;
import java.util.List;

@Mapper
public interface LoanScheduleMapper {
    // 가장 오래된 미납/예정 스케줄 조회
    List<LoanScheduleEntity> findPendingSchedulesByLoanId(@Param("loanId") Long loanId);

    List<LoanScheduleEntity> findSchedulesByLoanIdAndStatus(@Param("loanId") Long loanId, @Param("status") String status);

    void updateScheduleStatus(LoanScheduleEntity schedule);
    void insertLoanSchedules(@Param("schedules") List<LoanScheduleEntity> schedule);

    // 대출 ID로 해당 대출의 '전체' 스케줄 조회 (납부 완료 건 포함)
    List<LoanScheduleEntity> findSchedulesFromDate(@Param("loanId") Long loanId,
                                                   @Param("startDate") LocalDate startDate);

    // LoanScheduleMapper.java 에 추가
    List<LoanScheduleEntity> findSchedulesToMarkOverdue(@Param("today") LocalDate today);
    void markScheduleAsOverdue(@Param("scheduleId") BigInteger scheduleId);

    void deleteFutureSchedules(@Param("loanId") Long loanId);
    
    void cancelFutureSchedules(@Param("loanId") Long loanId);
}