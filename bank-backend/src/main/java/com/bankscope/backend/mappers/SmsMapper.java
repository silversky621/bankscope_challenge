package com.bankscope.backend.mappers;


import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface SmsMapper {
    // 1. 인증번호 발송 시 DB 저장 (또는 덮어쓰기)
    void saveAuthCode(@Param("phoneNumber") String phoneNumber, @Param("authCode") String authCode);

    // 2. 입력한 인증번호가 맞는지, 만료되지 않았는지 확인
    String getValidAuthCode(@Param("phoneNumber") String phoneNumber);

    // 3. 인증 성공 시 is_verified 상태를 true로 변경
    void updateToVerified(@Param("phoneNumber") String phoneNumber);

    // 4. PIN 발급 직전, 인증이 완료된 유저인지 확인 (true/false 반환)
    Boolean isVerified(@Param("phoneNumber") String phoneNumber);

    // 5. PIN 발급 완료 후 보안을 위해 인증 정보 삭제
    void deleteAuthInfo(@Param("phoneNumber") String phoneNumber);
}
