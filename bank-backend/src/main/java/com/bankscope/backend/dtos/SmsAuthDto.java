package com.bankscope.backend.dtos;


import lombok.Data;

import java.time.LocalDateTime;

@Data
public class SmsAuthDto {
    private String phoneNumber;
    private String authCode;
    private boolean isVerified;
    private LocalDateTime createdAt;
    private LocalDateTime expiresAt;
}
