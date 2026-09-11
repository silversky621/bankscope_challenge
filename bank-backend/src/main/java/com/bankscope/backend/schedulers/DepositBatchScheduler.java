package com.bankscope.backend.schedulers;

import com.bankscope.backend.entities.AccountEntity;
import com.bankscope.backend.entities.DepositAccountEntity;
import com.bankscope.backend.enums.MaturityTreatment;
import com.bankscope.backend.mappers.AccountMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class DepositBatchScheduler {

    private final AccountMapper accountMapper;

    @Transactional
    @Scheduled(cron = "0 0 0 * * *") // 매일 자정에 실행
    public void processMaturedDeposits() {
        LocalDate today = LocalDate.now();
        log.info("🕒 [배치 실행] {} 기준 만기 예금 계좌 처리를 시작합니다.", today);

        List<AccountEntity> maturedAccounts = accountMapper.findMaturedDepositAccounts(today);

        int count = 0;
        for (AccountEntity account : maturedAccounts) {
            DepositAccountEntity depositInfo = accountMapper.findDepositAccountByAccountId(account.getAccountId());

            if (depositInfo != null && depositInfo.getMaturityTreatment() == MaturityTreatment.AUTO_TERMINATE) {
                // 이자 계산 (잔액 * 이율)
                long interest = (long) (account.getBalance() * (account.getInterestRate().doubleValue() / 100));
                long totalAmount = account.getBalance() + interest;

                // 연결 계좌로 이체 (기존 잔액에 더하기 위해 addBalance 사용)
                accountMapper.addBalance(depositInfo.getLinkedAccountId(), totalAmount);

                // 예금 계좌 해지 처리
                account.setStatus("CLOSED");
                account.setBalance(0L);
                accountMapper.updateAccountStatus(account);
                count++;
            }
        }
        log.info("✅ [배치 완료] 총 {}건의 만기 예금 계좌가 자동 해지 처리되었습니다.", count);
    }
}
