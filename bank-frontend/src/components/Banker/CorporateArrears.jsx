import React, { useCallback, useEffect, useState, useMemo } from 'react';
import styles from './CorporateArrears.module.css';
import { useModal } from "../../context/ModalContext.jsx";

const CorporateArrears = ({ onReturnToTaskSelect, onComplete, selectedTask }) => {
    const { openModal } = useModal();
    const userId = selectedTask?.userId;

    // State
    const [userInfo, setUserInfo] = useState({ businessName: "", businessNumber: "" });
    const [loans, setLoans] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [selectedLoanId, setSelectedLoanId] = useState('');
    const [selectedLoanDetails, setSelectedLoanDetails] = useState(null);
    const [loanSchedules, setLoanSchedules] = useState([]);
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [payAmount, setPayAmount] = useState(0);
    const [repayType, setRepayType] = useState('SCHEDULED');
    const [password, setPassword] = useState('');
    const [passwordConfirm, setPasswordConfirm] = useState('');

    const showAlert = useCallback((message, onConfirm) => {
        openModal({ message, onConfirm: onConfirm || (() => {}) });
    }, [openModal]);

    // Fetch initial data
    useEffect(() => {
        if (!userId) return;

        const fetchInitialData = async () => {
            try {
                const [userRes, loanRes, accountRes] = await Promise.all([
                    fetch(`/api/user/info?userId=${userId}`),
                    fetch(`/api/loan/user?userId=${userId}`),
                    fetch(`/api/account/user/${userId}`)
                ]);

                const userData = await userRes.json();
                if (userData.result === 'SUCCESS') {
                    const { user } = userData;
                    if (user.userType !== 'corporate') {
                        showAlert("개인회원은 이 탭에 접근할 수 없습니다.", onComplete);
                        return;
                    }
                    setUserInfo({ businessName: user.name, businessNumber: user.identificationNumber || 'N/A' });
                } else { throw new Error('사용자 정보 조회 실패'); }

                const loanData = await loanRes.json();
                if (loanData.result === 'SUCCESS' && loanData.loans) {
                    setLoans(loanData.loans);
                    if (loanData.loans.length > 0) {
                        setSelectedLoanId(loanData.loans[0].loanId);
                    }
                }

                const accountData = await accountRes.json();
                if (accountData.result === 'SUCCESS' && accountData.accounts) {
                    setAccounts(accountData.accounts);
                    if (accountData.accounts.length > 0) {
                        setSelectedAccountId(accountData.accounts[0].accountId);
                    }
                }
            } catch (error) {
                console.error("초기 데이터 조회 실패:", error);
                showAlert("데이터를 불러오는 중 오류가 발생했습니다.", onReturnToTaskSelect);
            }
        };

        fetchInitialData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    // Fetch loan details and schedules
    useEffect(() => {
        if (!selectedLoanId) {
            setSelectedLoanDetails(null);
            setLoanSchedules([]);
            return;
        }
        const fetchLoanData = async () => {
            try {
                const [detailsRes, schedulesRes] = await Promise.all([
                    fetch(`/api/loan/${selectedLoanId}`),
                    fetch(`/api/loan/schedules?loanId=${selectedLoanId}`)
                ]);
                const detailsData = await detailsRes.json();
                setSelectedLoanDetails(detailsData.result === 'SUCCESS' ? detailsData.loan : null);
                const schedulesData = await schedulesRes.json();
                setLoanSchedules(schedulesData.result || []);
            } catch (error) {
                console.error("대출 상세 정보 조회 실패:", error);
                showAlert("대출 상세 정보를 불러오는 데 실패했습니다.");
            }
        };
        fetchLoanData();
    }, [selectedLoanId, showAlert]);

    // Memoized arrears info
    const arrearsInfo = useMemo(() => {
        if (!selectedLoanDetails) return { totalArrears: 0, arrearsCount: 0 };
        const overdueSchedules = loanSchedules.filter(s => s.status === 'OVERDUE');
        return {
            totalArrears: selectedLoanDetails.overdueAmount || 0,
            arrearsCount: overdueSchedules.length
        };
    }, [loanSchedules, selectedLoanDetails]);

    // Determine repayment type
    useEffect(() => {
        const today = new Date().toISOString().split('T')[0];
        const isOverdue = arrearsInfo.arrearsCount > 0;
        const isScheduledPaymentDay = loanSchedules.some(s => s.dueDate === today && s.status === 'SCHEDULED');
        setRepayType(isOverdue || isScheduledPaymentDay ? 'SCHEDULED' : 'EARLY');
    }, [arrearsInfo, loanSchedules]);

    const handleSubmit = async () => {
        if (!selectedLoanId || !selectedAccountId) {
            showAlert("대출계좌와 출금계좌를 선택해주세요.");
            return;
        }
        if (payAmount <= 0) {
            showAlert("납부 금액은 0보다 커야 합니다.");
            return;
        }
        if (password.length !== 4) {
            showAlert("비밀번호 4자리를 입력해주세요.");
            return;
        }
        if (password !== passwordConfirm) {
            showAlert("비밀번호가 일치하지 않습니다.");
            return;
        }

        const account = accounts.find(acc => acc.accountId.toString() === selectedAccountId.toString());
        if (!account) {
            showAlert("선택된 출금계좌 정보를 찾을 수 없습니다.");
            return;
        }

        const requestBody = {
            accountNumber: account.accountNumber,
            accountPassword: password,
            repayAmount: payAmount,
            userId: userId
        };

        const apiUrl = repayType === 'SCHEDULED'
            ? `/api/loan/${selectedLoanId}/repay`
            : `/api/loan/${selectedLoanId}/repay-early`;

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            });
            const data = await response.json();
            if (data.result === 'SUCCESS') {
                showAlert("상환 처리가 완료되었습니다.", onComplete);
            } else {
                showAlert(`상환 처리 실패: ${data.message || '알 수 없는 오류'}`);
            }
        } catch (error) {
            console.error("상환 처리 중 오류 발생:", error);
            showAlert(`상환 처리 중 오류가 발생했습니다: ${error.message}`);
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                <h1 className={styles.headerTitle}>기업 연체 관리 및 납부</h1>
            </header>

            <div className={styles.formContainer}>
                {/* Customer & Arrears Info */}
                <div className={styles.section}>
                    <div className={styles.labelRow}><span className={styles.centerLabel}>고객 및 연체 정보</span></div>
                    <div className={styles.inputRow}><div className={styles.customSelectFull}><input type="text" className={styles.inputField} value={`법인명: ${userInfo.businessName} (${userInfo.businessNumber})`} readOnly /></div></div>
                    <div className={styles.inputRow}><div className={styles.mintInfoBox}><div className={styles.infoBoxInner}><div className={styles.infoItem}><span className={styles.infoLabel}>총 연체액</span><span className={styles.infoValueDanger}>{arrearsInfo.totalArrears.toLocaleString()}원</span></div><div className={styles.vLine}></div><div className={styles.infoItem}><span className={styles.infoLabel}>연체 회차</span><span className={styles.infoValue}>{arrearsInfo.arrearsCount}회차</span></div></div></div></div>
                </div>

                {/* Loan Selection */}
                <div className={styles.section}>
                    <div className={styles.labelRow}><span className={styles.centerLabel}>대출 계좌 선택</span></div>
                    <div className={styles.customSelectFull}>
                        {loans.length > 0 ? (<select className={styles.selectField} value={selectedLoanId} onChange={(e) => setSelectedLoanId(e.target.value)}>{loans.map(loan => (<option key={loan.loanId} value={loan.loanId}>{loan.info || `대출 유형 : ${loan.productName}`} (잔액: {loan.outstandingAmount.toLocaleString()}원)</option>))}</select>) : (<div className={styles.emptyState}>대출 목록이 없습니다.</div>)}
                    </div>
                </div>

                {/* Withdrawal Account */}
                <div className={styles.section}>
                    <div className={styles.labelRow}><span className={styles.centerLabel}>출금 계좌 선택</span></div>
                    <div className={styles.customSelectFull}>
                        {accounts.length > 0 ? (<select className={styles.selectField} value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)}>{accounts.map(acc => (<option key={acc.accountId} value={acc.accountId}>{acc.accountAlias || acc.productName} ({acc.accountNumber})(잔액: {acc.balance.toLocaleString()}원)</option>))}</select>) : (<div className={styles.emptyState}>출금 가능한 계좌가 없습니다.</div>)}
                    </div>
                </div>

                {/* Password Input */}
                <div className={styles.section}>
                    <div className={styles.labelRow}><span className={styles.centerLabel}>출금 계좌 비밀번호</span></div>
                    <div className={styles.inputRow}>
                        <div className={styles.customSelectFull}>
                            <input type="password" className={styles.inputField} placeholder="비밀번호 4자리" value={password} onChange={(e) => setPassword(e.target.value)} maxLength="4" />
                        </div>
                    </div>
                    <div className={styles.inputRow}>
                        <div className={styles.customSelectFull}>
                            <input type="password" className={styles.inputField} placeholder="비밀번호 확인" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} maxLength="4" />
                        </div>
                    </div>
                </div>

                {/* Repayment Type */}
                <div className={styles.section}>
                    <div className={styles.labelRow}><span className={styles.centerLabel}>상환 타입</span></div>
                    <div className={styles.repayTypeGroup}>
                        <label className={`${styles.repayTypeOption} ${repayType === 'SCHEDULED' ? styles.selectedOption : ''}`}><input type="radio" name="repayType" value="SCHEDULED" checked={repayType === 'SCHEDULED'} onChange={() => setRepayType('SCHEDULED')} className={styles.hiddenRadio} /><div className={styles.optionContent}><span className={styles.optionTitle}>정기 상환</span><span className={styles.optionDesc}>연체 또는 정기상환일</span></div></label>
                        <label className={`${styles.repayTypeOption} ${repayType === 'EARLY' ? styles.selectedOption : ''}`}><input type="radio" name="repayType" value="EARLY" checked={repayType === 'EARLY'} onChange={() => setRepayType('EARLY')} className={styles.hiddenRadio} /><div className={styles.optionContent}><span className={styles.optionTitle}>중도 상환</span><span className={styles.optionDesc}>원금 조기 상환</span></div></label>
                    </div>
                </div>

                {/* Payment Amount */}
                <div className={styles.section}>
                    <div className={styles.labelRow}><span className={styles.centerLabel}>납부 금액</span></div>
                    <div className={styles.amountFieldBox}>
                        <input type="number" className={styles.inputField} value={payAmount} onChange={(e) => setPayAmount(Number(e.target.value))} />
                        <span className={styles.unit}>원</span>
                        <button className={styles.allBtn} onClick={() => setPayAmount(arrearsInfo.totalArrears > 0 ? arrearsInfo.totalArrears : selectedLoanDetails?.outstandingAmount || 0)}>전액</button>
                    </div>
                </div>

                <div className={styles.buttonRow}>
                    <button className={styles.btnSubmit} onClick={handleSubmit}>납부 승인</button>
                </div>
            </div>
        </div>
    );
};

export default CorporateArrears;
