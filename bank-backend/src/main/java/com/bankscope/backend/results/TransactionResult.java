package com.bankscope.backend.results;

public enum TransactionResult implements Result{
    SUCCESS,
    FAILURE,
    FAILURE_INVALID_ACCOUNT,
    FAILURE_INVALID_TO_ACCOUNT,
    FAILURE_INVALID_PASSWORD,
    FAILURE_INSUFFICIENT_BALANCE
}
