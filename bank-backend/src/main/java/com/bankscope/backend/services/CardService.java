package com.bankscope.backend.services;

import com.bankscope.backend.dtos.CardRequestDto;
import com.bankscope.backend.entities.AccountEntity;
import com.bankscope.backend.entities.CardEntity;
import com.bankscope.backend.entities.UserEntity;
import com.bankscope.backend.mappers.AccountMapper;
import com.bankscope.backend.mappers.CardMapper;
import com.bankscope.backend.mappers.UserMapper;
import com.bankscope.backend.results.CommonResult;
import com.bankscope.backend.vos.AccountVo;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.tuple.Pair;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Random;

@Service
@RequiredArgsConstructor
public class CardService {
    // 매퍼 연결해서 쓰세요
    private final CardMapper cardMapper;
    private final AccountMapper accountMapper; // 계좌 조회를 위해 추가
    private final UserMapper userMapper;

    // =================================================================
    // 🌐 일반 웹사이트 발급 로직
    // =================================================================
    @Transactional
    public CommonResult createCard(CardRequestDto dto, UserEntity user) {
        if (dto.getAccountId() == null || dto.getCardType() == null) {
            return CommonResult.FAILURE;
        }

        List<AccountVo> accounts = accountMapper.selectAccountsByUserId(user.getId());

        AccountEntity account = accountMapper.selectAccountById(dto.getAccountId());
        if (account == null || !account.getUserId().equals(user.getId())) {
            return CommonResult.FAILURE;
        }

        CardEntity card = new CardEntity();

        card.setUserId(user.getId());
        card.setAccountId(account.getAccountId());
        card.setCardType(dto.getCardType());
        card.setCardNumber(generateCardNumber());
        card.setCardName(dto.getCardName());
        card.setCvc(generateCvc());
        card.setValidThru(generateValidThru());
        card.setPaymentDay(dto.getPaymentDay());
        card.setStatus("ISSUING");
        card.setCardColor(dto.getCardColor());
        card.setIssuedAt(LocalDateTime.now());
        // 4. DB 저장
        int result = this.cardMapper.insertCard(card);
        return result > 0 ? CommonResult.SUCCESS : CommonResult.FAILURE;
    }

    // =================================================================
    // 🏢 행원 워크스페이스 발급 로직
    // =================================================================
    @Transactional
    public CommonResult createCardByMember(CardRequestDto dto) {
        if (dto.getUserId() == null || dto.getAccountId() == null || dto.getCardType() == null) {
            return CommonResult.FAILURE;
        }

        // 1. 발급 대상 고객(User) 정보 조회
        UserEntity targetUser = userMapper.selectUserById(dto.getUserId());
        if (targetUser == null) return CommonResult.FAILURE;

        // 2. 계좌 소유권 검증 (해당 고객의 계좌가 맞는지)
        AccountEntity account = accountMapper.selectAccountById(dto.getAccountId());
        if (account == null || !account.getUserId().equals(targetUser.getId())) {
            return CommonResult.FAILURE;
        }

        // 3. 🏢 법인카드 vs 일반카드 교차 검증 및 강제 할당
        if ("corporate".equals(targetUser.getUserType())) {
            // [법인] 무조건 사업자번호가 등록되어 있어야 함
            if (targetUser.getIdentificationNumber() == null || targetUser.getIdentificationNumber().isEmpty()) {
                return CommonResult.FAILURE;
            }
            // [법인] 무조건 "CORP_" 접두사를 붙여서 법인 카드로 강제 변환
            if (!dto.getCardType().startsWith("CORP_")) {
                dto.setCardType("CORP_" + dto.getCardType());
            }
        } else {
            // [일반개인] 법인카드(CORP_)를 신청하려 하면 에러 반환 (데이터 무결성 보호)
            if (dto.getCardType().startsWith("CORP_")) {
                return CommonResult.FAILURE;
            }
        }

        // 워크스페이스 '카드 발급'은 항상 새 카드를 생성한다(창구 신규 발급).
        // 웹에서 이미 신청한 카드의 '수령'은 별도의 활성화(ISSUING→ACTIVE) 흐름으로 처리한다.
        CardEntity card = new CardEntity();

        // 4. 💳 신용카드 로직 셋업 (타입명에 "CREDIT"이 포함되어 있으면 모두 신용카드로 취급)
        if (dto.getCardType().contains("CREDIT")) {
            if (dto.getPaymentDay() == null || dto.getPaymentDay() < 1 || dto.getPaymentDay() > 28) {
                return CommonResult.FAILURE;
            }

            // 워크스페이스(행원 대면) 발급은 한도를 좀 더 크게 줄 수 있습니다.
            card.setCreditLimit(10000000L);
            card.setUsedAmount(0L);
            card.setPaymentDay(dto.getPaymentDay());
        } else {
            card.setCreditLimit(null);
            card.setUsedAmount(null);
            card.setPaymentDay(null);
        }

        // 5. 엔티티 공통 설정 조립
        card.setUserId(targetUser.getId());
        card.setAccountId(account.getAccountId());
        card.setCardType(dto.getCardType());
        card.setCardNumber(generateCardNumber());
        card.setCardName(dto.getCardName());
        card.setCvc(generateCvc());
        card.setValidThru(generateValidThru());
        card.setStatus("ACTIVE");
        card.setCardColor(dto.getCardColor());
        card.setIssuedAt(LocalDateTime.now());

        // 6. DB 저장
        int result = this.cardMapper.insertCard(card);
        return result > 0 ? CommonResult.SUCCESS : CommonResult.FAILURE;
    }

    // =================================================================
    // 🔍 카드 조회 및 관리 (수정, 삭제) 로직
    // =================================================================

    public List<CardEntity> getCardsByUserId(Integer userId) {
        return this.cardMapper.selectCardsByUserId(userId);
    }

    public Pair<CommonResult, CardEntity> getCardById(Long cardId, Integer userId){
        // 카드조회 로직 구현
        CardEntity card = this.cardMapper.selectCardByIdAndUserId(cardId, userId);
        if (card != null) {
            return Pair.of(CommonResult.SUCCESS, card);
        }
        return Pair.of(CommonResult.FAILURE, null);
    }

    public CommonResult updateCardStatus(Long cardId, String status, Integer userId){
        // 카드상태변경 로직 구현
        if (status == null || status.trim().isEmpty()) {
            return CommonResult.FAILURE;
        }
        int result = this.cardMapper.updateCardStatus(cardId, status, userId);
        return result > 0 ? CommonResult.SUCCESS : CommonResult.FAILURE;
    }

    public CommonResult deleteCard(Long cardId, Integer userId){
        // 카드삭제 로직 구현
        int result = this.cardMapper.deleteCard(cardId, userId);
        return result > 0 ? CommonResult.SUCCESS : CommonResult.FAILURE;
    }

    // --- 난수 생성 헬퍼 메서드 (자동 생성 로직) ---
    private String generateCardNumber() {
        Random random = new Random();
        return String.format("%04d-%04d-%04d-%04d",
                random.nextInt(10000), random.nextInt(10000), random.nextInt(10000), random.nextInt(10000));
    }

    private String generateCvc() {
        Random random = new Random();
        return String.format("%03d", random.nextInt(1000));
    }

    private String generateValidThru() {
        // 발급일 기준 5년 후 유효기간 (MM/yy 형식)
        LocalDateTime expiryDate = LocalDateTime.now().plusYears(5);
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("MM/yy");
        return expiryDate.format(formatter);
    }

    // 행원용 카드 발급 (워크스페이스용)
    /*public CommonResult createCardByMember(CardEntity card , Long accountId) {*/
    public CommonResult createCardByMember(CardEntity card) {
        // 행원이 프론트엔드에서 고객의 userId, 연결할 accountId, cardType을 반드시 넘겨주어야 함
        if (card.getUserId() == null || card.getAccountId() == null || card.getCardType() == null) {
            return CommonResult.FAILURE;
        }
        /*card.setAccountId( accountId);*/
        // 고객용과 동일하게 카드 번호, CVC, 유효기간 자동 생성
        card.setCardNumber(generateCardNumber());
        card.setCvc(generateCvc());
        card.setValidThru(generateValidThru());
        card.setStatus("ACTIVE");
        card.setIssuedAt(LocalDateTime.now());

        // 매퍼를 통해 DB insert
        int result = this.cardMapper.insertCard(card);
        return result > 0 ? CommonResult.SUCCESS : CommonResult.FAILURE;
    }
}
