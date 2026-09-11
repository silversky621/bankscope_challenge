package com.bankscope.backend.results;

public enum EmailResult implements Result{
    SUCCESS,
    FAILURE,
    FAILURE_DUPLICATE_EMAIL,
    FAILURE_EXPIRED
}
