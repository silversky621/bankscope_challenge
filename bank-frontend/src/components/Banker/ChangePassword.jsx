import React, { useState, useEffect, useCallback } from 'react';
import { useModal } from '../../context/ModalContext';
import styles from './ChangePassword.module.css';

const ChangePassword = ({ onComplete, selectedTask }) => {
    const { openModal } = useModal();

    const [accounts, setAccounts] = useState([]);
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const showAlert = useCallback((message, onConfirm = null) => {
        openModal({
            message: message,
            onConfirm: onConfirm
        });
    }, [openModal]);

    // 💡 1. 특정 유저의 출금 계좌 목록 불러오기
    useEffect(() => {
        const fetchUserAccounts = async () => {
            if (!selectedTask || !selectedTask.userId) {
                setAccounts([]);
                setSelectedAccountId('');
                return;
            }
            try {
                const response = await fetch(`/api/account/user/${selectedTask.userId}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.result === 'SUCCESS') {
                        // DEPOSIT 타입 계좌만 필터링
                        const depositAccounts = data.accounts.filter(acc => acc.accountType === 'CHECKING' || acc.accountType === 'DEPOSIT');
                        setAccounts(depositAccounts);
                        if (depositAccounts.length > 0) {
                            setSelectedAccountId(depositAccounts[0].accountId.toString()); // 첫 번째 계좌 자동 선택
                        } else {
                            setSelectedAccountId('');
                        }
                    } else {
                        console.error(`계좌 목록 불러오기 실패: ${data.result}`);
                        setAccounts([]);
                        setSelectedAccountId('');
                    }
                } else {
                    console.error('서버 응답 오류로 계좌 목록을 불러오지 못했습니다.');
                    setAccounts([]);
                    setSelectedAccountId('');
                }
            } catch (error) {
                console.error("Error fetching accounts:", error);
                setAccounts([]);
                setSelectedAccountId('');
            }
        };
        fetchUserAccounts();
    }, [selectedTask, showAlert]);


    const handlePwChange = (e, setter) => {
        const value = e.target.value.replace(/[^0-9]/g, "").slice(0, 4);
        setter(value);
    };

    // 💡 1. 새 비밀번호끼리 일치하는지 (4자리)
    const isMatch = newPassword === confirmPassword;

    // 💡 2. [추가] 기존 비밀번호와 새 비밀번호가 다른지 체크
    const isDifferent = oldPassword !== newPassword;

    // 💡 3. 최종 제출 조건: (새 비번 일치) AND (기존과 다름) AND (기존비번 4자리) AND (새비번 4자리) AND (계좌 선택됨)
    const canSubmit = isMatch && isDifferent && oldPassword.length === 4 && newPassword.length === 4 && selectedAccountId !== '';

    const handleSubmit = () => {
        if (!canSubmit) return;

        openModal({
            title: "비밀번호 변경 확인",
            message: "선택하신 계좌의 비밀번호를 변경하시겠습니까?",
            confirmText: "변경",
            cancelText: "취소",
            onConfirm: async () => {
                try {
                    // API 요구사항에 맞춰 URLSearchParams로 데이터 구성
                    const params = new URLSearchParams();
                    params.append('accountId', selectedAccountId);
                    params.append('oldPassword', oldPassword);
                    params.append('newPassword', newPassword);

                    const response = await fetch('/api/account/account-password', {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        },
                        body: params.toString()
                    });

                    if (response.ok) {
                        const data = await response.json();
                        if (data.result === 'SUCCESS') {
                            // 변경 성공 알림 후, 사용자가 확인 버튼을 누르면 onComplete 실행
                            openModal({
                                title: "변경 완료",
                                message: "비밀번호가 정상적으로 변경되었습니다.",
                                confirmText: "확인",
                                onConfirm: async () => {
                                    if (onComplete) {
                                        await onComplete();
                                    }
                                }
                            });
                        } else {
                            openModal({
                                title: "변경 실패",
                                message: `비밀번호 변경에 실패했습니다: ${data.message || data.result}`,
                                confirmText: "확인"
                            });
                        }
                    } else {
                        openModal({
                            title: "서버 오류",
                            message: "서버 응답 오류로 비밀번호 변경에 실패했습니다.",
                            confirmText: "확인"
                        });
                    }
                } catch (error) {
                    console.error("Error changing password:", error);
                    openModal({
                        title: "네트워크 오류",
                        message: "네트워크 오류가 발생했습니다.",
                        confirmText: "확인"
                    });
                }
            }
        });
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="11" width="20" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                <h1 className={styles.headerTitle}>통장 비밀번호 변경</h1>
            </header>

            <div className={styles.formContainer}>
                {/* 1. 대상 계좌 선택 섹션 */}
                <div className={styles.section}>
                    <div className={styles.labelRow}>
                        <span className={styles.centerLabel}>대상 계좌 선택</span>
                    </div>
                    <div className={styles.inputRow}>
                        <div className={styles.customSelectFull}>
                            <select
                                className={styles.selectField}
                                value={selectedAccountId}
                                onChange={(e) => setSelectedAccountId(e.target.value)}
                            >
                                {accounts.length > 0 ? (
                                    accounts.map(account => (
                                        <option key={account.accountId} value={account.accountId.toString()}>
                                            {account.productName} {account.accountNumber}
                                        </option>
                                    ))
                                ) : (
                                    <option value="">계좌 없음</option>
                                )}
                            </select>
                        </div>
                    </div>
                </div>

                {/* 2. 비밀번호 변경 폼 섹션 */}
                <div className={styles.section}>
                    <div className={styles.gridTwo}>
                        <div className={styles.inputGroup}>
                            <label className={styles.centerLabel}>기존 비밀번호</label>
                            <div className={styles.customSelectFull}>
                                <input
                                    type="password"
                                    className={styles.inputField}
                                    value={oldPassword}
                                    onChange={(e) => handlePwChange(e, setOldPassword)}
                                    placeholder="••••"
                                    inputMode="numeric"
                                />
                            </div>
                        </div>

                        <div className={styles.inputGroup}>
                            <label className={styles.centerLabel}>새 비밀번호</label>
                            <div className={styles.customSelectFull}>
                                <input
                                    type="password"
                                    className={styles.inputField}
                                    value={newPassword}
                                    onChange={(e) => handlePwChange(e, setNewPassword)}
                                    placeholder="••••"
                                    inputMode="numeric"
                                />
                            </div>
                        </div>

                        <div className={styles.inputGroup} style={{ gridColumn: 'span 2' }}>
                            <label className={styles.centerLabel}>비밀번호 확인</label>
                            <div className={styles.customSelectFull}>
                                <input
                                    type="password"
                                    className={styles.inputField}
                                    value={confirmPassword}
                                    onChange={(e) => handlePwChange(e, setConfirmPassword)}
                                    placeholder="••••"
                                    inputMode="numeric"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. 유효성 검사 메시지 섹션 */}
                {confirmPassword.length > 0 && (
                    <div className={styles.statusBox}>
                        <div className={`${styles.messageBox} ${isMatch ? (isDifferent ? styles.successBox : styles.errorBox) : styles.errorBox}`}>
                            <span className={styles.messageText}>
                                {!isMatch ? "새 비밀번호 불일치" : !isDifferent ? "기존 비번과 동일함" : (newPassword.length !== 4 ? "새 비밀번호 4자리 입력 필요" : "변경 가능")}
                            </span>
                        </div>
                    </div>
                )}

                {/* 4. 하단 버튼 영역 */}
                <div className={styles.buttonRow}>
                    <button
                        className={styles.btnSubmit}
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                    >
                        변경 확정
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChangePassword;
