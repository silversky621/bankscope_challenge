package com.bankscope.backend.schedulers;

import com.bankscope.backend.entities.LoanScheduleEntity;
import com.bankscope.backend.mappers.LoanMapper;
import com.bankscope.backend.mappers.LoanScheduleMapper;
import com.bankscope.backend.services.LoanService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class LoanBatchScheduler {

    private final LoanScheduleMapper loanScheduleMapper;
    private final LoanMapper loanMapper;
    private final LoanService loanService; // ✨ 서비스 주입

    @Scheduled(cron = "0 0 0 * * *")
    public void processAutoRepaymentAndOverdue() {
        LocalDate today = LocalDate.now();
        log.info("🕒 [배치 실행] {} 기준 대출 자동 상환 및 연체 점검", today);

        // 오늘 처리해야 할 스케줄 모두 가져오기
        List<LoanScheduleEntity> targetSchedules = loanScheduleMapper.findSchedulesToMarkOverdue(today);

        int successCount = 0;
        int overdueCount = 0;

        for (LoanScheduleEntity schedule : targetSchedules) {
            try {
                // ✨ 핵심: 서비스의 자동이체 로직 호출!
                boolean isRepayed = loanService.autoRepayLoan(schedule);

                if (isRepayed) {
                    successCount++;
                } else {
                    // 잔고가 부족하거나 계좌에 문제가 있어 출금 실패 -> 연체 처리
                    loanScheduleMapper.markScheduleAsOverdue(schedule.getScheduleId());
                    loanMapper.updateLoanOverdueStatus((long) schedule.getLoanId(), schedule.getRepayAmount());
                    overdueCount++;
                }
            } catch (Exception e) {
                // 특정 건에서 에러가 나도 다음 스케줄 처리가 멈추지 않도록 예외 처리
                log.error("❌ 스케줄 ID {} 처리 중 에러 발생: {}", schedule.getScheduleId(), e.getMessage());
                overdueCount++;
            }
        }

        log.info("🏁 [배치 완료] 총 {}건 자동 상환, {}건 연체 처리", successCount, overdueCount);
    }
}