package com.bankscope.backend.services;

import com.bankscope.backend.dtos.CorporateManagementDto;
import com.bankscope.backend.dtos.CorporateRiskDto;
import com.bankscope.backend.entities.*;
import com.bankscope.backend.mappers.*;
import com.bankscope.backend.entities.*;
import com.bankscope.backend.enums.LoanStatus;
import com.bankscope.backend.mappers.*;
import com.bankscope.backend.vos.AccountVo;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CorporateManageService {

    private final CorporateManageMapper corporateManageMapper;
    private final LoanMapper loanMapper;
    private final AccountMapper accountMapper;
    private final TransactionHistoryMapper transactionHistoryMapper;
    private final LoanScheduleMapper loanScheduleMapper;
    private final UserMapper userMapper;

    public List<CorporateManagementDto> getAllCorporateInfo() {
        return corporateManageMapper.selectAll().stream()
                .map(CorporateManagementDto::fromEntity)
                .collect(Collectors.toList());
    }

    public CorporateManagementDto getCorporateInfoById(int id) {
        CorporateManagementEntity entity = corporateManageMapper.selectById(id);
        if (entity == null) {
            return null;
        }
        return CorporateManagementDto.fromEntity(entity);
    }

    @Transactional
    public CorporateManagementDto createCorporateBankruptcy(CorporateManagementDto dto) {
        Integer userId = dto.getUserId();

        // 1. 유저의 모든 활성 계좌 잔액 확인 및 회수
        List<AccountVo> accounts = accountMapper.selectAccountsByUserId(userId);
        long totalBalance = 0L;
        for (AccountVo account : accounts) {
            if ("ACTIVE".equals(account.getStatus()) && account.getBalance() > 0) {
                totalBalance += account.getBalance();
                accountMapper.updateBalance(account.getAccountId(), 0L);

                // 거래 이력 기록
                TransactionHistoryEntity transaction = TransactionHistoryEntity.builder()
                        .accountId(account.getAccountId())
                        .userId(userId)
                        .transactionType("LOAN_BANKRUPTCY_RECOVERY")
                        .amount(account.getBalance())
                        .balanceAfter(0L)
                        .description("부도 확정에 따른 강제 상계 처리")
                        .createdAt(LocalDateTime.now())
                        .updatedAt(LocalDateTime.now())
                        .build();
                transactionHistoryMapper.insertTransaction(transaction);
            }
        }

        // 2. 상환에 사용할 수 있는 총 금액
        long availableForRepayment = totalBalance;

        // 3. 유저의 모든 ACTIVE 및 OVERDUE 대출 조회
        List<LoanEntity> loans = loanMapper.selectActiveAndOverdueLoansByUserId(userId);

        for (LoanEntity loan : loans) {
            if (availableForRepayment <= 0) {
                // 상환할 돈이 없으면 바로 부도 처리
                loan.setStatus(LoanStatus.BANKRUPTCY.name());
                loanMapper.updateLoan(loan);
                loanScheduleMapper.cancelFutureSchedules(loan.getLoanId().longValue());
                continue;
            }

            long initialOutstanding = loan.getOutstandingAmount();
            long repaidAmount = 0;

            // 4. OVERDUE 스케줄부터 상환
            List<LoanScheduleEntity> overdueSchedules = loanScheduleMapper.findSchedulesByLoanIdAndStatus(loan.getLoanId().longValue(), "OVERDUE");
            for (LoanScheduleEntity schedule : overdueSchedules) {
                if (availableForRepayment >= schedule.getRepayAmount()) {
                    availableForRepayment -= schedule.getRepayAmount();
                    repaidAmount += schedule.getRepayAmount();
                    schedule.setStatus("PAID");
                    schedule.setPaidAt(LocalDateTime.now());
                    loanScheduleMapper.updateScheduleStatus(schedule);
                }
            }

            // 5. SCHEDULED 스케줄 상환
            List<LoanScheduleEntity> scheduledSchedules = loanScheduleMapper.findSchedulesByLoanIdAndStatus(loan.getLoanId().longValue(), "SCHEDULED");
            for (LoanScheduleEntity schedule : scheduledSchedules) {
                if (availableForRepayment >= schedule.getRepayAmount()) {
                    availableForRepayment -= schedule.getRepayAmount();
                    repaidAmount += schedule.getRepayAmount();
                    schedule.setStatus("PAID");
                    schedule.setPaidAt(LocalDateTime.now());
                    loanScheduleMapper.updateScheduleStatus(schedule);
                }
            }

            loan.setOutstandingAmount(initialOutstanding - repaidAmount);

            // 6. 대출 상태 업데이트
            if (loan.getOutstandingAmount() <= 0) {
                loan.setOutstandingAmount(0L);
                loan.setStatus(LoanStatus.COMPLETED.name());
            } else {
                loan.setStatus(LoanStatus.BANKRUPTCY.name());
                // 7. 남은 미래 스케줄 취소
                loanScheduleMapper.cancelFutureSchedules(loan.getLoanId().longValue());
            }
            loanMapper.updateLoan(loan);
        }

        // 8. 부도 정보 기록
        CorporateManagementEntity entity = CorporateManagementDto.toEntity(dto);
        corporateManageMapper.insert(entity);
        return CorporateManagementDto.fromEntity(entity);
    }

    public void updateCorporateBankruptcy(CorporateManagementDto dto) {
        CorporateManagementEntity entity = CorporateManagementDto.toEntity(dto);
        corporateManageMapper.update(entity);
    }

    public void deleteCorporateBankruptcy(int id) {
        corporateManageMapper.delete(id);
    }

    public CorporateRiskDto getCorporateRiskStatus(Integer userId) {
        UserEntity user = userMapper.selectUserById(userId);
        if (user == null) {
            return null;
        }

        List<LoanEntity> loans = loanMapper.selectActiveAndOverdueLoansByUserId(userId);

        if (loans.isEmpty()) {
            List<LoanEntity> bankruptLoans = loanMapper.selectBankruptLoansByUserId(userId);
            
            if (!bankruptLoans.isEmpty()) {
                // 부도 상태인 대출이 존재함
                return CorporateRiskDto.builder()
                        .companyName(user.getName())
                        .businessNumber(user.getIdentificationNumber())
                        .totalLoanCount(bankruptLoans.size())
                        .riskGrade("F (부도 확정)") // 이미 부도난 기업임을 명시
                        .loanDetails(new ArrayList<>())
                        .build();
            }

            return CorporateRiskDto.builder()
                    .companyName(user.getName())
                    .businessNumber(user.getIdentificationNumber())
                    .totalLoanCount(0)
                    .riskGrade("A (안전)") // 대출 없으면 안전 등급
                    .build();
        }

        long totalOutstandingAmount = 0;
        int totalOverdueCount = 0;
        long totalOverdueAmount = 0;
        int maxOverdueDays = 0;
        List<CorporateRiskDto.LoanInfo> loanDetails = new ArrayList<>();

        for (LoanEntity loan : loans) {
            totalOutstandingAmount += loan.getOutstandingAmount();
            List<LoanScheduleEntity> overdueSchedules = loanScheduleMapper.findSchedulesByLoanIdAndStatus(loan.getLoanId().longValue(), "OVERDUE");

            totalOverdueCount += overdueSchedules.size();
            for (LoanScheduleEntity schedule : overdueSchedules) {
                totalOverdueAmount += schedule.getRepayAmount();
                long days = ChronoUnit.DAYS.between(schedule.getDueDate(), LocalDate.now());
                if (days > maxOverdueDays) {
                    maxOverdueDays = (int) days;
                }
            }

            loanDetails.add(CorporateRiskDto.LoanInfo.builder()
                    .loanId(loan.getLoanId())
                    .loanName("기업 대출") // 예시, 실제로는 상품명 조회 필요
                    .outstandingAmount(loan.getOutstandingAmount())
                    .status(overdueSchedules.isEmpty() ? "ACTIVE" : "OVERDUE")
                    .currentOverdueCount(overdueSchedules.size())
                    .build());
        }


        // 위험 등급 계산 로직 (예시)
        String riskGrade;
        if (maxOverdueDays > 90 || totalOverdueCount > 3) {
            riskGrade = "E (고위험)";
        } else if (maxOverdueDays > 30 || totalOverdueCount > 1) {
            riskGrade = "D (위험)";
        } else if (totalOverdueCount > 0) {
            riskGrade = "C (주의)";
        } else {
            riskGrade = "B (보통)";
        }

        return CorporateRiskDto.builder()
                .companyName(user.getName())
                .businessNumber(user.getIdentificationNumber())
                .totalLoanCount(loans.size())
                .totalOutstandingAmount(totalOutstandingAmount)
                .overdueCount(totalOverdueCount)
                .totalOverdueAmount(totalOverdueAmount)
                .maxOverdueDays(maxOverdueDays)
                .riskGrade(riskGrade)
                .loanDetails(loanDetails)
                .build();
    }
}