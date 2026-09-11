package com.bankscope.backend.services;

import com.bankscope.backend.entities.MemberEntity;
import com.bankscope.backend.mappers.UserMapper;
import com.bankscope.backend.results.CommonResult;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mail.javamail.JavaMailSender;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 행원(member) 비밀번호 처리 단위 테스트.
 * 회귀 방지: 정보 수정 시 빈 비밀번호를 재인코딩하여 비번이 깨지던 버그를 검증한다.
 */
class UserServiceTest {

    private final UserMapper userMapper = mock(UserMapper.class);
    private final JavaMailSender mailSender = mock(JavaMailSender.class);
    private final UserService userService = new UserService(userMapper, mailSender);

    @Test
    @DisplayName("행원 수정 시 비밀번호가 비어있으면 인코딩하지 않고 null로 둔다(기존 비번 보존)")
    void modifyMember_blankPassword_keepsExisting() {
        when(userMapper.updateMember(any())).thenReturn(1);

        MemberEntity member = MemberEntity.builder()
                .email("banker@naver.com")
                .password("")   // 수정 폼이 빈 비밀번호를 보낸 상황
                .build();

        CommonResult result = userService.modifyMember(member);

        assertEquals(CommonResult.SUCCESS, result);
        // password가 null이면 매퍼의 <if> 조건에서 password 컬럼을 건드리지 않아 기존 비번이 보존된다.
        verify(userMapper).updateMember(argThat(m -> m.getPassword() == null));
    }

    @Test
    @DisplayName("행원 수정 시 새 비밀번호가 있으면 BCrypt로 인코딩하여 저장한다")
    void modifyMember_newPassword_isEncoded() {
        when(userMapper.updateMember(any())).thenReturn(1);

        MemberEntity member = MemberEntity.builder()
                .email("banker@naver.com")
                .password("NewPass123!")
                .build();

        userService.modifyMember(member);

        verify(userMapper).updateMember(argThat(m ->
                m.getPassword() != null
                        && m.getPassword().startsWith("$2")        // BCrypt 해시 형식
                        && !m.getPassword().equals("NewPass123!")  // 평문 그대로 저장되지 않음
        ));
    }
}
