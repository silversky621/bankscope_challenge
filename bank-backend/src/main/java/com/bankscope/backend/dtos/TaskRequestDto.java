package com.bankscope.backend.dtos;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class TaskRequestDto {
    private Integer userId;
    private String taskType;
    private String taskDetailType;
}