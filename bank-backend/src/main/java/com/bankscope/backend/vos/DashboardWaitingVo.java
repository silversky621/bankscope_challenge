
package com.bankscope.backend.vos;

import lombok.Data;

@Data
public class DashboardWaitingVo {
    private Long taskId;           // '이관 변경' 버튼 클릭 시 식별하기 위한 ID
    private String ticketNumber;   // 대기번호 (A-047)
    private String userName;       // 고객명 (홍길동)
    private String taskType;       // 업무 (통장정리)
    private Integer memberId;      // 배정된 직원 ID
    private String memberName;     // 배정된 창구 직원 (김민지)
    private Integer counterNumber; // 창구 번호 (1번 창구)
    private String status;         // 현재 상태 (상태값에 따라 불빛 색상 제어용)
    private String taskDetailType;
}