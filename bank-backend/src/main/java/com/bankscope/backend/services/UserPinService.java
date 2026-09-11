package com.bankscope.backend.services;


import com.bankscope.backend.entities.UserEntity;
import com.bankscope.backend.entities.UserPinEntity;
import com.bankscope.backend.mappers.UserPinMapper;
import com.bankscope.backend.results.CommonResult;
import com.bankscope.backend.results.PinResult;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.bcrypt.BCrypt;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class UserPinService {
    private static final int MAX_FAIL_COUNT = 5;
    private static final int LOCK_MINUTES = 10;

    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
    private final SmsService smsService;
    private final UserPinMapper userPinMapper;

    @Transactional
    public CommonResult createUserPin(UserEntity user, String pin) {
        if (user == null || user.getPhone() == null) {
            return CommonResult.FAILURE;
        }


        if (pin == null || !pin.matches("\\d{6}")) { // PIN은 6자리 숫자인지 정규식으로 검증
            return CommonResult.FAILURE;
        }
        // 1. SMS 인증 완료 여부 확인
        boolean isAuthComplete = smsService.isAuthenticationComplete(user.getPhone());
        if (!isAuthComplete) {
            return CommonResult.FAILURE; // 또는 CommonResult.FAILURE_UNAUTHORIZED
        }

        // 2. PIN 번호 암호화 및 DB 저장
        String encodedPin = encoder.encode(pin);
        int result = userPinMapper.insertUserPin(user.getId(), encodedPin);

        if (result == 0) {
            return CommonResult.FAILURE; // DB 저장 실패
        }
        // 3. 보안을 위해 사용된 인증 정보 즉시 폐기
        smsService.cleanupAuthInfo(user.getPhone());

        return CommonResult.SUCCESS;
    }
    @Transactional
    public CommonResult deleteUserPin(UserEntity user) {
        if( user == null || user.getPhone() == null ) {
            return CommonResult.FAILURE;
        }
        int result = this.userPinMapper.deleteUserPin(user.getId());
        if ( result > 0) {
            return CommonResult.SUCCESS;

        } else {
           return   CommonResult.FAILURE;
        }

    }
    public PinResult updateUserPin(UserEntity user, String pin) {
        if (user == null || user.getPhone() == null) {
            return PinResult.FAILURE;
        }
        if (pin == null || !pin.matches("\\d{6}")) {
            return PinResult.FAILURE;
        }
        // 등록된 핀이 없는경우
        UserPinEntity dbUserPin = this.userPinMapper.getUserPin(user.getId());
        if ( dbUserPin == null) {
            return PinResult.FAILURE_PIN_NOR_REGISTERED;
        }
        String encodedPin = encoder.encode(pin);

        int result = this.userPinMapper.update(user.getId(), encodedPin);
        if ( result > 0 ) {
            return PinResult.SUCCESS;
        } else {
            return PinResult.FAILURE;
        }
    }
    @Transactional
    public CommonResult checkUserPin(UserEntity user, String pin) {

        if (user == null || user.getPhone() == null) {
            return CommonResult.FAILURE;
        }
        if (pin == null || !pin.matches("\\d{6}")) {
            return CommonResult.FAILURE;

        }
        // 유저의 실패횟수가 3번이 되면 lock이 되고 가맹점에 문의해서 해결하라고 해야함.
        UserPinEntity dbUserPin = this.userPinMapper.getUserPin(user.getId());
        if (dbUserPin == null || dbUserPin.getPinHash() == null) {
            return CommonResult.FAILURE;
        }
        if (dbUserPin.getLockedUntil() != null && LocalDateTime.now().isBefore(dbUserPin.getLockedUntil())) {
            return CommonResult.FAILURE;
        }
        if (BCrypt.checkpw(pin, dbUserPin.getPinHash())) {
            this.userPinMapper.resetFailCount(user.getId());
            return CommonResult.SUCCESS;
        }
        int failCount = dbUserPin.getFailCount() == null ? 1 : dbUserPin.getFailCount() + 1;
        LocalDateTime lockedUntil = failCount >= MAX_FAIL_COUNT ? LocalDateTime.now().plusMinutes(LOCK_MINUTES) : null;
        this.userPinMapper.recordFailedAttempt(user.getId(), failCount, lockedUntil);
        return CommonResult.FAILURE;
    }

}
