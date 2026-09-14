package com.bankscope.backend.dtos;

public record TaskTransferRequest(Long taskId, Integer targetMemberId, String actualTaskDetailType, String reason) {}
