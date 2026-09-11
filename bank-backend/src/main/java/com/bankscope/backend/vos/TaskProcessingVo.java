package com.bankscope.backend.vos;
import lombok.*;
import lombok.experimental.SuperBuilder;

@SuperBuilder
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@ToString(callSuper = true)
public class TaskProcessingVo {
    private Long logId;
    private Long taskId;
    private Integer memberId;
    private Integer userId;
    private String memberName;
    private String actionType;
    private String processingNote;
    private String createdAt;
    private String taskType;
    private String taskDetailType;
}
