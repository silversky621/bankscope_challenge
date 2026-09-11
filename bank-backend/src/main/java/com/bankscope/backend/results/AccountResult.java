package com.bankscope.backend.results;

public enum AccountResult implements Result {
    SUCCESS,
    FAILURE,
    FAILURE_USER_NOT_EXIST,
    FAILURE_PRODUCT_NOT_FOUND,
    FAILURE_NOT_CORPORATE_USER
}
