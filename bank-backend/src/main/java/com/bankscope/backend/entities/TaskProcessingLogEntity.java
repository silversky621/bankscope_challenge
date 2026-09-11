package com.bankscope.backend.entities;

import lombok.*;

import java.time.LocalDateTime;

@Builder
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = "logId")
public class TaskProcessingLogEntity {
  private Long logId;
  private Long taskId;
  private Integer memberId;
  private String actionType;
  private String processingNote;
  private LocalDateTime createdAt;
  private LocalDateTime updatedAt;
}
/*
create table `bank`.`task_processing_log`
        (
log_id          bigint auto_increment primary key,
task_id         bigint                               not null,
member_id       int unsigned                         not null,
action_type     varchar(50)                          not null, -- 'START_PROCESSING', 'ADD_NOTE', 'COMPLETE', 'TRANSFER'
processing_note text                                 null,     -- 행원이 작성한 상담 내용 및 메모
created_at      datetime   default CURRENT_TIMESTAMP not null,
constraint fk_log_task foreign key (task_id) references task (task_id),
constraint fk_log_member foreign key (member_id) references member (id)
        );
*/
