import React, {useState, useEffect, useCallback} from 'react';
import styles from './LoanPayment.module.css';
import loansIcon from '../../images/Home/Loans.png';

import { useModal } from '../../context/ModalContext';


const LoanPayment = ({ onCreate, selectedTask }) => {
    const [loans, setLoans] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [selectedLoan, setSelectedLoan] = useState(null);
    const [selectedAccount, setSelectedAccount] = useState(null);
    // 💡 1. 상환 방식 상태 추가 (기본값: SCHEDULED)
    const [repayType, setRepayType] = useState('SCHEDULED'); 

    const [formData, setFormData] = useState({
        password: '',
        passwordConfirm: '',
        amount: '',
    });

    const { openModal } = useModal();

    const showAlert = useCallback((message, onConfirm = null) => {
        openModal({
            message: message,
            onConfirm: onConfirm
        });
    }, [openModal]);


    useEffect(() => {
        const fetchLoansAndAccounts = async () => {
            const userId = selectedTask?.userId;
            if (!userId) return;

            try {
                const [loanResponse, accountResponse] = await Promise.all([
                    fetch(`/api/loan/user?userId=${userId}`),
                    fetch(`/api/account/user/${userId}`)
                ]);

                const loanData = await loanResponse.json();
                const accountData = await accountResponse.json();

                if (loanData.result === "SUCCESS" && loanData.loans) {
                    setLoans(loanData.loans);
                    if (loanData.loans.length > 0) {
                        setSelectedLoan(loanData.loans[0].loanId);
                    }
                }

                if (accountData.result === "SUCCESS" && accountData.accounts) {
                    setAccounts(accountData.accounts);
                    if (accountData.accounts.length > 0) {
                        setSelectedAccount(accountData.accounts[0].accountId);
                    }
                }
            } catch (error) {
                console.error("Failed to fetch data:", error);
            }
        };

        fetchLoansAndAccounts();
    }, [selectedTask]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleReset = () => {
        setFormData({
            password: '',
            passwordConfirm: '',
            amount: '',
        });
        setRepayType('SCHEDULED'); // 💡 리셋 시 상환 방식도 기본값으로
    };

    const handleSubmit = async () => {
        if (!selectedLoan || !selectedAccount) {
            showAlert("대출과 출금 계좌를 선택해주세요.");
            return;
        }

        if (formData.password !== formData.passwordConfirm) {
            showAlert("비밀번호가 일치하지 않습니다.");
            return;
        }
        
        const cleanAmount = Number(formData.amount.replace(/,/g, ''));
        if (isNaN(cleanAmount) || cleanAmount <= 0) {
            showAlert("올바른 금액을 입력해주세요.");
            return;
        }

        const account = accounts.find(acc => acc.accountId === selectedAccount);
        if (!account) return;

        const requestBody = {
            accountNumber: account.accountNumber,
            accountPassword: formData.password,
            repayAmount: cleanAmount,
            userId: selectedTask.userId
        };

        try {
            // 💡 3. API 동적 호출 처리
            const apiUrl = repayType === 'SCHEDULED' 
                ? `/api/loan/${selectedLoan}/repay` 
                : `/api/loan/${selectedLoan}/repay-early`;

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            const data = await response.json();

            switch (data.result) {
                case 'SUCCESS':
                    // 💡 성공 메시지도 상환 방식에 따라 다르게
                    { const successMessage = repayType === 'SCHEDULED'
                        ? "스케줄 상환이 완료되었습니다."
                        : "중도 상환이 완료되었습니다.";
                    showAlert(successMessage, () => {
                        if (onCreate) onCreate();
                    });
                    break; }
                case 'FAILURE':
                    showAlert("상환에 실패했습니다.");
                    break;
                case 'FAILURE_SESSION':
                    showAlert("세션이 만료되었습니다. 다시 로그인해주세요.");
                    break;
                case 'FAILURE_UNAUTHORIZED':
                    showAlert("권한이 없습니다.");
                    break;
                case 'FAILURE_LOAN_NOT_FOUND':
                    showAlert("대출을 찾을 수 없습니다.");
                    break;
                case 'FAILURE_INVALID_ACCOUNT':
                    showAlert("유효하지 않은 계좌입니다.");
                    break;
                case 'FAILURE_INSUFFICIENT_BALANCE':
                    showAlert("계좌 잔액이 부족합니다.");
                    break;
                case 'FAILURE_ALREADY_COMPLETED':
                    showAlert("이미 상환이 완료된 대출입니다.");
                    break;
                case 'FAILURE_INVALID_AMOUNT':
                    showAlert("유효하지 않은 금액입니다.");
                    break;
                default:
                    showAlert("알 수 없는 오류가 발생했습니다.");
            }
        } catch (error) {
            console.error("Failed to repay loan:", error);
            alert("서버와의 통신에 실패했습니다.");
        }
    };

    // 숫자를 콤마 포맷으로 변환하는 헬퍼 함수
    const formatNumber = (num) => new Intl.NumberFormat('ko-KR').format(num);

    const calculateProgress = (outstanding, principal) => {
        if (!principal || principal === 0) return 0;
        const paid = principal - outstanding;
        return Math.max(0, Math.min(100, Math.round((paid / principal) * 100)));
    };

    return (
        <div className={styles.container}>
            {/* 1. 상단 타이틀 바 */}
            <div className={styles.headerTitle}>
                <span ><img className={styles.icon} src={loansIcon} alt="대출 상환"/></span> 대출 상환
            </div>

            {/* 2. 대출 목록 리스트 */}
            <div className={styles.loanList}>
                {loans.map((loan) => (
                    <div
                        key={loan.loanId}
                        className={`${styles.loanCard} ${selectedLoan === loan.loanId ? styles.selected : ''}`}
                        onClick={() => setSelectedLoan(loan.loanId)}
                    >
                        <div className={styles.cardTop}>
                            <h3 className={styles.loanName}>{loan.info}</h3>
                        </div>

                        <div className={styles.cardMid}>
                            <div className={styles.balanceWrap}>
                                <span className={styles.balanceText}>잔여</span>
                                <span className={styles.balanceAmount}>{formatNumber(loan.outstandingAmount)} 원</span>
                            </div>
                            <div className={styles.progressText}>상환률 {calculateProgress(loan.outstandingAmount, loan.principalAmount)}%</div>
                        </div>

                        <div className={styles.cardBottom}>
                            <p>원금 {formatNumber(loan.principalAmount)}원 · 금리 연{loan.interestRate}%</p>
                            <p>만기일: {loan.maturityDate}</p>
                        </div>
                    </div>
                ))}
                {loans.length === 0 && <div style={{textAlign: 'center', padding: '20px'}}>대출 목록이 없습니다.</div>}
            </div>

            {/* 💡 2. 상환 방식 선택 UI */}
            <div className={styles.repayTypeSection}>
                <div className={styles.sectionLabel}>상환 방식 선택</div>
                <div className={styles.repayTypeGroup}>
                    <label className={`${styles.repayTypeOption} ${repayType === 'SCHEDULED' ? styles.selectedOption : ''}`}>
                        <input 
                            type="radio" 
                            name="repayType" 
                            value="SCHEDULED" 
                            checked={repayType === 'SCHEDULED'} 
                            onChange={() => setRepayType('SCHEDULED')} 
                            className={styles.hiddenRadio}
                        />
                        <div className={styles.optionContent}>
                            <span className={styles.optionTitle}>정기 스케줄 상환</span>
                            <span className={styles.optionDesc}>이번 달 미납분(원금+이자) 납부</span>
                        </div>
                    </label>
                    <label className={`${styles.repayTypeOption} ${repayType === 'EARLY' ? styles.selectedOption : ''}`}>
                        <input 
                            type="radio" 
                            name="repayType" 
                            value="EARLY" 
                            checked={repayType === 'EARLY'} 
                            onChange={() => setRepayType('EARLY')} 
                            className={styles.hiddenRadio}
                        />
                        <div className={styles.optionContent}>
                            <span className={styles.optionTitle}>중도 상환</span>
                            <span className={styles.optionDesc}>남은 원금 차감 및 전액 완납</span>
                        </div>
                    </label>
                </div>
            </div>

            {/* 3. 출금 계좌 섹션 */}
            <div className={styles.accountSection}>
                <div className={styles.sectionLabel}>출금 계좌 (선택)</div>
                {accounts.map((acc) => (
                    <div
                        key={acc.accountId}
                        className={`${styles.accountBox} ${selectedAccount === acc.accountId ? styles.selected : ''}`}
                        onClick={() => setSelectedAccount(acc.accountId)}
                        style={{ cursor: 'pointer', marginBottom: '10px' }}
                    >
                        <div className={styles.accountLeft}>
                            <span className={styles.accountTag}>{acc.productName}</span>
                            <div className={styles.accountDetails}>
                                <span className={styles.accountName}>{acc.accountAlias || acc.productName}</span>
                                <span className={styles.accountNumber}>{acc.accountNumber}</span>
                            </div>
                        </div>
                        <div className={styles.accountRight}>
                            {formatNumber(acc.balance)} 원
                        </div>
                    </div>
                ))}
                {accounts.length === 0 && <div style={{textAlign: 'center', padding: '10px'}}>출금 가능한 계좌가 없습니다.</div>}
            </div>

            {/* 4. 입력 폼 섹션 */}
            <div className={styles.inputGrid}>
                <div className={styles.inputGroup}>
                    <label>계좌 비밀번호</label>
                    <input
                        type="password"
                        name="password"
                        placeholder="●●●●"
                        value={formData.password}
                        onChange={handleChange}
                    />
                </div>
                <div className={styles.inputGroup}>
                    <label>계좌 비밀번호 확인</label>
                    <input
                        type="password"
                        name="passwordConfirm"
                        placeholder="한번 더 입력해주세요"
                        value={formData.passwordConfirm}
                        onChange={handleChange}
                    />
                </div>
                <div className={styles.inputGroup}>
                    <label>출금 금액</label>
                    <div className={styles.amountInputWrap}>
                        <input
                            type="text"
                            name="amount"
                            value={formData.amount}
                            onChange={handleChange}
                            className={styles.amountInput}
                            /* 💡 4. 선택된 모드에 따라 다르게 보여주기 */
                            placeholder={repayType === 'SCHEDULED' ? "스케줄 상환할 금액 입력" : "원금을 차감할 금액 입력"}
                        />
                        <span className={styles.unit}>원</span>
                    </div>
                </div>
            </div>

            {/* 5. 하단 액션 버튼 */}
            <div className={styles.buttonRow}>
                <div className={styles.rightActions}>
                    <button className={styles.btnReset} onClick={handleReset}>초기화</button>
                    <button className={styles.btnSubmit} onClick={handleSubmit}>대출상환신청</button>
                </div>
            </div>
        </div>
    );
};

export default LoanPayment;
