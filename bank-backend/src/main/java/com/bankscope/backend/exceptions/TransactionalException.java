package com.bankscope.backend.exceptions;

public class TransactionalException extends RuntimeException {
    // 가장 최상위 예외
    public final Enum<?> result;

    public TransactionalException( Enum<?> result) {
        this.result = result;
    }
    // Enum<?>는 모든 열거형을 상속받는다.
    //모든 열거형은 java.lang.Enum을 상속받기 때문이다.
}
