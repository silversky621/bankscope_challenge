package com.bankscope.backend.services;

import com.bankscope.backend.dtos.SavingsAccountRequestDto;
import com.bankscope.backend.dtos.SavingsDepositRequestDto;
import com.bankscope.backend.entities.*;
import com.bankscope.backend.entities.*;
import com.bankscope.backend.mappers.FinancialProductMapper;
import com.bankscope.backend.mappers.SavingsAccountMapper;
import com.bankscope.backend.mappers.SavingsScheduleMapper;
import com.bankscope.backend.results.AccountResult;
import com.bankscope.backend.results.TransactionResult;
import com.bankscope.backend.vos.AccountVo;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.tuple.Pair;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class SavingsService {

    private final AccountService accountService;
    private final TransactionHistoryService transactionHistoryService; // 입출금용 추가
    private final SavingsAccountMapper savingsAccountMapper;
    private final SavingsScheduleMapper savingsScheduleMapper;
    private final FinancialProductMapper financialProductMapper;

    @Transactional
    public Pair<AccountResult, AccountVo> createSavingsAccount( SavingsAccountRequestDto dto) {

        // 1. 연결 계좌에서 1회차 선납금 즉시 출금 (TransactionHistoryService 사용)
        Pair<TransactionResult, ?> withdrawResult = transactionHistoryService.withdraw(
                dto.getLinkedAccountNumber(),
                dto.getLinkedAccountPassword(),
                dto.getInstallmentAmount(),
                "적금 1회차 납입 출금",
                dto.getTaskId() != null ? Long.valueOf(dto.getTaskId()) : null
        );

        if (withdrawResult.getLeft() != TransactionResult.SUCCESS) {
            // FAILURE_INVALID_ACCOUNT 대신 기존에 있는 FAILURE 사용
            return Pair.of(AccountResult.FAILURE, null);
        }

        // 2. 금융 상품 정보 조회 (getInterestRate -> getBaseInterestRate로 수정)
        FinancialProductEntity product = financialProductMapper.selectById(dto.getProductId());
        if (product == null) {
            return Pair.of(AccountResult.FAILURE, null);
        }
        BigDecimal appliedInterestRate = product.getBaseInterestRate() != null ? product.getBaseInterestRate() : BigDecimal.ZERO;

        // 3. 기본 계좌 생성 (AccountService의 기존 함수 사용)
        dto.setUserId(dto.getUserId());
        Pair<AccountResult, AccountVo> baseAccountResult = accountService.createSavingsAccount(dto);
        if (baseAccountResult.getLeft() != AccountResult.SUCCESS) {
            return baseAccountResult;
        }
        AccountVo newAccount = baseAccountResult.getRight();
        Long newAccountId = newAccount.getAccountId();

        // 4. 생성된 적금 계좌에 1회차 납입액 즉시 입금 처리 (TransactionHistoryService 사용)
        transactionHistoryService.deposit(
                newAccount.getAccountNumber(),
                dto.getInstallmentAmount(),
                "적금 1회차 입금",
                dto.getTaskId() != null ? Long.valueOf(dto.getTaskId()) : null
        );

        // 5. 상품 가입 이력(스냅샷) 영구 박제
        ProductSubscriptionEntity subscription = ProductSubscriptionEntity.builder()
                .userId(dto.getUserId())
                .productId(dto.getProductId())
                .amount(dto.getInstallmentAmount())
                .durationMonths(dto.getTermMonths())
                .appliedInterestRate(appliedInterestRate)
                .status("ACTIVE")
                .build();
        financialProductMapper.insertSubscription(subscription);

        // 6. 적금 전용 1:1 상세 정보 테이블 저장
        SavingsAccountEntity savingsAccount = SavingsAccountEntity.builder()
                .accountId(newAccountId)
                .linkedAccountId(dto.getLinkedAccountId())
                .installmentAmount(dto.getInstallmentAmount())
                .termMonths(dto.getTermMonths())
                .paymentDay(dto.getPaymentDay())
                .maturityDate(LocalDate.now().plusMonths(dto.getTermMonths()))
                .build();
        savingsAccountMapper.insertSavingsAccount(savingsAccount);

        // 7. 만기일까지의 전체 납입 스케줄 쫙 깔아주기
        generateAndSaveSavingsSchedules(newAccountId, dto.getInstallmentAmount(), dto.getTermMonths(), dto.getPaymentDay());

        // 8. 방금 낸 1회차 돈에 대해 가장 가까운 스케줄을 COMPLETED로 처리
        processSavingsDeposit(newAccountId, dto.getInstallmentAmount());

        return Pair.of(AccountResult.SUCCESS, newAccount);
    }

    private void generateAndSaveSavingsSchedules(Long accountId, Long installmentAmount, int termMonths, int paymentDay) {
        List<SavingsScheduleEntity> schedules = new ArrayList<>();
        LocalDate currentDate = LocalDate.now();

        LocalDate firstDueDate = currentDate.withDayOfMonth(paymentDay);
        if (currentDate.getDayOfMonth() > paymentDay) {
            firstDueDate = firstDueDate.plusMonths(1);
        }

        for (int i = 0; i < termMonths; i++) {
            schedules.add(SavingsScheduleEntity.builder()
                    .accountId(accountId)
                    .dueDate(firstDueDate.plusMonths(i))
                    .installmentAmount(installmentAmount)
                    .status("PENDING")
                    .build());
        }

        savingsScheduleMapper.insertSavingsSchedules(schedules);
    }

    public void processSavingsDeposit(Long accountId, Long amount) {
        SavingsScheduleEntity pendingSchedule = savingsScheduleMapper.findEarliestPendingSchedule(accountId);
        if (pendingSchedule != null && pendingSchedule.getInstallmentAmount().compareTo(amount) <= 0) {
            savingsScheduleMapper.updateScheduleStatus(pendingSchedule.getScheduleId(), "COMPLETED");
        }
    }

    // 상단에 private final TransactionService transactionService; 가 주입되어 있다고 가정합니다.

    /**
     * 적금 수동 납부 (MVC 패턴 적용)
     */
    @Transactional
    public Pair<AccountResult, TransactionHistoryEntity> manualDeposit(SavingsDepositRequestDto dto) {

        // 1. 제공해주신 완벽한 transfer 함수 호출! (비밀번호 검증, 잔고 검증, 거래 내역 기록이 여기서 전부 끝납니다)
        Pair<TransactionResult, TransactionHistoryEntity> transferResult = transactionHistoryService.transfer(
                dto.getLinkedAccountNumber(),
                dto.getLinkedAccountPassword(),
                dto.getSavingsAccountNumber(),
                dto.getAmount(),
                "적금 수동 납입",
                null
        );

        // 2. 이체가 실패했다면 즉시 튕겨냅니다.
        if (transferResult.getLeft() != TransactionResult.SUCCESS) {
            throw new RuntimeException("납입에 실패했습니다. 사유: " + transferResult.getLeft().name());
        }

        // 3. 💸 이체가 성공했다면? 적금 스케줄을 찾아서 업데이트 (PENDING -> COMPLETED)
        // (적금 계좌번호로 account_id를 알아낸 뒤, 기존에 만들어둔 스케줄 처리 메서드를 재사용합니다)
        AccountEntity savingsAccount = accountService.getAccountByAccountNumber(dto.getSavingsAccountNumber());

        // 이 메서드는 이전에 우리가 배치 만들 때 짰던 "가장 가까운 PENDING 스케줄을 COMPLETED로 바꾸는 로직" 입니다.
        processSavingsDeposit(savingsAccount.getAccountId(), dto.getAmount());

        return Pair.of(AccountResult.SUCCESS, transferResult.getRight());
    }

}