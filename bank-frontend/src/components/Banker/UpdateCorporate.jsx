import React, { useState, useEffect, useCallback } from "react";
import styles from './UpdateCorporate.module.css';
import { useModal } from '../../context/ModalContext';

const UpdateCorporate = ({ selectedTask, onComplete }) => {
    const { openModal } = useModal();

    const showAlert = useCallback((message, onConfirm = null) => {
        openModal({
            message: message,
            onConfirm: onConfirm
        });
    }, [openModal]);

    const [customerInfo, setCustomerInfo] = useState(null);
    const [identificationNumber, setIdentificationNumber] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    // 고객 정보 로드
    useEffect(() => {
        const loadCustomerInfo = async () => {
            const userId = selectedTask?.userId;
            if (!userId) {
                setCustomerInfo(null);
                setIsLoading(false);
                return;
            }
            try {
                const response = await fetch(`/api/user/info?userId=${userId}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.result === 'SUCCESS' && data.user) {
                        setCustomerInfo(data.user);
                    } else {
                        setCustomerInfo(null);
                    }
                } else {
                    setCustomerInfo(null);
                }
            } catch (error) {
                console.error("Error fetching customer info:", error);
                setCustomerInfo(null);
            } finally {
                setIsLoading(false);
            }
        };

        loadCustomerInfo();
    }, [selectedTask?.userId]);

    // 사업자 번호 입력 핸들러 (하이픈 처리)
    const handleIdentificationNumberChange = (e) => {
        const value = e.target.value.replace(/[^0-9]/g, ''); // 숫자만 남김
        let formattedValue = '';

        if (value.length <= 3) {
            formattedValue = value;
        } else if (value.length <= 5) {
            formattedValue = `${value.slice(0, 3)}-${value.slice(3)}`;
        } else {
            formattedValue = `${value.slice(0, 3)}-${value.slice(3, 5)}-${value.slice(5, 10)}`;
        }

        setIdentificationNumber(formattedValue);
    };

    // 제출 핸들러
    const handleSubmit = async () => {
        if (!identificationNumber || identificationNumber.replace(/-/g, '').length !== 10) {
            showAlert("유효한 사업자 등록 번호 10자리를 입력해주세요.");
            return;
        }

        const userId = selectedTask?.userId;
        if (!userId) {
            showAlert("고객 정보를 확인할 수 없습니다.");
            return;
        }

        try {
            // 하이픈 제거 후 전송. 사용자 식별은 주민번호 대신 userId로 한다(주민번호 왕복 방지).
            const cleanIdentificationNumber = identificationNumber.replace(/-/g, '');

            const formData = new URLSearchParams();
            formData.append('identificationNumber', cleanIdentificationNumber);
            formData.append('userId', userId);

            const response = await fetch('/api/user/update-corporate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(Object.fromEntries(formData))
            });

            if (response.ok) {
                const data = await response.json();
                if (data.result === 'SUCCESS') {
                    showAlert("법인 전환 처리가 완료되었습니다.", () => {
                        onComplete?.();
                    });
                } else {
                    showAlert(`법인 전환 처리에 실패했습니다. (${data.result})`);
                }
            } else {
                showAlert("서버 응답 오류로 처리에 실패했습니다.");
            }
        } catch (error) {
            console.error("법인 전환 처리 중 에러 발생:", error);
            showAlert("서버와 통신 중 오류가 발생했습니다.");
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.formGrid}>
                {/* 1행: 이름, 주민등록번호 */}
                <div className={styles.inputGroup}>
                    <label>고객명</label>
                    <input 
                        type="text" 
                        value={customerInfo?.name || "고객명 로딩 중..."}
                        disabled 
                        className={styles.input} 
                    />
                </div>

                <div className={styles.inputGroup}>
                    <label>주민등록번호</label>
                    <input 
                        type="text" 
                        value={isLoading ? '로딩 중...' : (customerInfo?.residentNumber || '정보 없음')} 
                        disabled 
                        className={styles.input} 
                    />
                </div>

                {/* 2행: 사업자등록번호 입력 */}
                <div className={styles.inputGroup}>
                    <label>사업자 등록 번호</label>
                    <input 
                        type="text" 
                        value={identificationNumber}
                        onChange={handleIdentificationNumberChange}
                        placeholder="000-00-00000"
                        maxLength="12" // 하이픈 2개 포함 12자리
                        className={styles.input} 
                    />
                </div>

                {/* 3행: 체크리스트 (문서 형태) */}
                <div className={styles.checklistContainer}>
                    <div className={styles.checklistTitle}>
                       법인(개인사업자) 전환 확인 문서
                    </div>
                    <div className={styles.checklistItem}>
                        <span><strong>사업자등록증 확인:</strong> 제출받은 사업자등록증명원의 정보(대표자명, 주민등록번호, 개업일자)가 국세청 조회 결과와 일치하는지 확인하였습니다.</span>
                    </div>
                    <div className={styles.checklistItem}>
                        <span><strong>신분증 대조:</strong> 방문한 고객의 신분증(주민등록증 등)을 통해 본인 확인 및 대표자 본인이 맞는지 확인하였습니다.</span>
                    </div>
                    <div className={styles.checklistItem}>
                        <span><strong>휴폐업 조회:</strong> 국세청 홈택스 또는 행정정보공동이용망을 통해 해당 사업자의 휴업 또는 폐업 상태가 아님을 정상 사업자임을 확인하였습니다.</span>
                    </div>
                    <div className={styles.checklistItem}>
                        <span><strong>정보 일치:</strong> 시스템에 등록될 사업자등록번호가 증빙 서류에 기재된 내용과 정확히 일치함을 재확인하였습니다.</span>
                    </div>
                    <p style={{ marginTop: '15px', fontSize: '0.85rem', color: '#e74c3c', fontWeight: 'bold' }}>
                        ※ 위 사항을 모두 확인하였으며, 허위 정보 등록 시 법적 책임이 따를 수 있음을 안내하였습니다.
                    </p>
                </div>
            </div>

            <div className={styles.accountBtnRow}>
                <button 
                    className={styles.btnCreate} 
                    onClick={handleSubmit}
                    disabled={isLoading || !customerInfo?.residentNumber}
                >
                    법인 전환 (등록)
                </button>
            </div>
        </div>
    );
};

export default UpdateCorporate;
