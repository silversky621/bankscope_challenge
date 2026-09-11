import React, { useState, useEffect, useCallback } from 'react';
import { useModal } from '../../context/ModalContext';
import styles from './CorporateBankrupt.module.css';

const CorporateBankrupt = ({ onReturnToTaskSelect, onComplete, selectedTask }) => {
    const { openModal } = useModal();
    const [isLoaded, setIsLoaded] = useState(false);

    const showAlert = useCallback((message, onConfirm = null) => {
        openModal({
            message: message,
            onConfirm: onConfirm
        });
    }, [openModal]);

    const [formData, setFormData] = useState({
        companyName: '',
        businessNumber: '',
        bankruptDate: new Date().toISOString().split('T')[0], // 기본값 오늘
        reason: '지급불능',
        riskLevel: '미측정', // 백엔드의 riskGrade와 매칭
        description: '',
        loanId: null
    });
    const userId = selectedTask?.userId;

    useEffect(() => {
        if (!userId) return;

        const fetchInitialData = async () => {
            try {
                const [userRes] = await Promise.all([
                    fetch(`/api/user/info?userId=${userId}`),
                ]);

                const userData = await userRes.json();
                if (userData.result === 'SUCCESS') {
                    const { user } = userData;
                    if (user.userType !== 'corporate') {
                        showAlert("개인회원은 이 탭에 접근할 수 없습니다.", onComplete);
                        return;
                    }

                } else { throw new Error('사용자 정보 조회 실패'); }

            } catch (error) {
                console.error("초기 데이터 조회 실패:", error);
                showAlert("데이터를 불러오는 중 오류가 발생했습니다.", onReturnToTaskSelect);
            }
        };

        fetchInitialData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    // 1. 컴포넌트 로드 시 위험 진단 및 기업 정보 조회
    useEffect(() => {
        const fetchRiskStatus = async () => {
            const userId = selectedTask?.userId;
            if (!userId) {
                showAlert("유효하지 않은 요청입니다. (User ID 누락)", onReturnToTaskSelect);
                return;
            }

            try {
                // 진단 API 호출
                const response = await fetch(`/api/corporate/risk-status?userId=${userId}`);
                const result = await response.json();

                if (response.ok && result.result === 'SUCCESS') {
                    const data = result.data;
                    const firstLoanId = data.loanDetails && data.loanDetails.length > 0
                        ? data.loanDetails[0].loanId
                        : null;
                    setFormData(prev => ({
                        ...prev,
                        companyName: data.companyName,
                        businessNumber: data.businessNumber,
                        riskLevel: data.riskGrade, // "E (고위험)" 등의 값 반영
                        loanId: firstLoanId
                    }));
                    setIsLoaded(true);
                } else {
                    showAlert(result.message || "기업 위험 정보를 불러오지 못했습니다.", onReturnToTaskSelect);
                }
            } catch (error) {
                console.error("Risk Status Fetch Error:", error);
                showAlert("서버 통신 중 오류가 발생했습니다.", onReturnToTaskSelect);
            }
        };

        fetchRiskStatus();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedTask]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // 2. 부도 확정 처리 로직
    const handleSubmit = () => {
        const userId = selectedTask?.userId;

        openModal({
            title: "부도 확정 경고",
            message: `[${formData.companyName}] 법인의 부도 처리를 확정하시겠습니까?\n이 작업은 되돌릴 수 없으며 모든 계좌 잔액이 상계 처리됩니다.`,
            confirmText: "부도 확정",
            cancelText: "취소",
            onConfirm: async () => {
                try {
                    // 백엔드 CorporateManagementDto 규격에 맞춘 payload
                    const formattedDate = formData.bankruptDate + "T00:00:00";
                    const payload = {
                        userId: userId,
                        riskGrade: formData.riskLevel, // DTO: riskGrade
                        defaultDate: formattedDate, // DTO: defaultDate
                        reason: formData.reason,
                        description: formData.description,
                        loanId: formData.loanId || selectedTask?.loanId,
                    };

                    const response = await fetch('/api/corporate/bankruptcy', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    const result = await response.json();

                    if (response.ok && result.result === "SUCCESS") {
                        showAlert("부도 확정 및 강제 상계 처리가 완료되었습니다.", () => {
                            if (onComplete) onComplete(result.data);
                        });
                    } else {
                        showAlert(/*result.message || */"부도 처리 중 오류가 발생했습니다.");
                    }
                } catch (error) {
                    console.error("Bankruptcy Submit Error:", error);
                    showAlert("서버와 통신 중 오류가 발생했습니다.");
                }
            }
        });
    };

    if (!isLoaded) return null; // 데이터 로딩 전에는 렌더링 방지
    const getRiskClass = (riskLevel) => {
        if (riskLevel.includes('E')) return styles.riskE;
        if (riskLevel.includes('D')) return styles.riskD;
        if (riskLevel.includes('C')) return styles.riskC;
        if (riskLevel.includes('B')) return styles.riskB;
        if (riskLevel.includes('A')) return styles.riskA;

        return styles.riskDefault;
    };
    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                <h1 className={styles.headerTitle}>부도 관리 심사</h1>
                {/* API에서 받아온 실시간 위험 등급 표시 */}
                <div className={`${styles.riskBadge} ${getRiskClass(formData.riskLevel)}`}>
                    {formData.riskLevel}
                </div>
            </header>

            <div className={styles.formContainer}>
                <div className={styles.section}>
                    <div className={styles.labelRow}>
                        <span className={styles.centerLabel}>법인 정보</span>
                    </div>
                    <div className={styles.inputRow}>
                        <div className={styles.customSelectFull}>
                            <input
                                type="text"
                                className={styles.inputField}
                                value={`법인명: ${formData.companyName}`}
                                readOnly
                            />
                        </div>
                        <div className={styles.customSelectFull}>
                            <input
                                type="text"
                                className={styles.inputField}
                                value={`사업자번호: ${formData.businessNumber}`}
                                readOnly
                            />
                        </div>
                    </div>
                </div>

                <div className={styles.section}>
                    <div className={styles.gridTwo}>
                        <div className={styles.inputGroup}>
                            <label className={styles.centerLabel}>부도 발생일</label>
                            <div className={styles.customSelectFull}>
                                <input
                                    type="date"
                                    name="bankruptDate"
                                    className={styles.inputField}
                                    value={formData.bankruptDate}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        <div className={styles.inputGroup}>
                            <label className={styles.centerLabel}>부도 사유</label>
                            <div className={styles.customSelectFull}>
                                <select
                                    name="reason"
                                    className={styles.selectField}
                                    value={formData.reason}
                                    onChange={handleChange}
                                >
                                    <option value="지급불능">지급불능 (Cash Flow)</option>
                                    <option value="채무초과">채무초과 (Insolvency)</option>
                                    <option value="당좌거래정지">당좌거래정지</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <div className={styles.section}>
                    <div className={styles.labelRow}>
                        <span className={styles.centerLabel}>상세 경위</span>
                    </div>
                    <div className={styles.textareaBox}>
                        <textarea
                            name="description"
                            className={styles.textareaField}
                            placeholder="부도 확정 사유 및 상세 경위를 입력하세요."
                            value={formData.description}
                            onChange={handleChange}
                        />
                    </div>
                </div>

                <div className={styles.buttonRow}>
                    <button className={styles.btnSubmit} onClick={handleSubmit}>부도 확정 처리</button>
                </div>
            </div>
        </div>
    );
};

export default CorporateBankrupt;
