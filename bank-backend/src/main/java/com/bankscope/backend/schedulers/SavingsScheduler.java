package com.bankscope.backend.schedulers; // 또는 schedulers

import com.bankscope.backend.dtos.PendingSavingsDto;
import com.bankscope.backend.mappers.SavingsScheduleMapper;
import com.bankscope.backend.services.TransactionHistoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Component
@RequiredArgsConstructor
public class SavingsScheduler {

    private final SavingsScheduleMapper savingsScheduleMapper;
    private final TransactionHistoryService transactionHistoryService;

    @Scheduled(cron = "0 0 0 * * *")
    @Transactional
    public void processMonthlyAutomatedTransfers() {
        LocalDate today = LocalDate.now();

        // 1. 납부일이 오늘이거나, 과거에 연체되어 아직 PENDING인 스케줄 싹 다 조회
        List<PendingSavingsDto> dueSchedules = savingsScheduleMapper.findDueSchedules(today);

        if(!dueSchedules.isEmpty()){
            System.out.println("⏳ [적금 자동이체 배치] 출금 대상 " + dueSchedules.size() + "건 발견. 처리 시작!");
        }

        for (PendingSavingsDto schedule : dueSchedules) {
            // 2. 비밀번호 없이 내부망 권한으로 자동 이체 실행 (연결계좌 -> 적금계좌)
            boolean isSuccess = transactionHistoryService.autoTransfer(
                    schedule.getLinkedAccountId(),
                    schedule.getAccountId(),
                    schedule.getInstallmentAmount(),
                    "적금 " + schedule.getDueDate().getMonthValue() + "월분 자동이체"
            );

            // 3. 이체 성공 시에만 스케줄 상태를 COMPLETED 로 쾅! 찍어줌
            if (isSuccess) {
                savingsScheduleMapper.updateScheduleStatus(schedule.getScheduleId(), "COMPLETED");
                System.out.println("✅ [자동이체 성공] 스케줄 ID: " + schedule.getScheduleId() + " (" + schedule.getInstallmentAmount() + "원 출금완료)");
            } else {
                // 잔고 부족 등으로 실패하면 상태는 계속 PENDING으로 남아 내일 다시 시도하게 됨
                System.out.println("❌ [자동이체 보류 - 잔액부족 등] 스케줄 ID: " + schedule.getScheduleId());
            }
        }
    }
}