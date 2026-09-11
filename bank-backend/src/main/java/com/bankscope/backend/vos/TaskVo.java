package com.bankscope.backend.vos;


import lombok.*;
import lombok.experimental.SuperBuilder;

@SuperBuilder
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@ToString(callSuper = true)
public class TaskVo {

    private Long taskId;
    private Integer userId;
    private String ticketNumber;
    private String taskType;
    private String taskDetailType;
    private String assignedLevel;
    private Integer expectedWaitingTime;
    private String status;
    private Integer memberId;
    private Integer ranking;
    private String createdAt;
    private String updatedAt;
    private String name;
    private String level;
    private String userName;
    private String grade;
    private String age;
    private String gender;
    private Boolean isAi;
    private Integer counterNumber;

}
