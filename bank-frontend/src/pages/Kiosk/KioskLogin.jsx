import React, { useState, useEffect } from 'react';
import styles from './Kiosk.module.css';
import CustomModal from '../../components/common/CustomModal';

const KioskLogin = ({ formData, setFormData, onNext, onPrev }) => {
    // 서버 전송 중 버튼 중복 클릭 방지를 위한 상태
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMessage, setModalMessage] = useState('');
    
    // 컴포넌트가 마운트될 때 ssn을 빈 문자열로 초기화
    useEffect(() => {
        setFormData(prev => ({ ...prev, ssn: '' }));
    }, [setFormData]);

    // 키패드 클릭 핸들러
    const handleKeyPress = (num) => {
        if (formData.ssn.length < 13) {
            setFormData(prev => ({ ...prev, ssn: prev.ssn + num }));
        }
    };

    // 지우기 핸들러
    const handleDelete = () => {
        setFormData(prev => ({ ...prev, ssn: prev.ssn.slice(0, -1) }));
    };

    // 💡 수정된 부분: 확인 버튼 (서버로 데이터 전송)
    const handleConfirm = async () => {
        if (formData.ssn.length === 13) {
            try {
                setIsSubmitting(true); // 로딩 시작

                // 쿼리 파라미터로 residentNumber 전송
                const response = await fetch('/api/user/kiosk/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ residentNumber: formData.ssn })
                });

                if (response.ok) {
                    const data = await response.json();
                    console.log("로그인 응답 데이터:", data); // 확인용 로그

                    switch (data.result) {
                        case 'SUCCESS':
                            // 키오스크는 세션리스로 동작하므로 로그인 응답의 userId/userName을 직접 사용한다.
                            setFormData(prev => ({ ...prev, userName: data.userName, userId: data.userId }));
                            setModalMessage('고객정보가 확인되었습니다.\n접수 화면으로 넘어갑니다.');
                            setIsModalOpen(true);
                            break;
                            
                        case 'FAILURE_NOT_ALLOWED':
                            setModalMessage('유효하지않은 사용자입니다.\n접근을 거부합니다.');
                            setIsModalOpen(true);
                            setFormData(prev => ({ ...prev, ssn: '' }));
                            break;
                            
                        case 'FAILURE':
                        default:
                            setModalMessage('일치하는 고객 정보가 없습니다.\n다시 확인해주세요.');
                            setIsModalOpen(true);
                            setFormData(prev => ({ ...prev, ssn: '' }));
                            break;
                    }
                } else {
                    setModalMessage('서버 오류가 발생했습니다.');
                    setIsModalOpen(true);
                    setFormData(prev => ({ ...prev, ssn: '' }));
                }
            } catch (error) {
                console.error('로그인 API 통신 에러:', error);
                setModalMessage('서버와 통신 중 오류가 발생했습니다.\n잠시 후 다시 시도해주세요.');
                setIsModalOpen(true);
                setFormData(prev => ({ ...prev, ssn: '' }));
            } finally {
                setIsSubmitting(false); // 로딩 종료
            }
        } else {
            alert('주민번호 13자리를 모두 입력해주세요.');
        }
    };

    // 모달 확인 버튼 핸들러
    const handleModalConfirm = () => {
        setIsModalOpen(false);
        // 성공 메시지일 때만 다음 단계로 이동
        if (modalMessage.includes('고객정보가 확인되었습니다.')) {
            onNext();
        }
    };

    return (
        <div className={styles.loginArea}>
            <div className={styles.progressIndicator}>
                <div className={styles.step}></div>
                <div className={`${styles.step} ${styles.active}`}></div>
                <div className={styles.step}></div>
                <div className={styles.step}></div>
                <div className={styles.step}></div>
            </div>

            <div className={styles.loginHeader}>
                <h2 className={styles.loginTitle}>로그인</h2>
                <p className={styles.loginSubtitle}>주민번호 13자리를 입력해주세요</p>
            </div>

            {/* 주민번호 입력 박스 영역 */}
            <div className={styles.ssnContainer}>
                {[...Array(6)].map((_, i) => (
                    <div key={`front-${i}`} className={styles.ssnBox}>
                        {formData.ssn[i] || ''}
                    </div>
                ))}
                <span className={styles.dash}>-</span>
                {[...Array(7)].map((_, i) => {
                    const value = formData.ssn[i + 6];
                    const isMasked = i > 0 && value;
                    return (
                        <div key={`back-${i}`} className={styles.ssnBox}>
                            {isMasked ? '●' : (value || '')}
                        </div>
                    );
                })}
            </div>

            {/* 키패드 영역 */}
            <div className={styles.keypad}>
                {[7, 8, 9, 4, 5, 6, 1, 2, 3].map(num => (
                    <button
                        key={num}
                        className={styles.keypadBtn}
                        onClick={() => handleKeyPress(num)}
                        disabled={isSubmitting} // 전송 중일 때 버튼 비활성화
                    >
                        {num}
                    </button>
                ))}
                <button className={styles.keypadBtn} onClick={handleDelete} disabled={isSubmitting}>지우기</button>
                <button className={styles.keypadBtn} onClick={() => handleKeyPress(0)} disabled={isSubmitting}>0</button>
                <button
                    className={styles.keypadBtn}
                    onClick={handleConfirm}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? '확인 중..' : '확인'}
                </button>
            </div>

            <button className={styles.prevButton} onClick={onPrev} disabled={isSubmitting}>
                ← 이전으로
            </button>

            {/* CustomModal 추가 */}
            <CustomModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                title="안내"
                onConfirm={handleModalConfirm}
                confirmText="확인"
            >
                <div style={{ padding: '20px', textAlign: 'center', fontSize: '1.2rem', color: '#333', whiteSpace: 'pre-line', lineHeight: '1.5' }}>
                    {modalMessage}
                </div>
            </CustomModal>
        </div>
    );
};

export default KioskLogin;
