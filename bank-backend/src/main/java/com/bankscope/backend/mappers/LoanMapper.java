package com.bankscope.backend.mappers;

import com.bankscope.backend.entities.LoanEntity;
import com.bankscope.backend.vos.LoanVo;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface LoanMapper {

    // 대출 생성
    int insertLoan(@Param("loan") LoanEntity loan);

    // 대출 단건 조회
    LoanEntity selectLoanById(@Param("loanId") Integer loanId);

    LoanVo selectLoanVoById(@Param("loanId") Integer loanId);

    // 유저별 대출 목록 조회
    List<LoanVo> selectLoansByUserId(@Param("userId") Integer userId);

    List<LoanEntity> selectActiveAndOverdueLoansByUserId(@Param("userId") Integer userId);

    List<LoanEntity> selectBankruptLoansByUserId(@Param("userId") Integer userId); // 추가

    // 잔여 대출금 업데이트
    int updateOutstandingAmount(@Param("loanId") Integer loanId, @Param("outstandingAmount") Long outstandingAmount);

    // 대출 상태 변경 (ACTIVE -> COMPLETED / OVERDUE 등)
    int updateLoanStatus(@Param("loanId") Integer loanId, @Param("status") String status);

    int updateLoan(@Param("loan") LoanEntity loan);

    // 대출 정보 업데이트
    int updateLoanInfo(@Param("loan") LoanEntity loan);

    // 미납된 대출 목록 조회
    List<LoanEntity> selectOverdueLoansByUserId(@Param("userId") Integer userId);

    // 유저별 총 미납 금액 합계 조회
    Long selectTotalOverdueAmountByUserId(@Param("userId") Integer userId);

    // 연체대출 업데이트
    void updateLoanOverdueStatus(@Param("loanId") Long loanId, @Param("amount") Long amount);


}
