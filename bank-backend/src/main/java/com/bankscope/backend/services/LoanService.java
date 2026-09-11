package com.bankscope.backend.services;

import com.bankscope.backend.entities.*;
import com.bankscope.backend.mappers.*;
import com.bankscope.backend.entities.*;
import com.bankscope.backend.enums.ProductCategory;
import com.bankscope.backend.mappers.*;
import com.bankscope.backend.results.LoanResult;
import com.bankscope.backend.vos.LoanVo;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.tuple.Pair;
import org.springframework.security.crypto.bcrypt.BCrypt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.math.RoundingMode;

@Service
@RequiredArgsConstructor
public class LoanService {

    private final LoanMapper loanMapper;
    private final AccountMapper accountMapper;
    private final TransactionHistoryMapper transactionHistoryMapper;
    private final LoanScheduleMapper loanScheduleMapper;
    private final FinancialProductMapper financialProductMapper;

    /**
     * 대출 신청 (비대면 웹/앱용)
     */
    @Transactional
    public Pair<LoanResult, LoanEntity> applyLoanFromWeb(UserEntity user, Integer productId,
                                                         Long linkedAccountId, Long principalAmount,
                                                         Integer durationMonths, Integer paymentDay, String info) {
        return executeLoanCreation(user.getId(), productId, linkedAccountId, principalAmount,
                durationMonths, paymentDay, info, null, null);
    }

    /**
     * 대출 신청 (행원 대면 워크스페이스용)
     */
    @Transactional
    public Pair<LoanResult, LoanEntity> applyLoanByMember(MemberEntity member, Integer targetUserId, Integer productId,
                                                          Long linkedAccountId, Long principalAmount,
                                                          Integer durationMonths, Integer paymentDay, String info, Long taskId) {
        return executeLoanCreation(targetUserId, productId, linkedAccountId, principalAmount,
                durationMonths, paymentDay, info, taskId, member.getId().intValue());
    }
//
//    /**
//     * 대출 생성 + 계좌로 대출금 입금 (FinancialProductService 호출용)
//     */
//    @Transactional
//    public Pair<LoanResult, LoanEntity> createLoan(Integer userId, Integer productId, Long linkedAccountId,
//                                                   Long principalAmount, Integer durationMonths,
//                                                   Double interestRate, Integer paymentDay, String info) {
//        return executeLoanCreation(userId, productId, linkedAccountId, principalAmount,
//                durationMonths, paymentDay, info, null, null);
//    }

    /**
     * [핵심 공통 로직] 대출 생성 및 실행의 모든 과정을 처리합니다.
     */
    private Pair<LoanResult, LoanEntity> executeLoanCreation(Integer userId, Integer productId, Long linkedAccountId,
                                                             Long principalAmount, Integer durationMonths,
                                                             Integer paymentDay, String info, Long taskId, Integer memberId) {
        // 1. 금액 유효성 검사
        if (principalAmount == null || principalAmount <= 0) {
            return Pair.of(LoanResult.FAILURE_INVALID_AMOUNT, null);
        }

        // 2. 계좌 확인
        AccountEntity account = accountMapper.selectAccountById(linkedAccountId);
        if (account == null || !account.getUserId().equals(userId) || !"ACTIVE".equals(account.getStatus())) {
            return Pair.of(LoanResult.FAILURE_INVALID_ACCOUNT, null);
        }

        // 3. 상품 검증
        FinancialProductEntity product = financialProductMapper.selectById(productId);
        if (product == null || !Boolean.TRUE.equals(product.getIsActive()) || product.getProductCategory() != ProductCategory.LOAN) {
            return Pair.of(LoanResult.FAILURE, null);
        }

        // 4. 기간, 금리, 만기일 계산
        int months = durationMonths != null ? durationMonths : 12;
        String maturityDate = LocalDate.now().plusMonths(months).format(DateTimeFormatter.ofPattern("yyyy-MM-dd"));
        BigDecimal appliedInterestRate = product.getBaseInterestRate() != null
                ? product.getBaseInterestRate()
                : new BigDecimal("5.0"); // 기본값 5.0

        // 5. 상품 가입 이력 기록
        ProductSubscriptionEntity sub = ProductSubscriptionEntity.builder()
                .userId(userId).productId(productId).taskId(taskId).amount(principalAmount)
                .durationMonths(months).appliedInterestRate(appliedInterestRate)
                .status("ACTIVE").createdAt(LocalDateTime.now()).build();
        financialProductMapper.insertSubscription(sub);

        /*// 6. 행원 상담 이력 기록 (행원 대면인 경우에만)
        if (taskId != null && memberId != null) {
            String noteContent = "[대출 개설] " + product.getProductName() + (info != null && !info.isBlank() ? " | " + info : "");
            TaskProcessingLogEntity log = TaskProcessingLogEntity.builder()
                    .taskId(taskId).memberId(memberId).actionType("ADD_NOTE").processingNote(noteContent).build();
            financialProductMapper.insertProcessingLog(log);
        }*/

        // 7. 대출 엔티티 생성 및 DB 저장
        LoanEntity loan = LoanEntity.builder()
                .userId(userId).productId(productId).linkedAccountId(linkedAccountId)
                .principalAmount(principalAmount).outstandingAmount(principalAmount)
                .interestRate(appliedInterestRate).paymentDay(paymentDay).info(info)
                .maturityDate(maturityDate).build();

        int inserted = loanMapper.insertLoan(loan);
        if (inserted == 0) return Pair.of(LoanResult.FAILURE, null);

        // 8. 계좌 입금 및 거래 이력 기록
        Long newBalance = account.getBalance() + principalAmount;
        accountMapper.updateBalance(linkedAccountId, newBalance);

        String desc = "대출 실행 (대출ID: " + loan.getLoanId() + ")" + (memberId != null ? " - 행원 취급" : "");
        TransactionHistoryEntity transaction = TransactionHistoryEntity.builder()
                .accountId(linkedAccountId).userId(userId).transactionType("LOAN_DISBURSEMENT")
                .amount(principalAmount).balanceAfter(newBalance).description(desc)
                .createdAt(LocalDateTime.now()).updatedAt(LocalDateTime.now()).build();
        transactionHistoryMapper.insertTransaction(transaction);

        // 9. 상환 스케줄 자동 생성 (Integer 타입의 loanId를 Long으로 변환)
        Long safeLoanId = loan.getLoanId() != null ? loan.getLoanId().longValue() : 0L;
        generateAndSaveLoanSchedules(Math.toIntExact(safeLoanId), principalAmount, months, appliedInterestRate, LocalDate.now());

        return Pair.of(LoanResult.SUCCESS, loan);
    }

    // 내 대출 목록 조회
    public Pair<LoanResult, List<LoanVo>> getMyLoans(UserEntity user) {
        if (user == null) return Pair.of(LoanResult.FAILURE_SESSION, null);
        return Pair.of(LoanResult.SUCCESS, loanMapper.selectLoansByUserId(user.getId()));
    }
    public Pair<LoanResult, List<LoanVo>> getUserLoans(Integer userId) {
        if (userId == null) return Pair.of(LoanResult.FAILURE_SESSION, null);
        return Pair.of(LoanResult.SUCCESS, loanMapper.selectLoansByUserId(userId));
    }

    // 대출 상세 조회
    public Pair<LoanResult, LoanEntity> getLoanDetail(Integer loanId, UserEntity user, boolean staffAccess) {
        if (!staffAccess && user == null) return Pair.of(LoanResult.FAILURE_SESSION, null);
        LoanEntity loan = loanMapper.selectLoanById(loanId);
        if (loan == null) return Pair.of(LoanResult.FAILURE_LOAN_NOT_FOUND, null);
        if (!staffAccess && !loan.getUserId().equals(user.getId())) return Pair.of(LoanResult.FAILURE_UNAUTHORIZED, null);
        return Pair.of(LoanResult.SUCCESS, loan);
    }
    public Pair<LoanResult, LoanVo> getLoanVoDetail(Integer loanId, UserEntity user, boolean staffAccess) {
        if (!staffAccess && user == null) return Pair.of(LoanResult.FAILURE_SESSION, null);

        LoanVo loan = loanMapper.selectLoanVoById(loanId);
        if (loan == null) return Pair.of(LoanResult.FAILURE_LOAN_NOT_FOUND, null);
        if (!staffAccess && !loan.getUserId().equals(user.getId())) return Pair.of(LoanResult.FAILURE_UNAUTHORIZED, null);
        return Pair.of(LoanResult.SUCCESS, loan);
    }

    // 대출 정보 수정 (관리자용)
    public LoanResult updateLoan(LoanEntity loanInfo, UserEntity user) {
        if (user == null) return LoanResult.FAILURE_SESSION;
        if (!"admin".equals(user.getUserType())) return LoanResult.FAILURE_UNAUTHORIZED;
        if (loanMapper.selectLoanById(loanInfo.getLoanId()) == null) return LoanResult.FAILURE_LOAN_NOT_FOUND;

        return loanMapper.updateLoanInfo(loanInfo) > 0 ? LoanResult.SUCCESS : LoanResult.FAILURE;
    }

    /**
     * 대출 상환 (스케줄 청구액 1회차분 정밀 출금)
     */
    @Transactional
    public Pair<LoanResult, LoanEntity> repayLoan(Integer loanId, String accountNumber, String accountPassword, UserEntity user) {

        if (user == null) return Pair.of(LoanResult.FAILURE_SESSION, null);

        LoanEntity loan = loanMapper.selectLoanById(loanId);
        if (loan == null) return Pair.of(LoanResult.FAILURE_LOAN_NOT_FOUND, null);
        if (!loan.getUserId().equals(user.getId())) return Pair.of(LoanResult.FAILURE_UNAUTHORIZED, null);
        if ("COMPLETED".equals(loan.getStatus())) return Pair.of(LoanResult.FAILURE_ALREADY_COMPLETED, null);

        AccountEntity account = accountMapper.selectAccountByAccountNumber(accountNumber);
        if (account == null || !"ACTIVE".equals(account.getStatus()) || !BCrypt.checkpw(accountPassword, account.getAccountPassword())) {
            return Pair.of(LoanResult.FAILURE_INVALID_ACCOUNT, null);
        }

        // ✨ 핵심 1: 가장 시급한(오래된) 대기/연체 스케줄을 조회합니다.
        List<LoanScheduleEntity> pendingSchedules = loanScheduleMapper.findPendingSchedulesByLoanId(loanId.longValue());
        if (pendingSchedules == null || pendingSchedules.isEmpty()) {
            return Pair.of(LoanResult.FAILURE_ALREADY_COMPLETED, null); // 더 이상 갚을 스케줄이 없음
        }

        // ✨ 핵심 2: 이번에 처리할 딱 1건의 스케줄과 그 금액(exactRepayAmount)을 가져옵니다.
        LoanScheduleEntity targetSchedule = pendingSchedules.get(0);
        long exactRepayAmount = targetSchedule.getRepayAmount();

        // 3. 계좌 잔액 검증: 스케줄 금액보다 통장 잔고가 적으면 가차 없이 튕겨냅니다.
        if (account.getBalance() < exactRepayAmount) {
            return Pair.of(LoanResult.FAILURE_INSUFFICIENT_BALANCE, null);
        }

        // 4. 계좌 출금
        Long newBalance = account.getBalance() - exactRepayAmount;
        accountMapper.updateBalance(account.getAccountId(), newBalance);

        // 5. 단일 스케줄 '완료(PAID)' 처리
        targetSchedule.setStatus("PAID");
        targetSchedule.setPaidAt(LocalDateTime.now());
        loanScheduleMapper.updateScheduleStatus(targetSchedule);

        // 6. 대출 마스터 테이블(잔액) 업데이트
        long newOutstanding = loan.getOutstandingAmount() - exactRepayAmount;
        if (newOutstanding <= 0) {
            loanMapper.updateLoanStatus(loanId, "COMPLETED");
            loan.setStatus("COMPLETED");
            newOutstanding = 0;
        }

        loanMapper.updateOutstandingAmount(loanId, newOutstanding);
        loan.setOutstandingAmount(newOutstanding);

        // 7. 거래 내역 기록
        TransactionHistoryEntity transaction = TransactionHistoryEntity.builder()
                .accountId(account.getAccountId())
                .userId(user.getId())
                .transactionType("LOAN_REPAY")
                .amount(exactRepayAmount) // 딱 스케줄 금액만큼만 기록
                .balanceAfter(newBalance)
                .description(targetSchedule.getDueDate() + " 상환분 (대출ID: " + loanId + ")")
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
        transactionHistoryMapper.insertTransaction(transaction);

        return Pair.of(LoanResult.SUCCESS, loan);
    }

    /**
     * 스케줄 상환 처리 (수정됨)
     * @return 실제 스케줄 처리에 사용된 총액 (증발하는 자투리 돈 제외)
     */
    public long processLoanRepayment(Long loanId, Long repaymentAmount) {
        List<LoanScheduleEntity> pendingSchedules = loanScheduleMapper.findPendingSchedulesByLoanId(loanId);
        long remainingAmount = repaymentAmount;
        long totalAppliedAmount = 0L; // 실제로 상환 처리에 쓰인 돈

        for (LoanScheduleEntity schedule : pendingSchedules) {
            // 이번 회차 스케줄을 전액 낼 돈이 안 되면 스탑 (일부 상환 미지원)
            if (remainingAmount < schedule.getRepayAmount()) {
                break;
            }

            // 스케줄 완료 처리
            schedule.setStatus("PAID");
            schedule.setPaidAt(LocalDateTime.now());
            loanScheduleMapper.updateScheduleStatus(schedule);

            // 사용한 돈 차감 및 누적
            remainingAmount -= schedule.getRepayAmount();
            totalAppliedAmount += schedule.getRepayAmount();
        }

        return totalAppliedAmount; // 딱 떨어지게 갚은 돈만 반환
    }

    public Pair<LoanResult, List<LoanScheduleEntity>> getLoanSchedules(Long loanId, UserEntity user, boolean staffAccess) {
        if (loanId == null) return Pair.of(LoanResult.FAILURE_LOAN_NOT_FOUND, null);
        if (!staffAccess && user == null) return Pair.of(LoanResult.FAILURE_SESSION, null);
        LoanEntity loan = loanMapper.selectLoanById(loanId.intValue());
        if (loan == null) return Pair.of(LoanResult.FAILURE_LOAN_NOT_FOUND, null);
        if (!staffAccess && !loan.getUserId().equals(user.getId())) return Pair.of(LoanResult.FAILURE_UNAUTHORIZED, null);
        return Pair.of(LoanResult.SUCCESS, this.loanScheduleMapper.findPendingSchedulesByLoanId(loanId));
    }

    /**
     * 상환 스케줄 생성 (Long/Double 버전)
     */
    @Transactional
    public void generateAndSaveLoanSchedules(int loanId, Long principalAmount, int termMonths, BigDecimal annualInterestRate, LocalDate approvalDate) {
        List<LoanScheduleEntity> schedules = new ArrayList<>();

        // 1. 월 이자율 계산 (연 이율 / 12 / 100)
        BigDecimal monthlyRate = annualInterestRate.divide(new BigDecimal("1200"), 10, RoundingMode.HALF_UP);

        // 2. 원리금 균등 상환금 계산
        long fixedMonthlyRepayment;
        if (monthlyRate.compareTo(BigDecimal.ZERO) == 0) {
            // 무이자(0%) 상품은 분모가 0이 되어 공식 적용 불가 → 원금만 균등 분할
            fixedMonthlyRepayment = principalAmount / termMonths;
        } else {
            // 공식: P * r * (1+r)^n / ((1+r)^n - 1)
            BigDecimal onePlusRateN = monthlyRate.add(BigDecimal.ONE).pow(termMonths);
            fixedMonthlyRepayment = BigDecimal.valueOf(principalAmount)
                    .multiply(monthlyRate)
                    .multiply(onePlusRateN)
                    .divide(onePlusRateN.subtract(BigDecimal.ONE), 0, RoundingMode.HALF_UP)
                    .longValueExact();
        }
        long remainingPrincipal = principalAmount;

        for (int i = 1; i <= termMonths; i++) {
            LocalDate dueDate = approvalDate.plusMonths(i);

            // 3. 이자 계산: 잔여 원금 * 월 이자율
            long monthlyInterest = BigDecimal.valueOf(remainingPrincipal)
                    .multiply(monthlyRate)
                    .setScale(0, RoundingMode.HALF_UP)
                    .longValueExact();

            // 4. 원금 계산: 총 상환금 - 이자
            // 마지막 회차는 잔여 원금을 모두 털어내야 하므로 정산 처리
            long currentPrincipal;
            long currentRepayment;

            if (i == termMonths) {
                currentPrincipal = remainingPrincipal;
                currentRepayment = currentPrincipal + monthlyInterest; // 마지막엔 원금 + 이자
            } else {
                currentPrincipal = fixedMonthlyRepayment - monthlyInterest;
                currentRepayment = fixedMonthlyRepayment;
            }

            LoanScheduleEntity schedule = LoanScheduleEntity.builder()
                    .loanId(loanId)
                    .dueDate(dueDate)
                    .repayAmount(currentRepayment)
                    .status("SCHEDULED")
                    .build();

            schedules.add(schedule);

            // 원금 상환 후 잔액 갱신
            remainingPrincipal -= currentPrincipal;
        }

        loanScheduleMapper.insertLoanSchedules(schedules);
    }


    /**
     * 특정 대출의 기준일 이후 상환 스케줄 조회
     */
    public Pair<LoanResult, List<LoanScheduleEntity>> getLoanSchedulesFromDate(Integer loanId, LocalDate startDate, UserEntity user) {
        if (user == null) {
            return Pair.of(LoanResult.FAILURE_SESSION, null);
        }

        LoanEntity loan = loanMapper.selectLoanById(loanId);
        if (loan == null) {
            return Pair.of(LoanResult.FAILURE_LOAN_NOT_FOUND, null);
        }
        if (!loan.getUserId().equals(user.getId()) && !"admin".equals(user.getUserType())) {
            return Pair.of(LoanResult.FAILURE_UNAUTHORIZED, null);
        }

        // ✨ 원하는 시점을 설정하지 않으면 현재 시간(오늘)으로 자동 설정
        if (startDate == null) {
            startDate = LocalDate.now();
        }

        // 변경된 Mapper 메서드 호출 (대출 ID와 기준일 함께 전달)
        List<LoanScheduleEntity> schedules = loanScheduleMapper.findSchedulesFromDate(loanId.longValue(), startDate);

        return Pair.of(LoanResult.SUCCESS, schedules);
    }

    // LoanService.java 내부

    /**
     * [배치 전용] 자동 이체 상환 처리
     * 비밀번호 검증 없이 연결된 계좌에서 스케줄 금액을 출금합니다.
     */
    @Transactional
    public boolean autoRepayLoan(LoanScheduleEntity targetSchedule) {
        // 1. 대출 마스터 정보 조회
        LoanEntity loan = loanMapper.selectLoanById(Math.toIntExact(targetSchedule.getLoanId()));
        if (loan == null || "COMPLETED".equals(loan.getStatus())) {
            return false;
        }

        // 2. 연결된 출금 계좌 조회
        AccountEntity account = accountMapper.selectAccountById(loan.getLinkedAccountId());
        if (account == null || !"ACTIVE".equals(account.getStatus())) {
            return false; // 계좌가 정지/해지 상태면 실패
        }

        long exactRepayAmount = targetSchedule.getRepayAmount();

        // 3. 잔액 검증
        if (account.getBalance() < exactRepayAmount) {
            return false; // 잔고 부족 (실패 -> 연체 처리로 넘어가야 함)
        }

        // 4. 계좌 출금 (자동이체)
        Long newBalance = account.getBalance() - exactRepayAmount;
        accountMapper.updateBalance(account.getAccountId(), newBalance);

        // 5. 스케줄 '완료(PAID)' 처리
        targetSchedule.setStatus("PAID");
        targetSchedule.setPaidAt(LocalDateTime.now());
        loanScheduleMapper.updateScheduleStatus(targetSchedule);

        // 6. 대출 마스터 잔액 업데이트
        long newOutstanding = loan.getOutstandingAmount() - exactRepayAmount;
        if (newOutstanding <= 0) {
            loanMapper.updateLoanStatus(loan.getLoanId(), "COMPLETED");
            loan.setStatus("COMPLETED");
            newOutstanding = 0;
        }
        loanMapper.updateOutstandingAmount(loan.getLoanId(), newOutstanding);

        // 7. 거래 내역 기록 (배치 처리임을 명시)
        TransactionHistoryEntity transaction = TransactionHistoryEntity.builder()
                .accountId(account.getAccountId())
                .userId(loan.getUserId()) // 스케줄/대출의 주인 ID
                .transactionType("LOAN_AUTO_REPAY") // 자동이체 타입으로 구분하면 좋습니다
                .amount(exactRepayAmount)
                .balanceAfter(newBalance)
                .description("자동이체: " + targetSchedule.getDueDate() + " 상환분 (대출ID: " + loan.getLoanId() + ")")
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
        transactionHistoryMapper.insertTransaction(transaction);

        return true; // 성공!
    }

    /**
     * 대출 중도 상환 (일부 상환 및 전액 상환 통합 처리)
     */
    @Transactional
    public Pair<LoanResult, LoanEntity> earlyRepayLoan(Integer loanId, String accountNumber, String accountPassword, Long earlyRepayAmount, UserEntity user) {

        if (user == null) return Pair.of(LoanResult.FAILURE_SESSION, null);

        // 1. 대출 마스터 정보 검증
        LoanEntity loan = loanMapper.selectLoanById(loanId);
        if (loan == null) return Pair.of(LoanResult.FAILURE_LOAN_NOT_FOUND, null);
        if (!loan.getUserId().equals(user.getId())) return Pair.of(LoanResult.FAILURE_UNAUTHORIZED, null);
        if ("COMPLETED".equals(loan.getStatus())) return Pair.of(LoanResult.FAILURE_ALREADY_COMPLETED, null);

        // 2. 계좌 검증 및 통장 잔고 확인
        AccountEntity account = accountMapper.selectAccountByAccountNumber(accountNumber);
        if (account == null || !"ACTIVE".equals(account.getStatus()) || !BCrypt.checkpw(accountPassword, account.getAccountPassword())) {
            return Pair.of(LoanResult.FAILURE_INVALID_ACCOUNT, null);
        }
        if (account.getBalance() < earlyRepayAmount) {
            return Pair.of(LoanResult.FAILURE_INSUFFICIENT_BALANCE, null);
        }

        // 3. 계좌 출금 및 거래 내역 기록
        Long newBalance = account.getBalance() - earlyRepayAmount;
        accountMapper.updateBalance(account.getAccountId(), newBalance);

        TransactionHistoryEntity transaction = TransactionHistoryEntity.builder()
                .accountId(account.getAccountId())
                .userId(user.getId())
                .transactionType("LOAN_EARLY_REPAY")
                .amount(earlyRepayAmount)
                .balanceAfter(newBalance)
                .description("대출 중도 상환 (대출ID: " + loanId + ")")
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
        transactionHistoryMapper.insertTransaction(transaction);

        // 4. 순수 원금 잔액 즉시 차감 [cite: 3982]
        long newOutstanding = loan.getOutstandingAmount() - earlyRepayAmount;

        // 5. 기존 미래 스케줄 무효화 (일괄 삭제)
        // 오늘 날짜 이후의 'SCHEDULED' 상태인 스케줄을 모두 지우는 매퍼 메서드 호출
        loanScheduleMapper.deleteFutureSchedules(loanId.longValue());

        if (newOutstanding <= 0) {
            // ✨ [A] 전액 중도 상환 (완제 처리)
            loanMapper.updateLoanStatus(loanId, "COMPLETED");
            loan.setStatus("COMPLETED");
            newOutstanding = 0;
            loanMapper.updateOutstandingAmount(loanId, newOutstanding);
            loan.setOutstandingAmount(newOutstanding);
        } else {
            // ✨ [B] 일부 중도 상환 (남은 원금 업데이트 후 스케줄 재계산) [cite: 3985]
            loanMapper.updateOutstandingAmount(loanId, newOutstanding);
            loan.setOutstandingAmount(newOutstanding);

            // 잔여 원금 기반 새로운 스케줄 재생성 (Batch Insert) [cite: 3988]
            recalculateAndSaveRemainingSchedules(loanId, newOutstanding, loan.getInterestRate(), loan.getMaturityDate());
        }

        return Pair.of(LoanResult.SUCCESS, loan);
    }

    /**
     * [Helper] 중도 일부 상환 시 잔여 스케줄 재계산 및 엎어치기 로직
     */
    private void recalculateAndSaveRemainingSchedules(int loanId, Long remainingPrincipal, BigDecimal annualInterestRate, String maturityDateStr) {

        LocalDate today = LocalDate.now();
        LocalDate maturityDate = LocalDate.parse(maturityDateStr, DateTimeFormatter.ofPattern("yyyy-MM-dd"));

        // 남은 개월 수 산출 (만기일의 년/월 - 오늘의 년/월)
        int remainingMonths = (maturityDate.getYear() - today.getYear()) * 12 + (maturityDate.getMonthValue() - today.getMonthValue());

        if (remainingMonths <= 0) {
            remainingMonths = 1; // 최소 1개월치 스케줄은 생성되도록 방어
        }

        List<LoanScheduleEntity> newSchedules = new ArrayList<>();
        long monthlyPrincipal = remainingPrincipal / remainingMonths;

        BigDecimal monthlyInterestRate = annualInterestRate.divide(
                new BigDecimal("1200"),
                10,
                RoundingMode.HALF_UP
        );
        long totalAllocatedPrincipal = 0L;

        // 새로운 스케줄 계산 및 리스트 담기
        for (int i = 1; i <= remainingMonths; i++) {
            // 오늘 날짜 기준으로 다음 달부터 만기일까지 스케줄 생성
            LocalDate dueDate = today.plusMonths(i);

            long currentPrincipal = (i == remainingMonths) ? (remainingPrincipal - totalAllocatedPrincipal) : monthlyPrincipal;
            long tempRemainingForInterest = remainingPrincipal - totalAllocatedPrincipal;

            long monthlyInterest = BigDecimal.valueOf(tempRemainingForInterest)
                    .multiply(monthlyInterestRate)
                    .setScale(0, RoundingMode.HALF_UP)
                    .longValueExact();

            long totalMonthlyRepayment = currentPrincipal + monthlyInterest;

            LoanScheduleEntity schedule = LoanScheduleEntity.builder()
                    .loanId(loanId)
                    .dueDate(dueDate)
                    .repayAmount(totalMonthlyRepayment)
                    .status("SCHEDULED")
                    .build();

            newSchedules.add(schedule);
            totalAllocatedPrincipal += currentPrincipal;
        }

        // 새로 생성된 스케줄 DB 밀어넣기
        loanScheduleMapper.insertLoanSchedules(newSchedules);
    }
}
