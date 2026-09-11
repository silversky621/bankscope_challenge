package com.bankscope.backend.entities;

import lombok.*;

import java.time.LocalDateTime;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class EmailTokenEntity {
    private String email;
    private String code;
    private boolean isVerified;
    private boolean isUsed;
    private LocalDateTime createdAt;
    private LocalDateTime expiresAt;
}
