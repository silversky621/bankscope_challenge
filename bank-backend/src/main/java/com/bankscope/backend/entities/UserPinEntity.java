package com.bankscope.backend.entities;

import lombok.*;

import java.time.LocalDateTime;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = "pinId")
public class UserPinEntity {
    private Long pinId;
    private Integer userId;
    private String pinHash;
    private Integer failCount;
    private LocalDateTime lockedUntil;
    private LocalDateTime updatedAt;
}

