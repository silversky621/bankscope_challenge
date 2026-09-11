/**
 * 행원 업무 배정 정보 목록을 조회합니다.
 * @returns {Promise<Array>} 업무 객체 배열 반환
 */
export const fetchAssignedTask = async () => {
    const response = await fetch('/api/member/task', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch assigned tasks: ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
};

/**
 * 특정 고객(userId)의 업무 처리 로그 목록을 조회합니다.
 * @param {number|string} userId 조회할 고객의 ID
 * @returns {Promise<Array>} 로그 객체 배열 반환
 */
export const fetchTaskProcessingLogs = async (userId) => {

    const url = `/api/task-processing-log/?userId=${userId}`;

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    });


    if (!response.ok) {
        throw new Error(`Failed to fetch task processing logs: ${response.status}`);
    }

    const data = await response.json();

    // 💡 백엔드 응답이 { result: "SUCCESS", taskLogs: [...] } 형태이므로, data.taskLogs를 반환하도록 수정
    if (data.taskLogs && Array.isArray(data.taskLogs)) {
        return data.taskLogs;
    }
    return Array.isArray(data) ? data : [];
};
