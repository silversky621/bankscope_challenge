import React, {useState, useEffect, useCallback} from 'react';
import styles from './TossModal.module.css';
import { useModal } from '../../context/ModalContext';
import { useAuth } from '../../context/AuthContext'; // useAuth 추가

const TossModal = ({ onClose, task }) => {
    const [isListOpen, setIsListOpen] = useState(false);
    const { openModal } = useModal();
    const { user } = useAuth(); // 로그인된 사용자 정보 가져오기
    const [selectedStaff, setSelectedStaff] = useState(null);
    const [staffList, setStaffList] = useState([]);


    const showAlert = useCallback((message, onConfirm = null) => {
        openModal({
            message: message,
            onConfirm: onConfirm
        });
    }, [openModal]);

    useEffect(() => {
        const fetchMembers = async () => {
            try {
                const response = await fetch('/api/user/members');
                if (response.ok) {
                    const data = await response.json();
                    
                    // 더미데이터 형식으로 변환하되, 로그인한 본인(user.id)은 제외
                    const formattedData = data
                        .filter(member => member.id !== user?.id) // 자기 자신 제외 필터링
                        .map(member => ({
                            id: member.id,
                            name: member.name,
                            counter: member.counterNumber ? `${member.counterNumber}번 창구` : '미배정 창구',
                            dept: member.team || '소속 없음',
                            waiting: 0, // 대기 인원은 현재 API 응답에 없으므로 기본값 0 처리 (필요시 수정)
                            initial: member.name ? member.name.charAt(0) : '직' 
                        }));
                    
                    setStaffList(formattedData);
                } else {
                    showAlert("멤버 목록 조회 실패")
                }
            } catch (error) {
                console.error("멤버 목록 조회 에러:", error);
                showAlert("서버 통신 중 오류가 발생했습니다.");
            }
        };

        // user 정보가 있을 때만 멤버 목록을 가져오도록 (선택 사항)
        if (user) {
            fetchMembers();
        }
    }, [user, showAlert]); // user 의존성 추가

    const handleToss = async () => {
        if (!selectedStaff || !task) return;

        const targetMemberId = selectedStaff.id;
        const taskId = task.id || task.taskId; // task 객체 구조에 따라 적절한 id 사용

        if (!taskId) {
            showAlert("업무 정보(taskId)를 찾을 수 없습니다.");
            return;
        }

        try {
            const response = await fetch(`/api/kiosk/toss?taskId=${taskId}&targetMemberId=${targetMemberId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (response.ok && data.result === 'SUCCESS') {
                showAlert(`${selectedStaff.name}님에게 이관이 완료되었습니다.`, () => {
                    onClose(); // 이관 성공 시 모달 닫기
                    window.location.reload();
                });
            } else if (data.result === 'FAILURE_SESSION') {
                showAlert('세션이 만료되었습니다. 다시 로그인해주세요.');
            } else {
                showAlert(`이관 실패: ${data.result}`);
            }

        } catch (error) {
            console.error("이관 처리 에러:", error);
            showAlert("서버 통신 중 오류가 발생했습니다.");
        }
    };


    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
                <header className={styles.header}>
                    <h1>창구 이관</h1>
                </header>

                <div className={styles.content}>
                    <div className={styles.customerCard}>
                        <div className={styles.customerName}>
                            <strong>{task?.userName || '고객명'}</strong>
                            {task?.ticketNumber && <small>{task.ticketNumber}</small>}
                        </div>
                    </div>

                    <div className={styles.section}>
                        <label className={styles.label}>이관 직원 대상</label>
                        <div
                            className={styles.selectTrigger}
                            onClick={() => setIsListOpen(!isListOpen)}
                        >
                            <span>
                                {selectedStaff
                                    ? `${selectedStaff.name} (${selectedStaff.dept})`
                                    : '직원을 선택해주세요'}
                            </span>
                            <span className={styles.arrow}>{isListOpen ? '▲' : '▼'}</span>
                        </div>

                        {isListOpen && (
                            <div className={styles.staffList}>
                                {staffList.map((staff) => (
                                    <div
                                        key={staff.id}
                                        className={styles.staffItem}
                                        onClick={() => {
                                            setSelectedStaff(staff);
                                            setIsListOpen(false);
                                        }}
                                    >
                                        <div className={styles.avatar}>{staff.initial}</div>
                                        <div className={styles.staffInfo}>
                                            <strong>{staff.name}</strong> {staff.counter} {staff.dept}
                                            {/*<span className={styles.waiting}>대기 {staff.waiting}건</span>*/}
                                        </div>
                                    </div>
                                ))}
                                {staffList.length === 0 && (
                                    <div style={{ padding: '10px', textAlign: 'center', color: '#888' }}>조회된 직원이 없습니다.</div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <footer className={styles.footer}>
                    <button className={styles.btnClose} onClick={onClose}>닫기</button>
                    <button
                        className={styles.btnSubmit}
                        disabled={!selectedStaff}
                        onClick={handleToss}
                    >
                        이관 실행
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default TossModal;
