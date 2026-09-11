import React, { useState, useEffect, useRef } from 'react';
import styles from './Kiosk.module.css';
import {useModal} from "../../context/ModalContext.jsx";

const KioskComplete = ({ formData, onGoHome, /*onAddMore,*/ userName, isAiMode }) => {
    const { openModal } = useModal();

    const [ticketInfo, setTicketInfo] = useState({
        ticketNumber: '',
        level: '',
        counter: '',
        taskType: '',
        taskDetailType: ''
    });
    const [isLoading, setIsLoading] = useState(true);
    const isSubmitted = useRef(false); // 중복 호출 방지용 ref

    useEffect(() => {
        if (isSubmitted.current) return;
        isSubmitted.current = true;

        const submitFormData = async () => {
            try {
                let response;

                if (isAiMode) {
                    const payload = {
                        user_id: formData.userId
                    };
                    
                    response = await fetch('/py/auto-insert-task', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(payload),
                    });
                } else {
                    response = await fetch('/api/kiosk/task', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            userId: formData.userId,
                            taskType: formData.taskType,
                            taskDetailType: formData.task
                        }),
                    });
                }

                if (response.ok) {
                    const data = await response.json();
                    
                    switch (data.result) {
                        case 'SUCCESS': {
                            let task;
                            if (isAiMode) {
                                task = data.taskResult;
                            } else {
                                // 직접 접수 성공 시, /api/kiosk/task 로 다시 조회해서 결과 세팅
                                const checkResponse = await fetch(`/api/kiosk/task?userId=${formData.userId}`);
                                if (checkResponse.ok) {
                                    const checkData = await checkResponse.json();
                                    if (checkData.result === 'SUCCESS') {
                                        task = checkData.task;
                                    } else {
                                        console.error("Failed to get task info:", checkData);
                                        // 실패 시 기본값으로 설정하거나 오류 처리
                                        task = {};
                                    }
                                } else {
                                    task = {};
                                }
                            }

                            // 창구번호는 접수 응답에 이미 포함됨 (AI: counter_number / 직접접수: counterNumber).
                            // 세션리스 키오스크가 권한 필요한 API(/api/user/members)를 2차 조회하지 않도록 응답값을 그대로 사용.
                            const counterNumber = task.counterNumber ?? task.counter_number ?? null;

                            setTicketInfo({
                                ticketNumber: task.ticketNumber || task.ticket_number || '-',
                                level: task.assignedLevel || task.assigned_level || '-',
                                counter: counterNumber ? `${counterNumber}번 창구` : '배정 중',
                                taskType: task.taskType || task.task_type || '-',
                                taskDetailType: task.taskDetailType || task.task_detail_type || '-'
                            });
                            break;
                        }
                        case 'FAILURE_TASK_IN_PROGRESS':
                            openModal({ 
                                title: '알림', 
                                message: '이미 처리중인 업무가 있습니다.',
                                onConfirm: () => onGoHome()
                            });
                            break;
                        case 'FAILURE_SESSION':
                            openModal({ 
                                title: '알림', 
                                message: '세션이 만료되었습니다. 다시 로그인해주세요.',
                                onConfirm: () => onGoHome()
                            });
                            break;
                        case 'FAILURE_TASK_PLURAL':
                            openModal({
                                title: '알림',
                                message: '추가 접수는 불가능합니다.',
                                onConfirm: () => onGoHome()
                            });
                            break;
                        default:
                            openModal({
                                title: '알림', 
                                message: '대기표 발급에 실패했습니다: ' + (data.message || '알 수 없는 오류'),
                                onConfirm: () => onGoHome()
                            });
                            break;
                    }
                } else {
                    openModal({ 
                        title: '알림', 
                        message: '서버 오류 발생',
                        onConfirm: () => onGoHome()
                    });
                }
            } catch (error) {
                console.error('최종 접수 처리 중 에러 발생:', error);
                openModal({ 
                    title: '알림', 
                    message: '접수 처리 중 문제가 발생했습니다. 창구에 문의해주세요.',
                    onConfirm: () => onGoHome()
                });
            } finally {
                setIsLoading(false);
            }
        };

        submitFormData();
    }, [formData, onGoHome, isAiMode, openModal]);

    // 7초 자동 이동 타이머 (버튼을 직접 누르지 않아도 넘어가게 유지)
    useEffect(() => {
        if (!isLoading) {
            const timer = setTimeout(() => {
                onGoHome();
            }, 4000);
            return () => clearTimeout(timer);
        }
    }, [isLoading, onGoHome]);


    const getDisplayTitle = () => {
        if (isLoading) {
            return isAiMode ? "AI 자동 접수 진행 중..." : `${formData.taskType} 접수 진행 중...`;
        }
        
        // 데이터 로드 완료 후
        if (isAiMode) {
            // AI가 무슨 업무로 분류했는지 명확하게 표시
            return `[AI 배정 완료]`;
        } else {
            // 직접 접수한 업무 표시
            return `${formData.taskType} 선택 완료`;
        }
    };

    return (
        <div className={styles.completeArea}>
            <div className={styles.userInfoWrapper}>
                <span className={styles.userBadge}>
                    <span className={styles.badgeText}>본인확인완료</span>
                    <span className={styles.badgeDot}>•</span>
                    <span className={styles.userName}>{userName}님</span>
                </span>
            </div>

            <div className={styles.progressIndicator}>
                <div className={styles.step}></div>
                <div className={styles.step}></div>
                <div className={styles.step}></div>
                <div className={styles.step}></div>
                <div className={`${styles.step} ${styles.active}`}></div>
            </div>

            <div className={styles.completeHeader}>
                <h2 className={styles.completeTitle}>{getDisplayTitle()}</h2>
                <p className={styles.completeSubtitle}>
                    {isLoading ? '고객님의 정보를 서버로 전송하고 있습니다...' : '최적의 담당 창구를 배치 완료했습니다.'}
                </p>
            </div>

            {!isLoading && (
                <>
                    <div className={styles.ticketCard}>
                        <div className={styles.ticketNumber}>{ticketInfo.ticketNumber}</div>

                        <div className={styles.ticketDetails}>
                            <div className={styles.ticketRow}>
                                <span className={styles.ticketLabel}>선택 업무</span>
                                <div className={styles.ticketDashes}></div>
                                <span className={styles.ticketValue}>{ticketInfo.taskType}</span>
                            </div>
                            <div className={styles.ticketRow}>
                                <span className={styles.ticketLabel}>상세 업무</span>
                                <div className={styles.ticketDashes}></div>
                                <span className={styles.ticketValue}>{ticketInfo.taskDetailType}</span>
                            </div>
                            <div className={styles.ticketRow}>
                                <span className={styles.ticketLabel}>배치 레벨</span>
                                <div className={styles.ticketDashes}></div>
                                <span className={styles.ticketValue}>{ticketInfo.level}</span>
                            </div>
                            <div className={styles.ticketRow}>
                                <span className={styles.ticketLabel}>예상 창구</span>
                                <div className={styles.ticketDashes}></div>
                                <span className={styles.ticketValue}>{ticketInfo.counter}</span>
                            </div>
                        </div>
                    </div>

                    <div className={styles.buttonGroup}>
                        <button className={styles.goHomeBtn} onClick={onGoHome}>
                            처음으로 돌아가기
                        </button>
                        {/*<button className={styles.addMoreBtn} onClick={onAddMore}>
                            추가 업무 접수
                        </button>*/}
                    </div>
                </>
            )}
        </div>
    );
};

export default KioskComplete;