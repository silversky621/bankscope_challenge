package com.bankscope.backend.valitators;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 비밀번호 검증 규칙 단위 테스트.
 * 규칙: 영문 대/소문자 + 숫자 + 특수문자를 모두 포함하고 8~50자.
 */
class UserValidatorTest {

    @Test
    @DisplayName("대소문자·숫자·특수문자를 모두 포함한 8자 이상 비밀번호는 통과한다")
    void validPassword() {
        assertTrue(UserValidator.validatePassword("Test1234!"));
        assertTrue(UserValidator.validatePassword("Abcd123$xyz"));
    }

    @Test
    @DisplayName("8자 미만이면 실패한다")
    void tooShort() {
        assertFalse(UserValidator.validatePassword("Ab1!"));
    }

    @Test
    @DisplayName("대문자가 없으면 실패한다")
    void missingUppercase() {
        assertFalse(UserValidator.validatePassword("test1234!"));
    }

    @Test
    @DisplayName("특수문자가 없으면 실패한다")
    void missingSpecialChar() {
        assertFalse(UserValidator.validatePassword("Test1234"));
    }

    @Test
    @DisplayName("숫자가 없으면 실패한다")
    void missingDigit() {
        assertFalse(UserValidator.validatePassword("TestTest!"));
    }

    @Test
    @DisplayName("null이면 실패한다")
    void nullPassword() {
        assertFalse(UserValidator.validatePassword((String) null));
    }
}
