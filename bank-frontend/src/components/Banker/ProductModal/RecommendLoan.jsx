import React, { useState, useMemo, useEffect, useCallback } from 'react';
import styles from './RecommendLoan.module.css';
import { useModal } from "../../../context/ModalContext.jsx";

/**
 * 대출 상품 가입 폼
 * 백엔드 DTO: LoanAccountRequestDto
 *  - userId
 *  - productId
 *  - linkedAccountId
 *  - principalAmount
 *  - durationMonths
 *  - paymentDay
 *  - info
 */
const RecommendLoan = ({ product, onClose, selectedTask }) => {
    const { openModal } = useModal();

    const showAlert = useCallback((message, onConfirm = null) => {
        openModal({
            message: message,
            onConfirm: onConfirm
        });
    }, [openModal]);

    const [userAccounts, setUserAccounts] = useState([]);

    // 자동이체일 옵션 (1일 ~ 28일)
    const PAYMENT_DAY_OPTIONS = Array.from({ length: 28 }, (_, i) => i + 1);

    // ====== 폼 상태 ======
    const [form, setForm] = useState({
        userId: selectedTask?.userId ?? 1,
        productId: product?.id ?? 103, // 임의의 대출 상품 ID
        linkedAccountId: '',
        principalAmount: '',
        durationMonths: '',
        paymentDay: 1,
        info: '',
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
                                linkedAccountId: mappedAccounts[0].id
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

    // 금액은 숫자/콤마 포맷 처리
    const handleAmountChange = (e) => {
        const raw = e.target.value.replace(/[^0-9]/g, '');
        setForm((prev) => ({ ...prev, principalAmount: raw }));
    };

    // 대출기간 숫자만 입력
    const handleDurationChange = (e) => {
        const raw = e.target.value.replace(/[^0-9]/g, '');
        setForm((prev) => ({ ...prev, durationMonths: raw }));
    };

    const formattedAmount = useMemo(() => {
        if (!form.principalAmount) return '';
        return Number(form.principalAmount).toLocaleString('ko-KR');
    }, [form.principalAmount]);

    const validate = () => {
        const e = {};
        if (!form.principalAmount || Number(form.principalAmount) <= 0) {
            e.principalAmount = '대출 신청 금액을 정확히 입력해주세요.';
        }
        if (!form.durationMonths || Number(form.durationMonths) <= 0) {
            e.durationMonths = '대출 기간을 정확히 입력해주세요.';
        }
        if (!form.linkedAccountId) {
            e.linkedAccountId = '연결 계좌를 선택해주세요.';
        }
        if (!form.agreeTerms) {
            e.agreeTerms = '약관에 동의해주세요.';
        }
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;

        // 실제 API에 전송될 형태 (DTO 매핑)
        const payload = {
            userId: Number(selectedTask?.userId ?? form.userId),
            productId: Number(form.productId),
            linkedAccountId: Number(form.linkedAccountId),
            principalAmount: Number(form.principalAmount),
            durationMonths: Number(form.durationMonths),
            paymentDay: Number(form.paymentDay),
            info: "", // 백엔드 로직 안전성을 위해 빈 문자열 추가
        };

        if (selectedTask?.taskId) {
            payload.taskId = Number(selectedTask.taskId);
        }

        try {
            const response = await fetch('/api/loan/workspace/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const data = await response.json();
                if (data.result === 'SUCCESS') {
                    showAlert('대출 상품 신청이 완료되었습니다.', () => {
                        onClose?.();
                    });
                } else if(data.result === 'FAILURE_INVALID_AMOUNT') {
                    showAlert('올바르지않은 대출 원금입니다.');
                } else if ( data.result === 'FAILURE_INVALID_ACCOUNT') {
                    showAlert('올바르지않은 계좌입니다.');
                } else {
                    showAlert(`대출 신청에 실패했습니다: ${data.message || '알 수 없는 오류'}`);
                }
            } else {
                showAlert(`서버 응답 오류로 신청에 실패했습니다. (${response.status})`);
            }
        } catch (error) {
            console.error("대출 신청 처리 중 통신 에러 발생:", error);
            showAlert('통신 오류가 발생했습니다.');
        }
    };

    return (
        <div className={styles.container}>
            <h3 className={styles.title}>대출 신청 정보</h3>

            {/* 출금 연결 계좌 */}
            <div className={styles.field}>
                <label className={styles.label}>대출금 수령 및 이자 출금 계좌</label>
                <select
                    name="linkedAccountId"
                    className={`${styles.select} ${errors.linkedAccountId ? styles.inputError : ''}`}
                    value={form.linkedAccountId}
                    onChange={handleChange}
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
            
            {/* 신청 금액 */}
            <div className={styles.field}>
                <label className={styles.label}>대출 신청 금액</label>
                <div className={styles.inputWrap}>
                    <input
                        type="text"
                        inputMode="numeric"
                        className={`${styles.input} ${errors.principalAmount ? styles.inputError : ''}`}
                        placeholder="금액 입력"
                        value={formattedAmount}
                        onChange={handleAmountChange}
                    />
                    <span className={styles.suffix}>원</span>
                </div>
                {errors.principalAmount && <p className={styles.errorText}>{errors.principalAmount}</p>}
            </div>

            <div className={styles.row}>
                {/* 대출 기간 */}
                <div className={styles.field}>
                    <label className={styles.label}>대출 기간</label>
                    <div className={styles.inputWrap}>
                        <input
                            type="text"
                            inputMode="numeric"
                            className={`${styles.input} ${errors.durationMonths ? styles.inputError : ''}`}
                            placeholder="개월 수 입력 (예: 12)"
                            value={form.durationMonths}
                            onChange={handleDurationChange}
                            maxLength={3}
                        />
                        <span className={styles.suffix}>개월</span>
                    </div>
                    {errors.durationMonths && <p className={styles.errorText}>{errors.durationMonths}</p>}
                </div>
                <div className={styles.field}>
                    <label className={styles.label}>매월 자동이체일(이자)</label>
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

            {/* 버튼 */}
            <div className={styles.btnGroup}>
                <button className={styles.cancelBtn} onClick={onClose}>
                    취소
                </button>
                <button className={styles.submitBtn} onClick={handleSubmit}>
                    신청 하기
                </button>
            </div>
        </div>
    );
};

export default RecommendLoan;