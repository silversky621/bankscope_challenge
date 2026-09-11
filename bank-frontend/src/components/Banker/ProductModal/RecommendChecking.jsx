import React, { useState, useMemo, useCallback } from "react";
import styles from "./RecommendChecking.module.css";
import { useModal } from "../../../context/ModalContext.jsx";

/**
 * 입출금 계좌(Checking) 가입 폼
 * 백엔드 DTO: (AccountCreate.jsx 참고 시 RegisterAccountRequestDto 유사 구조)
 * - taskId, productId, amount, accountPassword, accountAlias, userId
 */
const RecommendChecking = ({ product, onClose, selectedTask }) => {
    const { openModal } = useModal();

    const showAlert = useCallback((message, onConfirm = null) => {
        openModal({
            message: message,
            onConfirm: onConfirm
        });
    }, [openModal]);

    // ====== 폼 상태 ======
    const [form, setForm] = useState({
        productId: product?.id ?? '',
        amount: '',
        accountPassword: '',
        accountPasswordConfirm: '',
        accountAlias: '',
        userId: selectedTask?.userId ?? '',
    });

    const [errors, setErrors] = useState({});

    // ====== 핸들러 ======
    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    // 금액은 숫자/콤마 포맷 처리
    const handleAmountChange = (e) => {
        const raw = e.target.value.replace(/[^0-9]/g, '');
        setForm((prev) => ({ ...prev, amount: raw }));
    };

    const formattedAmount = useMemo(() => {
        if (!form.amount) return '';
        return Number(form.amount).toLocaleString('ko-KR');
    }, [form.amount]);

    const validate = () => {
        const e = {};
        if (!form.amount || Number(form.amount) < 0) {
            e.amount = '초기 입금액을 입력해주세요. (0원 이상)';
        }
        if (!/^\d{4}$/.test(form.accountPassword)) {
            e.accountPassword = '비밀번호는 숫자 4자리입니다.';
        }
        if (form.accountPassword !== form.accountPasswordConfirm) {
            e.accountPasswordConfirm = '비밀번호가 일치하지 않습니다.';
        }
        if (!form.accountAlias.trim()) {
            e.accountAlias = '계좌 별칭을 입력해주세요.';
        }
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;

        // AccountCreate.jsx 참고하여 payload 구성
        const payload = {
            taskId: selectedTask?.taskId || null,
            productId: Number(form.productId) || (product?.productId ? Number(product.productId) : 0),
            amount: Number(form.amount),
            durationMonths: null, // 입출금은 기간 없음
            accountPassword: form.accountPassword,
            accountAlias: form.accountAlias,
            userId: Number(form.userId) || 0
        };

        try {
            const response = await fetch(`/api/account/register`, {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                showAlert("서버 응답 오류로 계좌 생성에 실패하였습니다.");
                return;
            }

            const data = await response.json();

            switch (data.result) {
                case 'SUCCESS':
                    // BankerWorkSpace에서 업무 상태 업데이트 로직이 필요할 수 있으나,
                    // 모달 내에서는 개설 완료 알림 후 모달을 닫는 처리
                    showAlert(`계좌가 생성되었습니다.\n계좌번호: ${data.account?.accountNumber || ''}`, () => {
                        onClose?.();
                    });
                    break;
                case 'FAILURE_USER_NOT_EXIST':
                    showAlert("존재하지 않는 사용자입니다.");
                    break;
                case 'FAILURE':
                default:
                    showAlert("계좌 생성에 실패하였습니다.");
                    break;
            }
        } catch (error) {
            console.error("계좌 생성 프로세스 오류:", error);
            showAlert("처리 중 예기치 못한 오류가 발생했습니다.");
        }
    };

    return (
        <div className={styles.container}>
            <h3 className={styles.title}>입출금 계좌 개설 정보</h3>

            {/* 초기 입금 금액 */}
            <div className={styles.field}>
                <label className={styles.label}>초기 입금 금액</label>
                <div className={styles.inputWrap}>
                    <input
                        type="text"
                        inputMode="numeric"
                        className={`${styles.input} ${errors.amount ? styles.inputError : ''}`}
                        placeholder="금액을 입력하세요"
                        value={formattedAmount}
                        onChange={handleAmountChange}
                    />
                    <span className={styles.suffix}>원</span>
                </div>
                {errors.amount && <p className={styles.errorText}>{errors.amount}</p>}
            </div>

            {/* 계좌 별칭 */}
            <div className={styles.field}>
                <label className={styles.label}>계좌 별칭</label>
                <input
                    type="text"
                    name="accountAlias"
                    className={`${styles.input} ${errors.accountAlias ? styles.inputError : ''}`}
                    placeholder="예) 내 급여 통장"
                    value={form.accountAlias}
                    onChange={handleChange}
                    maxLength={20}
                />
                {errors.accountAlias && (
                    <p className={styles.errorText}>{errors.accountAlias}</p>
                )}
            </div>

            {/* 계좌 비밀번호 */}
            <div className={styles.row}>
                <div className={styles.field}>
                    <label className={styles.label}>계좌 비밀번호 (숫자 4자리)</label>
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

            {/* 요약 박스 (선택적 표시) */}
            <div className={styles.summaryBox}>
                <div className={styles.summaryRow}>
                    <span>상품명</span>
                    <strong>{product?.name || "입출금 상품"}</strong>
                </div>
                <div className={styles.summaryRow}>
                    <span>가입 대상</span>
                    <strong>{product?.targetType || "개인"}</strong>
                </div>
                {product?.baseInterestRate && (
                    <div className={styles.summaryRow}>
                        <span>기본 금리</span>
                        <strong>연 {product.baseInterestRate}%</strong>
                    </div>
                )}
            </div>

            {/* 버튼 */}
            <div className={styles.btnGroup}>
                <button className={styles.cancelBtn} onClick={onClose}>
                    취소
                </button>
                <button className={styles.submitBtn} onClick={handleSubmit}>
                    계좌 생성
                </button>
            </div>
        </div>
    );
};

export default RecommendChecking;