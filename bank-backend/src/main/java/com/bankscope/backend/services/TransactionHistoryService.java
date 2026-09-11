package com.bankscope.backend.services;

import com.bankscope.backend.entities.AccountEntity;
import com.bankscope.backend.entities.TransactionHistoryEntity;
import com.bankscope.backend.mappers.AccountMapper;
import com.bankscope.backend.mappers.TransactionHistoryMapper;
import com.bankscope.backend.results.TransactionResult;
import com.bankscope.backend.vos.AccountVo;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.tuple.Pair;
import org.springframework.security.crypto.bcrypt.BCrypt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class TransactionHistoryService {
    private final TransactionHistoryMapper transactionHistoryMapper;
    private final AccountMapper accountMapper;

    public boolean isAccountOwnedBy(String accountNumber, Integer userId) {
        if (accountNumber == null || userId == null) {
            return false;
        }
        AccountEntity account = accountMapper.selectAccountByAccountNumber(accountNumber);
        return account != null && userId.equals(account.getUserId());
    }

    @Transactional
    public Pair<TransactionResult,TransactionHistoryEntity> deposit(String accountNumber, Long amount, String description, Long taskId) {
        if (amount == null || amount <= 0) {
            return Pair.of(TransactionResult.FAILURE, null);
        }

        AccountEntity account = accountMapper.selectAccountByAccountNumber(accountNumber);
        if (account == null || !"ACTIVE".equals(account.getStatus())) {
            return Pair.of(TransactionResult.FAILURE_INVALID_ACCOUNT, null);
        }

        Long newBalance = account.getBalance() + amount;
        
        int updated = accountMapper.updateBalance(account.getAccountId(), newBalance);
        if (updated == 0) {
            return Pair.of(TransactionResult.FAILURE, null);
        }

        TransactionHistoryEntity transaction = TransactionHistoryEntity.builder()
                .accountId(account.getAccountId())
                .userId(account.getUserId())
                .taskId(taskId)
                .transactionType("DEPOSIT")
                .amount(amount)
                .balanceAfter(newBalance)
                .description(description)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
                
        int inserted = transactionHistoryMapper.insertTransaction(transaction);
        if (inserted == 0) {
            return Pair.of(TransactionResult.FAILURE, null);
        }

        return Pair.of(TransactionResult.SUCCESS, transaction);
    }

    @Transactional
    public Pair<TransactionResult, TransactionHistoryEntity> withdraw(String accountNumber, String accountPassword, Long amount, String description, Long taskId) {
        if (amount == null || amount <= 0) {
            return Pair.of(TransactionResult.FAILURE, null);
        }

        AccountEntity account = accountMapper.selectAccountByAccountNumber(accountNumber);
        if (account == null || !"ACTIVE".equals(account.getStatus())) {
            return Pair.of(TransactionResult.FAILURE_INVALID_ACCOUNT, null);
        }

        if (accountPassword == null || !BCrypt.checkpw(accountPassword, account.getAccountPassword())) {
            return Pair.of(TransactionResult.FAILURE_INVALID_PASSWORD, null);
        }

        if (account.getBalance() < amount) {
            return Pair.of(TransactionResult.FAILURE_INSUFFICIENT_BALANCE, null);
        }

        Long newBalance = account.getBalance() - amount;

        int updated = accountMapper.updateBalance(account.getAccountId(), newBalance);
        if (updated == 0) {
            return Pair.of(TransactionResult.FAILURE, null);
        }

        TransactionHistoryEntity transaction = TransactionHistoryEntity.builder()
                .accountId(account.getAccountId())
                .userId(account.getUserId())
                .taskId(taskId)
                .transactionType("WITHDRAW")
                .amount(amount)
                .balanceAfter(newBalance)
                .description(description)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        int inserted = transactionHistoryMapper.insertTransaction(transaction);
        if (inserted == 0) {
            return Pair.of(TransactionResult.FAILURE, null);
        }

        return Pair.of(TransactionResult.SUCCESS, transaction);
    }

    @Transactional
    public Pair<TransactionResult, TransactionHistoryEntity> transfer(String fromAccountNumber, String accountPassword, String toAccountNumber, Long amount, String description, Long taskId) {
        if (amount == null || amount <= 0) {
            return Pair.of(TransactionResult.FAILURE, null);
        }

        if (fromAccountNumber == null || fromAccountNumber.equals(toAccountNumber)) {
            return Pair.of(TransactionResult.FAILURE_INVALID_ACCOUNT, null);
        }

        AccountEntity fromAccount = accountMapper.selectAccountByAccountNumber(fromAccountNumber);
        if (fromAccount == null || !"ACTIVE".equals(fromAccount.getStatus())) {
            return Pair.of(TransactionResult.FAILURE_INVALID_ACCOUNT, null);
        }

        if (accountPassword == null || !BCrypt.checkpw(accountPassword, fromAccount.getAccountPassword())) {
            return Pair.of(TransactionResult.FAILURE_INVALID_PASSWORD, null);
        }

        if (fromAccount.getBalance() < amount) {
            return Pair.of(TransactionResult.FAILURE_INSUFFICIENT_BALANCE, null);
        }

        AccountEntity toAccount = accountMapper.selectAccountByAccountNumber(toAccountNumber);
        if (toAccount == null || !"ACTIVE".equals(toAccount.getStatus())) {
            return Pair.of(TransactionResult.FAILURE_INVALID_TO_ACCOUNT, null);
        }

        Long newFromBalance = fromAccount.getBalance() - amount;
        Long newToBalance = toAccount.getBalance() + amount;

        int updatedFrom = accountMapper.updateBalance(fromAccount.getAccountId(), newFromBalance);
        int updatedTo = accountMapper.updateBalance(toAccount.getAccountId(), newToBalance);

        if (updatedFrom == 0 || updatedTo == 0) {
            return Pair.of(TransactionResult.FAILURE, null);
        }

        TransactionHistoryEntity fromTransaction = TransactionHistoryEntity.builder()
                .accountId(fromAccount.getAccountId())
                .userId(fromAccount.getUserId())
                .taskId(taskId)
                .transactionType("TRANSFER_OUT")
                .amount(amount)
                .balanceAfter(newFromBalance)
                .description(toAccount.getAccountAlias() + "에게 이체: " + description)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
                
        TransactionHistoryEntity toTransaction = TransactionHistoryEntity.builder()
                .accountId(toAccount.getAccountId())
                .userId(toAccount.getUserId())
                .taskId(taskId)
                .transactionType("TRANSFER_IN")
                .amount(amount)
                .balanceAfter(newToBalance)
                .description(fromAccount.getAccountAlias() + "로부터 입금: " + description)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        int insertedFrom = transactionHistoryMapper.insertTransaction(fromTransaction);
        int insertedTo = transactionHistoryMapper.insertTransaction(toTransaction);

        if (insertedFrom == 0 || insertedTo == 0) {
            return Pair.of(TransactionResult.FAILURE, null);
        }

        // 이체의 경우, 출금(송금)한 쪽의 거래 내역을 주로 반환합니다.
        return Pair.of(TransactionResult.SUCCESS, fromTransaction);
    }

    // 👇 TransactionHistoryService.java 내부에 추가
    @Transactional
    public boolean autoTransfer(Long fromAccountId, Long toAccountId, Long amount, String description) {
        // 1. 출금할 계좌(연결 계좌)와 입금할 계좌(적금 계좌) 정보 조회
        AccountVo fromAccount = accountMapper.selectAccountById(fromAccountId);
        AccountVo toAccount = accountMapper.selectAccountById(toAccountId);

        // 2. 예외 처리 및 잔액 확인 (자동이체이므로 비밀번호 검사는 생략!)
        if (fromAccount == null || !"ACTIVE".equals(fromAccount.getStatus()) ||
                toAccount == null || !"ACTIVE".equals(toAccount.getStatus())) {
            return false;
        }
        if (fromAccount.getBalance() < amount) {
            return false; // 연결 계좌에 돈이 부족하면 자동이체 실패 처리
        }

        // 3. 금액 갱신
        Long newFromBalance = fromAccount.getBalance() - amount;
        Long newToBalance = toAccount.getBalance() + amount;

        accountMapper.updateBalance(fromAccountId, newFromBalance);
        accountMapper.updateBalance(toAccountId, newToBalance);

        // 4. 거래 내역 박제 (출금 기록)
        TransactionHistoryEntity fromTx = TransactionHistoryEntity.builder()
                .accountId(fromAccountId).userId(fromAccount.getUserId())
                .transactionType("WITHDRAW_AUTO").amount(amount).balanceAfter(newFromBalance)
                .description(description).createdAt(LocalDateTime.now()).updatedAt(LocalDateTime.now())
                .build();

        // 5. 거래 내역 박제 (입금 기록)
        TransactionHistoryEntity toTx = TransactionHistoryEntity.builder()
                .accountId(toAccountId).userId(toAccount.getUserId())
                .transactionType("DEPOSIT_AUTO").amount(amount).balanceAfter(newToBalance)
                .description(description).createdAt(LocalDateTime.now()).updatedAt(LocalDateTime.now())
                .build();

        transactionHistoryMapper.insertTransaction(fromTx);
        transactionHistoryMapper.insertTransaction(toTx);

        return true;
    }
}
