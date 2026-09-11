import React, { useState, useMemo, useEffect, useCallback } from 'react';
import styles from './RecommendSavings.module.css';
import { useModal } from "../../../context/ModalContext.jsx";

/**
 * 적금 상품 가입 폼
 * 백엔드 DTO: SavingsAccountRequestDto
 *  - userId, productId
 *  - installmentAmount (월 납입액)
 *  - termMonths (가입 개월 수)
 *  - linkedAccountId (출금 연결 계좌 ID)
 *  - paymentDay (자동이체일)
 *  - accountPassword, accountAlias, taskId
 *  - linkedAccountNumber, linkedAccountPassword
 */
const RecommendSavings = ({ product, onClose, selectedTask }) => {
    const { openModal } = useModal();

    const showAlert = useCallback((message, onConfirm = null) => {
        openModal({
            message: message,
            onConfirm: onConfirm
        });
    }, [openModal]);

    const [userAccounts, setUserAccounts] = useState([]);

    // 자동이체일 옵션 (1일 ~ 28일)
    const PAYMENT_DAY_OPTIONS = [1, 5, 10 , 15 , 20 ,25]

    // ====== 폼 상태 ======
    const [form, setForm] = useState({
        productId: product?.id ?? 102,
        installmentAmount: '',
        termMonths: '', // 직접 입력 기본값 12개월
        linkedAccountId: '',
        linkedAccountPassword: '',
        linkedAccountNumber: '',
        paymentDay: 1, // 매월 자동이체 약정일
        accountAlias: '',
        accountPassword: '',
        accountPasswordConfirm: '',
        userId: selectedTask?.userId ?? 1,
        agreeTerms: false,
    });

    useEffect(() => {
        const getUserAccounts = async () => {
            const userId = selectedTask?.userId;
            if (userId) {
                try {
                    const response = await fetch(`/api/account/user/${userId}`);
                    if (response.ok) {
                        const rawData = await response.json();
                        const data = Array.isArray(rawData) ? rawData : rawData.accounts || [];
                        
                        const mappedAccounts = data.map(account => ({
                            id: account.accountId,
                            accountNumber: account.accountNumber,
                            label: `${account.accountAlias} (${account.accountNumber})`,
                            balance: account.balance
                        }));
                        
                        setUserAccounts(mappedAccounts);

                        if (mappedAccounts.length > 0) {
                            setForm(prev => ({
                                ...prev,
                                linkedAccountId: mappedAccounts[0].id,
                                linkedAccountNumber: mappedAccounts[0].accountNumber
                            }));
                        }
                    } else {
                        setUserAccounts([]);
                    }
                } catch (error) {
                    console.error("계좌 목록 로드 에러:", error);
                    setUserAccounts([]);
                }
            } else {
                setUserAccounts([]);
            }
        };
        getUserAccounts();
    }, [selectedTask?.userId]);

    const [errors, setErrors] = useState({});

    // ====== 핸들러 ======
    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };

    const handleLinkedAccountChange = (e) => {
        const selectedId = e.target.value;
        const selectedAccount = userAccounts.find(acc => acc.id === Number(selectedId));
        setForm(prev => ({
            ...prev,
            linkedAccountId: selectedId,
            linkedAccountNumber: selectedAccount ? selectedAccount.accountNumber : ''
        }));
    };

    // 금액은 숫자/콤마 포맷 처리
    const handleAmountChange = (e) => {
        const raw = e.target.value.replace(/[^0-9]/g, '');
        setForm((prev) => ({ ...prev, installmentAmount: raw }));
    };

    // 가입기간 숫자만 입력
    const handleTermChange = (e) => {
        const raw = e.target.value.replace(/[^0-9]/g, '');
        setForm((prev) => ({ ...prev, termMonths: raw }));
    };

    const formattedAmount = useMemo(() => {
        if (!form.installmentAmount) return '';
        return Number(form.installmentAmount).toLocaleString('ko-KR');
    }, [form.installmentAmount]);

    // 만기 예상일 (더미 계산)
    const maturityDate = useMemo(() => {
        const d = new Date();
        d.setMonth(d.getMonth() + Number(form.termMonths || 0));
        return d.toISOString().split('T')[0];
    }, [form.termMonths]);

    // 예상 만기 원금 (단순 계산: 월납입액 * 개월수)
    const expectedPrincipal = useMemo(() => {
        const amt = Number(form.installmentAmount || 0);
        const months = Number(form.termMonths || 0);
        return amt * months;
    }, [form.installmentAmount, form.termMonths]);

    const validate = () => {
        const e = {};
        if (!form.installmentAmount || Number(form.installmentAmount) < (product?.minAmount || 10000)) {
            e.installmentAmount = `최소 월 납입액은 ${(product?.minAmount || 10000).toLocaleString()}원입니다.`;
        }
        if (!form.termMonths || Number(form.termMonths) < (product?.minDurationMonths || 1)) {
            e.termMonths = `가입 개월 수를 정확히 입력해주세요. (최소 ${product?.minDurationMonths || 1}개월)`;
        }
        if (!/^\d{4}$/.test(form.linkedAccountPassword)) {
            e.linkedAccountPassword = '출금 계좌 비밀번호 4자리를 입력해주세요.';
        }
        if (!/^\d{4}$/.test(form.accountPassword)) {
            e.accountPassword = '적금 비밀번호 4자리를 입력해주세요.';
        }
        if (form.accountPassword !== form.accountPasswordConfirm) {
            e.accountPasswordConfirm = '비밀번호가 일치하지 않습니다.';
        }
        if (!form.accountAlias.trim()) {
            e.accountAlias = '계좌 별칭을 입력해주세요.';
        }
        if (!form.linkedAccountId) {
            e.linkedAccountId = '연결 계좌를 선택해주세요.';
        }
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const createSavingsAccount = async (payload) => {
        return fetch('/api/account/savings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    };

    const handleSubmit = async () => {
        if (!validate()) return;
        
        // 실제 API에 전송될 형태 (DTO 매핑)
        const payload = {
            taskId: selectedTask?.taskId || null,
            userId: Number(form.userId),
            productId: Number(form.productId),
            installmentAmount: Number(form.installmentAmount),
            termMonths: Number(form.termMonths),
            linkedAccountId: Number(form.linkedAccountId),
            paymentDay: Number(form.paymentDay),
            accountPassword: form.accountPassword,
            accountAlias: form.accountAlias,
            linkedAccountNumber: form.linkedAccountNumber,
            linkedAccountPassword: form.linkedAccountPassword,
        };

        try {
            const response = await createSavingsAccount(payload);
            const data = await response.json();
            
            switch (data.result) {
                case 'SUCCESS':
                    showAlert('적금 계좌가 성공적으로 개설되었습니다.', () => {
                        onClose?.();
                    });
                    break;
                case 'FAILURE_USER_NOT_EXIST':
                    showAlert('사용자 정보를 찾을 수 없습니다.');
                    break;
                case 'FAILURE_NOT_CORPORATE_USER':
                    showAlert('법인 고객만 이용 가능한 상품입니다.');
                    break;
                case 'FAILURE':
                    showAlert('적금 계좌 개설에 실패했습니다. 잠시 후 다시 시도해주세요.');
                    break;
                default:
                    showAlert('적금 계좌 개설에 실패했습니다. 잠시 후 다시 시도해주세요.');
                    break;
            }
        } catch (error) {
            console.error("적금 계좌 개설 중 에러 발생:", error);
            showAlert("서버와 통신 중 오류가 발생했습니다.");
        }
    };

    return (
        <div className={styles.container}>
            <h3 className={styles.title}>적금 가입 정보</h3>

            {/* 가입 금액 (월 납입액) */}
            <div className={styles.field}>
                <label className={styles.label}>월 납입액</label>
                <div className={styles.inputWrap}>
                    <input
                        type="text"
                        inputMode="numeric"
                        className={`${styles.input} ${errors.installmentAmount ? styles.inputError : ''}`}
                        placeholder={`${(product?.minAmount || 10000).toLocaleString()}원 이상`}
                        value={formattedAmount}
                        onChange={handleAmountChange}
                    />
                    <span className={styles.suffix}>원</span>
                </div>
                {errors.installmentAmount && <p className={styles.errorText}>{errors.installmentAmount}</p>}
            </div>

            {/* 가입 기간 직접 입력 */}
            <div className={styles.field}>
                <label className={styles.label}>가입 기간</label>
                <div className={styles.inputWrap}>
                    <input
                        type="text"
                        inputMode="numeric"
                        className={`${styles.input} ${errors.termMonths ? styles.inputError : ''}`}
                        placeholder={`개월 수 입력 (최소 ${product?.minDurationMonths || 1})`}
                        value={form.termMonths}
                        onChange={handleTermChange}
                        maxLength={3}
                    />
                    <span className={styles.suffix}>개월</span>
                </div>
                {errors.termMonths && <p className={styles.errorText}>{errors.termMonths}</p>}
            </div>

            {/* 자동이체 / 출금 계좌 정보 (한 섹션으로 묶음) */}
            <div className={styles.row}>
                <div className={styles.field}>
                    <label className={styles.label}>자동이체 연결 계좌</label>
                    <select
                        name="linkedAccountId"
                        className={`${styles.select} ${errors.linkedAccountId ? styles.inputError : ''}`}
                        value={form.linkedAccountId}
                        onChange={handleLinkedAccountChange}
                    >
                        <option value="">연결할 계좌를 선택해주세요</option>
                        {userAccounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                                {acc.label}
                            </option>
                        ))}
                    </select>
                    {errors.linkedAccountId && <p className={styles.errorText}>{errors.linkedAccountId}</p>}
                </div>
                <div className={styles.field}>
                    <label className={styles.label}>매월 자동이체일</label>
                    <select
                        name="paymentDay"
                        className={styles.select}
                        value={form.paymentDay}
                        onChange={handleChange}
                    >
                        {PAYMENT_DAY_OPTIONS.map((day) => (
                            <option key={day} value={day}>
                                매월 {day}일
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* 출금 계좌 비밀번호 */}
            <div className={styles.field}>
                <label className={styles.label}>연결 계좌 비밀번호 (출금용)</label>
                <input
                    type="password"
                    name="linkedAccountPassword"
                    inputMode="numeric"
                    maxLength={4}
                    className={`${styles.input} ${errors.linkedAccountPassword ? styles.inputError : ''}`}
                    placeholder="출금 계좌 비밀번호 4자리"
                    value={form.linkedAccountPassword}
                    onChange={handleChange}
                />
                {errors.linkedAccountPassword && (
                    <p className={styles.errorText}>{errors.linkedAccountPassword}</p>
                )}
            </div>

            {/* 적금 계좌 별칭 */}
            <div className={styles.field}>
                <label className={styles.label}>적금 계좌 별칭</label>
                <input
                    type="text"
                    name="accountAlias"
                    className={`${styles.input} ${errors.accountAlias ? styles.inputError : ''}`}
                    placeholder="예) 내집마련 적금"
                    value={form.accountAlias}
                    onChange={handleChange}
                    maxLength={20}
                />
                {errors.accountAlias && (
                    <p className={styles.errorText}>{errors.accountAlias}</p>
                )}
            </div>

            {/* 적금 계좌 비밀번호 설정 */}
            <div className={styles.row}>
                <div className={styles.field}>
                    <label className={styles.label}>적금 비밀번호 설정</label>
                    <input
                        type="password"
                        name="accountPassword"
                        inputMode="numeric"
                        maxLength={4}
                        className={`${styles.input} ${errors.accountPassword ? styles.inputError : ''}`}
                        placeholder="••••"
                        value={form.accountPassword}
                        onChange={handleChange}
                    />
                    {errors.accountPassword && (
                        <p className={styles.errorText}>{errors.accountPassword}</p>
                    )}
                </div>

                <div className={styles.field}>
                    <label className={styles.label}>비밀번호 확인</label>
                    <input
                        type="password"
                        name="accountPasswordConfirm"
                        inputMode="numeric"
                        maxLength={4}
                        className={`${styles.input} ${errors.accountPasswordConfirm ? styles.inputError : ''}`}
                        placeholder="••••"
                        value={form.accountPasswordConfirm}
                        onChange={handleChange}
                    />
                    {errors.accountPasswordConfirm && (
                        <p className={styles.errorText}>{errors.accountPasswordConfirm}</p>
                    )}
                </div>
            </div>


            {/* 요약 박스 */}
            <div className={styles.summaryBox}>
                <div className={styles.summaryRow}>
                    <span>만기 예상일</span>
                    <strong>{maturityDate}</strong>
                </div>
                <div className={styles.summaryRow}>
                    <span>만기 예상 원금</span>
                    <strong className={styles.highlight}>
                        {expectedPrincipal.toLocaleString('ko-KR')}원
                    </strong>
                </div>
            </div>

            {/* 버튼 */}
            <div className={styles.btnGroup}>
                <button className={styles.cancelBtn} onClick={onClose}>
                    취소
                </button>
                <button className={styles.submitBtn} onClick={handleSubmit}>
                    가입 신청
                </button>
            </div>
        </div>
    );
};

export default RecommendSavings;