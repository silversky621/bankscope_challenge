package com.bankscope.backend.entities;

import lombok.*;
import java.io.Serializable;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
@EqualsAndHashCode(of = "id")
public class MemberEntity implements Serializable {
    private Long id;
    private String email;
    private String password;
    private String name;
    private Integer level;
    private String auth;
    private String team;
    private Integer status;
    private int counterNumber;
    private LocalDate joinDate;
    private LocalDateTime lastLogin;
    private LocalDateTime createdAt;
}