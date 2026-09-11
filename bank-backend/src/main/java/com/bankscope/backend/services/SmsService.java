package com.bankscope.backend.services;


import com.solapi.sdk.SolapiClient;
import com.solapi.sdk.message.model.Message;
import com.solapi.sdk.message.service.DefaultMessageService;
import com.bankscope.backend.mappers.SmsMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Random;

@Service

public class SmsService {
    private final DefaultMessageService messageService;
    private final SmsMapper smsMapper;

    @Value("${solapi.from.number}")
    private String fromNumber; // application.properties에서 가져옴
    @Autowired
    public SmsService(SmsMapper smsMapper,
                      @Value("${solapi.api.key}") String apiKey,
                      @Value("${solapi.api.secret}") String apiSecret) {
        this.smsMapper = smsMapper;
        // 최신 솔라피 클라이언트 초기화
        this.messageService = SolapiClient.INSTANCE.createInstance(apiKey, apiSecret);
    }
    // 1. 인증번호 발송
    public void sendAuthSms(String phone) {
        String authCode = generateAuthCode();

        // DB에 저장 (이전 기록 덮어쓰기, 3분 타이머 시작)
        smsMapper.saveAuthCode(phone, authCode);

        // 솔라피 문자 객체 조립
        Message message = new Message();
        message.setFrom(fromNumber);
        message.setTo(phone);
        // BankScope 프로젝트 이름에 맞게 수정했습니다. (장문 전환을 막기 위해 짧게 작성!)
        message.setText("[BankScope] 인증번호 [" + authCode + "]를 입력해주세요.");

        try {
            messageService.send(message);
            System.out.println("문자 발송 성공! 대상: " + phone);
        } catch (Exception e) {
            System.out.println("문자 발송 실패: " + e.getMessage());
            throw new RuntimeException("SMS 발송에 실패했습니다.");
        }
    }
    // 2. 인증번호 검증 (사용자가 입력한 번호 확인)
    public boolean verifyAuthCode(String phone, String inputCode) {
        // DB에서 아직 만료되지 않은 유효한 인증번호 조회
        String savedCode = smsMapper.getValidAuthCode(phone);

        // DB에 코드가 존재하고, 입력한 코드와 일치한다면?
        if (savedCode != null && savedCode.equals(inputCode)) {
            // DB의 is_verified 값을 true로 업데이트
            smsMapper.updateToVerified(phone);
            return true;
        }
        return false;
    }

    // 3. [보안] PIN 발급/변경 직전에 '인증이 완료된 유저'인지 최종 확인
    public boolean isAuthenticationComplete(String phone) {
        Boolean isVerified = smsMapper.isVerified(phone);
        return isVerified != null && isVerified;
    }

    // 4. PIN 발급 완료 후 보안을 위해 남은 인증 정보 완전히 삭제
    public void cleanupAuthInfo(String phone) {
        smsMapper.deleteAuthInfo(phone);
    }

    // 랜덤 6자리 숫자 생성기
    private String generateAuthCode() {
        Random rand = new Random();
        StringBuilder numStr = new StringBuilder();
        for (int i = 0; i < 6; i++) {
            numStr.append(rand.nextInt(10));
        }
        return numStr.toString();
    }


}
