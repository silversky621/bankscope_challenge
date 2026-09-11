import React, { useState, useEffect } from 'react';
import styles from './Deposit.module.css';
import { useModal } from '../../context/ModalContext';

const Deposit = ({ taskId, selectedTask, onSuccess }) => {
    const { openModal } = useModal();
    const [accounts, setAccounts] = useState([]); 
    const [isLoading, setIsLoading] = useState(true);
    const [formData, setFormData] = useState({
        myAccount: '', 
        password: '',
        confirmPassword: '',
        amount: '',
        description: '입금'
    });

    
    useEffect(() => {
        const fetchUserAccounts = async () => {
            const userId = selectedTask?.userId; 
            
            if (userId) {
                try {
                    const response = await fetch(`/api/account/user/${userId}`);
                    if (response.ok) {
                        const rawData = await response.json();
                        
                        const data = Array.isArray(rawData) ? rawData : rawData.accounts || [];
                        setAccounts(data);
                        
                        if (data.length > 0) {
                            setFormData(prev => ({ 
                                ...prev, 
                                myAccount: data[0].accountNumber || data[0].accountNum 
                            }));
                        }
                    }
                } catch (error) {
                    console.error("입금 계좌 목록 로드 에러:", error);
                } finally {
                    setIsLoading(false);
                }
            } else {
                setIsLoading(false);
            }
        };

        fetchUserAccounts();
    }, [selectedTask]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleDepositSubmit = async () => {
        const numericAmount = parseInt(String(formData.amount).replace(/,/g, ''), 10);

        if (!formData.myAccount) {
            openModal({ title: '알림', message: '입금 계좌를 정확히 입력해주세요.' });
            return;
        }
        if (!numericAmount || numericAmount <= 0) {
            openModal({ title: '알림', message: '올바른 입금 금액을 입력해주세요.' });
            return;
        }
        if (!formData.password) {
            openModal({ title: '알림', message: '계좌 비밀번호를 입력해주세요.' });
            return;
        }

        const queryParams = new URLSearchParams({
            accountNumber: formData.myAccount,
            amount: numericAmount,
            description: formData.description,
            taskId: taskId || 0
        }).toString();

        try {
            const response = await fetch('/api/transaction/deposit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(Object.fromEntries(new URLSearchParams(queryParams)))
            });

            if (response.ok) {
                openModal({ 
                    title: '입금 완료', 
                    message: `입금이 완료되었습니다!`,
                    onConfirm: async () => {
                        if (onSuccess) {
                            await onSuccess();
                        }
                    }
                });
            } else {
                const errorData = await response.json().catch(() => ({}));
                console.error("서버 에러 응답:", errorData);
                openModal({ 
                    title: '입금 실패', 
                    message: errorData.message || '정보를 다시 확인해주세요.' 
                });
            }
        } catch (error) {
            console.error("네트워크 에러:", error);
            openModal({ title: '오류', message: '서버 통신 중 에러가 발생했습니다.' });
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="5" width="20" height="14" rx="2" />
                    <line x1="2" y1="10" x2="22" y2="10" />
                </svg>
                <h1 className={styles.headerTitle}>입금 업무</h1>
            </header>

            <div className={styles.formContainer}>
                {/* 1. 입금 계좌 선택 섹션 */}
                <div className={styles.section}>
                    <div className={styles.labelRow}>
                        <span className={styles.centerLabel}>입금 계좌 선택</span>
                    </div>
                    <div className={styles.inputRow}>
                        <div className={styles.customSelectFull}>
                            {isLoading ? (
                                <input type="text" placeholder="계좌 정보를 조회 중입니다..." readOnly className={styles.inputField} />
                            ) : accounts.length > 0 ? (
                                <select 
                                    name="myAccount" 
                                    value={formData.myAccount} 
                                    onChange={handleChange}
                                    className={styles.selectField}
                                    style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd' }}
                                >
                                    {accounts.map((acc, index) => (
                                        <option key={index} value={acc.accountNumber || acc.accountNum}>
                                            {acc.accountNumber || acc.accountNum} ({acc.accountName || '일반예금'} ){` ( 잔액: ${acc.balance}원)`}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <input 
                                    name="myAccount" 
                                    type="text" 
                                    placeholder="직접 계좌번호를 입력하세요" 
                                    value={formData.myAccount} 
                                    onChange={handleChange} 
                                    className={styles.inputField} 
                                />
                            )}
                        </div>
                    </div>
                </div>

                {/* 2. 비밀번호 섹션 */}
                <div className={styles.section}>
                    <div className={styles.gridTwo}>
                        <div className={styles.inputGroup}>
                            <label className={styles.centerLabel}>비밀번호</label>
                            <div className={styles.inputFieldBox}>
                                <input 
                                    name="password" 
                                    type="password" 
                                    placeholder="●●●●"
                                    value={formData.password} 
                                    onChange={handleChange} 
                                    className={styles.inputField}
                                />
                            </div>
                        </div>
                        <div className={styles.inputGroup}>
                            <label className={styles.centerLabel}>비밀번호 확인</label>
                            <div className={styles.inputFieldBox}>
                                <input 
                                    name="confirmPassword" 
                                    type="password" 
                                    placeholder="●●●●"
                                    value={formData.confirmPassword} 
                                    onChange={handleChange} 
                                    className={styles.inputField}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. 금액 섹션 */}
                <div className={styles.section}>
                    <div className={styles.labelRow}><span className={styles.centerLabel}>입금 금액</span></div>
                    <div className={styles.amountFieldBox}>
                        <input 
                            name="amount" 
                            type="text" 
                            placeholder="0"
                            value={formData.amount} 
                            onChange={handleChange} 
                            className={styles.inputField}
                        />
                        <span className={styles.unit}>원</span>
                    </div>
                </div>

                <div className={styles.buttonRow}>
                    <button className={styles.btnSubmit} onClick={handleDepositSubmit}>입금 실행</button>
                </div>
            </div>
        </div>
    );
};

export default Deposit;
