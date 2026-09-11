package com.bankscope.backend.results;

public enum CommonResult implements Result {
    SUCCESS,
    FAILURE,
    FAILURE_SESSION,
    FAILURE_NOT_AGREED,
    FAILURE_NOT_ALLOWED
}
