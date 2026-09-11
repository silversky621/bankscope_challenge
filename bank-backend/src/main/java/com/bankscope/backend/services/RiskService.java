package com.bankscope.backend.services;

import com.bankscope.backend.dtos.RiskDto;
import com.bankscope.backend.entities.LoanEntity;
import com.bankscope.backend.entities.LoanScheduleEntity;
import com.bankscope.backend.entities.UserEntity;
import com.bankscope.backend.mappers.LoanMapper;
import com.bankscope.backend.mappers.LoanScheduleMapper;
import com.bankscope.backend.mappers.UserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class RiskService {

    private final UserMapper userMapper;
    private final LoanMapper loanMapper;
    private final LoanScheduleMapper loanScheduleMapper;

    public RiskDto getUserRiskStatus(Integer userId) {
        UserEntity user = userMapper.selectUserById(userId);
        if (user == null) return null;

        List<LoanEntity> loans = loanMapper.selectActiveAndOverdueLoansByUserId(userId);

        long totalOutstandingAmount = 0;
        int totalOverdueCount = 0;
        long totalOverdueAmount = 0;
        int maxOverdueDays = 0;
        List<RiskDto.LoanInfo> loanDetails = new ArrayList<>();

        for (LoanEntity loan : loans) {
            totalOutstandingAmount += loan.getOutstandingAmount();
            List<LoanScheduleEntity> overdueSchedules =
                    loanScheduleMapper.findSchedulesByLoanIdAndStatus(loan.getLoanId().longValue(), "OVERDUE");

            totalOverdueCount += overdueSchedules.size();
            for (LoanScheduleEntity schedule : overdueSchedules) {
                totalOverdueAmount += schedule.getRepayAmount();
                long days = ChronoUnit.DAYS.between(schedule.getDueDate(), LocalDate.now());
                if (days > maxOverdueDays) maxOverdueDays = (int) days;
            }

            loanDetails.add(RiskDto.LoanInfo.builder()
                    .loanId(loan.getLoanId())
                    .loanName("대출 상품")
                    .outstandingAmount(loan.getOutstandingAmount())
                    .status(overdueSchedules.isEmpty() ? "ACTIVE" : "OVERDUE")
                    .currentOverdueCount(overdueSchedules.size())
                    .build());
        }

        int riskScore = calculateRiskScore(loans, totalOverdueCount, maxOverdueDays, user.getCreditStatus());

        return RiskDto.builder()
                .userName(user.getName())
                .userType(user.getUserType())
                .identificationNumber(getMaskedIdentification(user))
                .totalLoanCount(loans.size())
                .totalOutstandingAmount(totalOutstandingAmount)
                .totalOverdueCount(totalOverdueCount)
                .totalOverdueAmount(totalOverdueAmount)
                .maxOverdueDays(maxOverdueDays)
                .riskScore(riskScore)
                .loanDetails(loanDetails)
                .build();
    }

    private int calculateRiskScore(List<LoanEntity> loans, int totalOverdueCount, int maxOverdueDays, String creditStatus) {
        int score = 0;

        if (loans.size() > 5)       score += 20;
        else if (loans.size() > 2)  score += 10;

        if (totalOverdueCount > 3)      score += 40;
        else if (totalOverdueCount > 0) score += 20;

        if (maxOverdueDays > 90)      score += 30;
        else if (maxOverdueDays > 30) score += 20;
        else if (maxOverdueDays > 0)  score += 10;

        if ("POOR".equalsIgnoreCase(creditStatus))        score += 10;
        else if ("AVERAGE".equalsIgnoreCase(creditStatus)) score += 5;

        return Math.min(score, 100);
    }

    private String getMaskedIdentification(UserEntity user) {
        if ("corporate".equals(user.getUserType())) {
            return user.getIdentificationNumber();
        } else if (user.getResidentNumber() != null && user.getResidentNumber().length() > 7) {
            return user.getResidentNumber().substring(0, 6) + "-*******";
        }
        return null;
    }
}
