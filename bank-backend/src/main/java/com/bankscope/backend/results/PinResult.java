package com.bankscope.backend.results;

public enum PinResult implements Result{
    SUCCESS,
    FAILURE,
    FAILURE_SMS_NOT_VERIFIED,
    FAILURE_EXCEED_FAIL_COUNT,
    FAILURE_PIN_NOR_REGISTERED
}
