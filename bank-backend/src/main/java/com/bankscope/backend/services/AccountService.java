package com.bankscope.backend.services;


import com.bankscope.backend.dtos.CorporateAccountRequestDto;
import com.bankscope.backend.dtos.DepositAccountRequestDto;
import com.bankscope.backend.dtos.SavingsAccountRequestDto;
import com.bankscope.backend.entities.*;
import com.bankscope.backend.entities.*;
import com.bankscope.backend.enums.MaturityTreatment;
import com.bankscope.backend.enums.ProductCategory;
import com.bankscope.backend.mappers.AccountMapper;
import com.bankscope.backend.mappers.FinancialProductMapper;
import com.bankscope.backend.mappers.TransactionHistoryMapper;
import com.bankscope.backend.mappers.UserMapper;
import com.bankscope.backend.results.AccountResult;
import com.bankscope.backend.vos.AccountVo;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.tuple.Pair;
import org.springframework.security.crypto.bcrypt.BCrypt;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Random;

@Service
@RequiredArgsConstructor
public class AccountService {

    private final AccountMapper accountMapper;
    private final UserMapper userMapper;
    private final FinancialProductMapper financialProductMapper;
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
    private final TransactionHistoryMapper transactionHistoryMapper;

    public Pair<AccountResult, AccountEntity> createAccount(Integer userId, String accountType, String accountAlias, String accountPassword) {
        
        // 사용자 존재 여부 확인
        UserEntity user = userMapper.selectUserById(userId);
        if (user == null) {
            return Pair.of(AccountResult.FAILURE_USER_NOT_EXIST, null);
        }
        // 사용자 유저여부 확인
        if ( user.getUserType() != null && !(user.getUserType().equals("customer")|| user.getUserType().equals("unregisterCustomer"))) {
            return Pair.of(AccountResult.FAILURE, null);
        }
        if ( accountType == null || accountType.trim().isEmpty() || accountPassword == null || accountPassword.trim().isEmpty() ) {
            return Pair.of(AccountResult.FAILURE, null);
        }

        AccountEntity account  = new AccountEntity();
        account.setUserId(userId);
        // 계좌번호 생성 및 중복 검사
        String accountNumber;
        do {
            accountNumber = generateAccountNumber();
        } while (accountMapper.countByAccountNumber(accountNumber) > 0);

        account.setAccountNumber(accountNumber);
        account.setAccountType(accountType);
        account.setAccountAlias(accountAlias);
        account.setCreatedAt(LocalDateTime.now());
        account.setAccountType("CHECKING");
        account.setLastTransactionAt(LocalDateTime.now());
        account.setBalance(0L);
        account.setStatus("ACTIVE");
        account.setAccountPassword(encoder.encode(accountPassword));
        account.setPasswordFailCount(0);
        int insert = this.accountMapper.insertAccount(account);
        if ( insert > 0 ) {
            return Pair.of(AccountResult.SUCCESS,account);
        }
        return Pair.of(AccountResult.FAILURE, null);

    }

    // 일반 예금 (입출금) 계좌 개설
    public Pair<AccountResult, AccountVo> createAccount(DepositAccountRequestDto dto) {
        UserEntity user = userMapper.selectUserById(dto.getUserId());
        if (user == null) {
            return Pair.of(AccountResult.FAILURE_USER_NOT_EXIST, null);
        }

        // 금융 상품 정보 조회 및 검증
        FinancialProductEntity product = financialProductMapper.selectById(dto.getProductId());
        if (product == null || !Boolean.TRUE.equals(product.getIsActive())) {
            return Pair.of(AccountResult.FAILURE, null); // 상품이 없거나 활성화되지 않음
        }

        // 입출금 계좌 번호 생성
        String accountNumber;
        do {
            accountNumber = generateAccountNumber();
        } while (accountMapper.countByAccountNumber(accountNumber) > 0);

        AccountEntity account = new AccountEntity();
        account.setUserId(dto.getUserId());
        account.setProductId(dto.getProductId()); // 상품 ID 저장
        account.setAccountNumber(accountNumber);
        account.setAccountType("CHECKING"); // 일반 예금/입출금이므로 무조건 CHECKING
        account.setAccountAlias(dto.getAccountAlias());
        account.setAccountPassword(encoder.encode(dto.getAccountPassword()));
        account.setBalance(dto.getAmount() != null ? dto.getAmount() : 0L); // 초기 입금액 설정
        account.setStatus("ACTIVE");
        account.setInterestRate(product.getBaseInterestRate()); // 상품 기본 이율 적용
        account.setMaturityDate(null); // 일반 예금(입출금)은 만기일 없음
        account.setCreatedAt(LocalDateTime.now());
        account.setLastTransactionAt(LocalDateTime.now());
        account.setPasswordFailCount(0);

        int result = accountMapper.insertAccount(account);
        if (result > 0) {
            BigDecimal appliedInterestRate = product.getBaseInterestRate() != null
                ? product.getBaseInterestRate()
                : null;

            ProductSubscriptionEntity sub = ProductSubscriptionEntity.builder()
                .userId(dto.getUserId())
                .taskId(dto.getTaskId() != null ? Long.valueOf(dto.getTaskId()) : null)
                .productId(dto.getProductId())
                .amount(dto.getAmount() != null ? dto.getAmount() : 0L)
                .durationMonths(0) // 입출금은 약정 기간 없음
                .appliedInterestRate(appliedInterestRate)
                .status("ACTIVE")
                .createdAt(LocalDateTime.now())
                .build();
            financialProductMapper.insertSubscription(sub);

            // 생성된 계좌 정보를 조회하여 Vo로 다시 조회하여 반환
            AccountVo createdAccountVo = accountMapper.selectAccountById(account.getAccountId());
            return Pair.of(AccountResult.SUCCESS, createdAccountVo);
        }

        return Pair.of(AccountResult.FAILURE, null);
    }


    public AccountResult checkAccountPassword( Long id, String accountPassword) {
        AccountVo account = this.accountMapper.selectAccountById(id);
        if (account == null) {
            System.out.println("계정을 찾을 수 없음. ID: " + id);
            return AccountResult.FAILURE;
        }
        if (BCrypt.checkpw(accountPassword, account.getAccountPassword())) {
            return AccountResult.SUCCESS;
        } else {
            return AccountResult.FAILURE;
        }
    }

    private String generateAccountNumber() {
        Random random = new Random();
        // 예: 110-XXX-XXXXXX (신한은행 스타일)
        int part1 = 110;
        int part2 = random.nextInt(900) + 100; // 100 ~ 999
        int part3 = random.nextInt(900000) + 100000; // 100000 ~ 999999
        return String.format("%d-%d-%d", part1, part2, part3);
    }

    private String generateDepositAccountNumber() {
        Random random = new Random();
        // 예금: 210-XXX-XXXXXX
        int part1 = 210;
        int part2 = random.nextInt(900) + 100;
        int part3 = random.nextInt(900000) + 100000;
        return String.format("%d-%d-%d", part1, part2, part3);
    }

    private String generateSavingsAccountNumber() {
        Random random = new Random();
        // 적금: 220-XXX-XXXXXX
        int part1 = 220;
        int part2 = random.nextInt(900) + 100;
        int part3 = random.nextInt(900000) + 100000;
        return String.format("%d-%d-%d", part1, part2, part3);
    }



    public List<AccountVo> getMyAccounts(Integer userId) {
        return this.accountMapper.selectAccountsByUserId(userId);
    }

    public AccountVo getAccountById(Long accountId) {
        return this.accountMapper.selectAccountById(accountId);
    }

    public AccountVo getAccountByAccountNumber(String accountNumber) {
        return this.accountMapper.selectAccountByAccountNumber(accountNumber);
    }

    @Transactional
    public Pair<AccountResult, AccountVo> createDepositAccount(DepositAccountRequestDto dto) {
        UserEntity user = userMapper.selectUserById(dto.getUserId());
        if (user == null) {
            return Pair.of(AccountResult.FAILURE_USER_NOT_EXIST, null);
        }

        // 금융 상품 정보 조회 및 검증
        FinancialProductEntity product = financialProductMapper.selectById(dto.getProductId());
        if (product == null || !Boolean.TRUE.equals(product.getIsActive())) {
            return Pair.of(AccountResult.FAILURE, null); // 상품이 없거나 활성화되지 않음
        }

        if (product.getProductCategory() != ProductCategory.DEPOSIT) {
            return Pair.of(AccountResult.FAILURE, null); // 예금 상품이 아님
        }

        // 가입 금액, 기간 유효성 검사 (상품 설정 범위 내인지 확인)
        if (dto.getAmount() < product.getMinAmount() || dto.getAmount() > product.getMaxAmount()) {
            return Pair.of(AccountResult.FAILURE, null);
        }
        if (dto.getDurationMonths() < product.getMinDurationMonths() || dto.getDurationMonths() > product.getMaxDurationMonths()) {
            return Pair.of(AccountResult.FAILURE, null);
        }

        //예금 계좌 번호 생성

        AccountVo linkedAccount = this.accountMapper.selectAccountById(dto.getLinkedAccountId());
        if (linkedAccount == null) {
            return Pair.of(AccountResult.FAILURE, null);
        }
        if (linkedAccount.getBalance() < dto.getAmount()) {
            // 잔액이 부족할 경우 실패 처리
            return Pair.of(AccountResult.FAILURE, null);
        }

        String accountNumber;
        do {
            accountNumber = generateDepositAccountNumber();
        } while (accountMapper.countByAccountNumber(accountNumber) > 0);
        long balanceAfterWithdrawal = linkedAccount.getBalance() - dto.getAmount();

        int updateResult = this.accountMapper.updateBalance(dto.getLinkedAccountId(), balanceAfterWithdrawal);
        if (updateResult <= 0) {
            return Pair.of(AccountResult.FAILURE, null); // 업데이트 실패 시 중단
        }
        TransactionHistoryEntity transaction = TransactionHistoryEntity.builder()
                .accountId(dto.getLinkedAccountId())
                .userId(dto.getUserId())
                .taskId(dto.getTaskId() != null ? Long.valueOf(dto.getTaskId()) : null)
                .transactionType("TRANSFER_OUT")
                .amount(dto.getAmount())
                .balanceAfter(balanceAfterWithdrawal) // 차감 후 남은 잔액 기록
                .description("예금 신규 가입 출금")
                .createdAt(LocalDateTime.now())
                .build(); // builder()는 반드시 build()로 닫아주어야 합니다.

        this.transactionHistoryMapper.insertTransaction(transaction);


        AccountEntity account = new AccountEntity();
        account.setUserId(dto.getUserId());
        account.setProductId(dto.getProductId()); // 상품 ID 저장
        account.setAccountNumber(accountNumber);
        account.setAccountType("DEPOSIT"); // 계좌 타입 설정
        account.setAccountAlias(dto.getAccountAlias());
        account.setAccountPassword(encoder.encode(dto.getAccountPassword()));
        account.setBalance(dto.getAmount()); // 초기 입금액 설정
        account.setStatus("ACTIVE");
        account.setInterestRate(product.getBaseInterestRate()); // 상품 기본 이율 적용
        account.setMaturityDate(LocalDateTime.now().plusMonths(dto.getDurationMonths()));
        account.setCreatedAt(LocalDateTime.now());
        account.setLastTransactionAt(LocalDateTime.now());
        account.setPasswordFailCount(0);

        int result = accountMapper.insertAccount(account);
        if (result > 0) {
            BigDecimal appliedInterestRate = product.getBaseInterestRate() != null
                ? product.getBaseInterestRate()
                : null;

            ProductSubscriptionEntity sub = ProductSubscriptionEntity.builder()
                .userId(dto.getUserId())
                .taskId(dto.getTaskId() != null ? Long.valueOf(dto.getTaskId()) : null)
                .productId(dto.getProductId())
                .amount(dto.getAmount())
                .durationMonths(dto.getDurationMonths())
                .appliedInterestRate(appliedInterestRate)
                .status("ACTIVE")
                .createdAt(LocalDateTime.now())
                .build();
            financialProductMapper.insertSubscription(sub);

            DepositAccountEntity deposit = new DepositAccountEntity();
            // DB에서 자동 생성된 accountId 사용
            deposit.setAccountId(account.getAccountId());
            deposit.setLinkedAccountId(dto.getLinkedAccountId());
            if (dto.getMaturityTreatment() == null) {
                deposit.setMaturityTreatment(MaturityTreatment.AUTO_TERMINATE);
            } else {
                deposit.setMaturityTreatment(dto.getMaturityTreatment());
            }
            this.accountMapper.insertDepositAccount(deposit);

            // 생성된 계좌 정보를 조회하여 Vo로 다시 조회하여 반환
            AccountVo createdAccountVo = accountMapper.selectAccountById(account.getAccountId());
            return Pair.of(AccountResult.SUCCESS, createdAccountVo);
        }

        return Pair.of(AccountResult.FAILURE, null);
    }


    public Pair<AccountResult, AccountVo> createSavingsAccount(SavingsAccountRequestDto dto) {
        UserEntity user = userMapper.selectUserById(dto.getUserId());
        if (user == null) {
            return Pair.of(AccountResult.FAILURE_USER_NOT_EXIST, null);
        }

        FinancialProductEntity product = financialProductMapper.selectById(dto.getProductId());
        if (product == null || !Boolean.TRUE.equals(product.getIsActive())) {
            return Pair.of(AccountResult.FAILURE, null);
        }

        if (product.getProductCategory() != ProductCategory.SAVINGS) {
            return Pair.of(AccountResult.FAILURE, null); // 적금 상품이 아님
        }

        if (dto.getInstallmentAmount() < product.getMinAmount() || dto.getInstallmentAmount() > product.getMaxAmount()) {
            return Pair.of(AccountResult.FAILURE, null);
        }
        if (dto.getTermMonths() < product.getMinDurationMonths() || dto.getTermMonths() > product.getMaxDurationMonths()) {
            return Pair.of(AccountResult.FAILURE, null);
        }

        String accountNumber;
        do {
            accountNumber = generateSavingsAccountNumber();
        } while (accountMapper.countByAccountNumber(accountNumber) > 0);

        AccountEntity account = new AccountEntity();
        account.setUserId(dto.getUserId());
        account.setProductId(dto.getProductId());
        account.setAccountNumber(accountNumber);
        account.setAccountType("SAVINGS");
        account.setAccountAlias(dto.getAccountAlias());
        account.setAccountPassword(encoder.encode(dto.getAccountPassword()));
        account.setBalance(0L); // 적금은 개설 시 잔액이 0원
        account.setStatus("ACTIVE");
        account.setInterestRate(product.getBaseInterestRate());
        account.setMaturityDate(LocalDateTime.now().plusMonths(dto.getTermMonths()));
        account.setCreatedAt(LocalDateTime.now());
        account.setLastTransactionAt(LocalDateTime.now());
        account.setPasswordFailCount(0);

        int result = accountMapper.insertAccount(account);
        if (result > 0) {
            BigDecimal appliedInterestRate = product.getBaseInterestRate() != null
                    ? product.getBaseInterestRate()
                    : null;

            ProductSubscriptionEntity sub = ProductSubscriptionEntity.builder()
                .userId(dto.getUserId())
                .productId(dto.getProductId())
                .amount(dto.getInstallmentAmount())
                .taskId(dto.getTaskId() != null ? Long.valueOf(dto.getTaskId()) : null)
                .durationMonths(dto.getTermMonths())
                .appliedInterestRate(appliedInterestRate)
                .status("ACTIVE")
                .createdAt(LocalDateTime.now())
                .build();
            financialProductMapper.insertSubscription(sub);

            AccountVo createdAccountVo = accountMapper.selectAccountById(account.getAccountId());
            return Pair.of(AccountResult.SUCCESS, createdAccountVo);
        }

        return Pair.of(AccountResult.FAILURE, null);
    }

    // -------------------------------------------------------------
    // 법인 전용 계좌번호 생성기 (예: 230-XXX-XXXXXX)
    // -------------------------------------------------------------
    private String generateCorporateAccountNumber() {
        Random random = new Random();
        int part1 = 230; // 💡 법인 입출금 전용 식별 코드
        int part2 = random.nextInt(900) + 100;
        int part3 = random.nextInt(900000) + 100000;
        return String.format("%d-%d-%d", part1, part2, part3);
    }

    // -------------------------------------------------------------
    // 법인 계좌 개설 서비스 로직
    // -------------------------------------------------------------
    public Pair<AccountResult, AccountVo> createCorporateAccount(CorporateAccountRequestDto dto) {
        UserEntity user = userMapper.selectUserById(dto.getUserId());

        if (user == null) {
            return Pair.of(AccountResult.FAILURE_USER_NOT_EXIST, null);
        }
        if (!"corporate".equals(user.getUserType())) {
            return Pair.of(AccountResult.FAILURE_NOT_CORPORATE_USER, null);
        }

        FinancialProductEntity product = financialProductMapper.selectById(dto.getProductId());

        if (product == null || !Boolean.TRUE.equals(product.getIsActive())) {
            return Pair.of(AccountResult.FAILURE, null);
        }
        if ( !(product.getTargetType().equals("CORPORATE") || product.getTargetType().equals("ALL"))) {
            return Pair.of(AccountResult.FAILURE, null);
        }

        // 3. 계좌번호 채번
        String accountNumber;
        do {
            accountNumber = generateCorporateAccountNumber();
        } while (accountMapper.countByAccountNumber(accountNumber) > 0);

        // 5. 실제 계좌 엔티티 생성
        AccountEntity account = new AccountEntity();
        account.setUserId(dto.getUserId());
        account.setProductId(dto.getProductId());
        account.setAccountNumber(accountNumber);
        account.setAccountType("CHECKING");
        account.setAccountAlias(dto.getAccountAlias());
        account.setAccountPassword(encoder.encode(dto.getAccountPassword()));
        account.setBalance(dto.getAmount() != null ? dto.getAmount() : 0L);
        account.setStatus("ACTIVE");
        account.setInterestRate(product.getBaseInterestRate());

        // 💡 핵심 성격 반영: 입출금이 자유로운 기본 계좌이므로 '만기일'이 존재하지 않음!
        account.setMaturityDate(null);

        account.setCreatedAt(LocalDateTime.now());
        account.setLastTransactionAt(LocalDateTime.now());
        account.setPasswordFailCount(0);

        // 6. DB 저장 및 VO 반환
        int result = accountMapper.insertAccount(account);
        if (result > 0) {
            BigDecimal appliedInterestRate = product.getBaseInterestRate() != null
                    ? product.getBaseInterestRate()
                    : null;

            // 4. 상품 가입 이력 저장 (입출금 계좌이므로 계약 기간(durationMonths)이 0)
            ProductSubscriptionEntity sub = ProductSubscriptionEntity.builder()
                .userId(dto.getUserId())
                .taskId(dto.getTaskId() != null ? Long.valueOf(dto.getTaskId()) : null)
                .productId(dto.getProductId())
                .amount(dto.getAmount())
                .durationMonths(0)
                .appliedInterestRate(appliedInterestRate)
                .status("ACTIVE")
                .createdAt(LocalDateTime.now())
                .build();
            financialProductMapper.insertSubscription(sub);

            AccountVo createdAccountVo = accountMapper.selectAccountById(account.getAccountId());
            return Pair.of(AccountResult.SUCCESS, createdAccountVo);
        }

        return Pair.of(AccountResult.FAILURE, null);
    }


    public AccountResult modifyAccountPassword(Long accountId,String oldPassword ,String newPassword) {
        //  계좌 존재 여부 확인
        AccountVo dbAccount = this.accountMapper.selectAccountById(accountId);
        if (dbAccount == null) {
            return AccountResult.FAILURE;
        }
        if ( !BCrypt.checkpw(oldPassword, dbAccount.getAccountPassword())) {
            return AccountResult.FAILURE;
        }

        dbAccount.setAccountPassword(encoder.encode(newPassword));


        int affectedRows = this.accountMapper.updateAccountPassword(dbAccount);

        return affectedRows > 0 ? AccountResult.SUCCESS : AccountResult.FAILURE;
    }


}
