package com.bankscope.backend.results;

public enum TaskResult implements Result {
    SUCCESS,
    FAILURE,
    FAILURE_TASK_IN_PROGRESS,
    FAILURE_SESSION,
    FAILURE_INVALID_STATUS,
    FAILURE_NOT_ALLOWED,
    FAILURE_TASK_PLURAL

}
