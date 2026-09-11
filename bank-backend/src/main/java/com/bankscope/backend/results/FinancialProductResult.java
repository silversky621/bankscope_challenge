package com.bankscope.backend.results;

public enum FinancialProductResult implements Result {
    SUCCESS,
    FAILURE,
    FAILURE_SESSION,
    FAILURE_UNAUTHORIZED,
    FAILURE_PRODUCT_NOT_FOUND,
    FAILURE_INVALID_CATEGORY
}
