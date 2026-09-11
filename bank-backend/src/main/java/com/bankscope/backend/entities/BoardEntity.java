package com.bankscope.backend.entities;

import lombok.*;
import org.springframework.cglib.core.Local;

import java.time.LocalDateTime;


@Builder
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = "boardId")
public class BoardEntity {
    private Integer boardId;
    private Integer userId;
    private String boardType;
    private String title;
    private String content;
    private int viewCount;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
/*
create table `bank`.`board`
        (
board_id   int unsigned not null auto_increment primary key,
user_id  int unsigned not null, -- 작성자 (최고관리자)
board_type VARCHAR(20) not null,
title      varchar(200) not null,
content    text         not null,
view_count int default 0 not null,         -- 조회수
created_at datetime default CURRENT_TIMESTAMP not null,
updated_at datetime default CURRENT_TIMESTAMP on update CURRENT_TIMESTAMP not null,
constraint foreign key (user_id) references user (id) on delete cascade
);
*/
