import React, {useState, useMemo, useCallback, useEffect} from 'react';
import styles from './RecommendDeposit.module.css';
import {useModal} from "../../../context/ModalContext.jsx";

/**
 * 예금 상품 가입 폼
 * 백엔드 DTO: DepositAccountRequestDto
 *  - productId, amount, durationMonths, accountPassword,
 *    accountAlias, userId, linkedAccountId, maturityTreatment
 */
const RecommendDeposit = ({ product, onClose, selectedTask }) => {
    const { openModal } = useModal();

    const showAlert = useCallback((message, onConfirm = null) => {
        openModal({
            message: message,
            onConfirm: onConfirm
        });
    }, [openModal]);

    const [userAccounts, setUserAccounts] = useState([]);

    const MATURITY_OPTIONS = [
        /*{ value: 'AUTO_RENEW',   label: '자동 재예치 (원금+이자)' },*/
        { value: 'AUTO_TERMINATE',  label: '만기 시 연결계좌로 자동이체' },
        /*{ value: 'HOLD',           label: '만기 후 보관' },*/
    ];

    // ====== 폼 상태 ======
    const [form, setForm] = useState({
        productId: product?.id ?? 101,
        amount: '',
        durationMonths: '', // 직접 입력 기본값 12개월
        accountPassword: '',
        accountPasswordConfirm: '',
        accountAlias: '',
        userId: selectedTask?.userId ?? 1,
        linkedAccountId: '',
        maturityTreatment: 'AUTO_TERMINATE',
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
                            label: `${account.accountAlias} (${account.accountNumber}) ${account.balance}원`,
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
        setForm((prev) => ({ ...prev, amount: raw }));
    };

    // 가입기간 숫자만 입력
    const handleDurationChange = (e) => {
        const raw = e.target.value.replace(/[^0-9]/g, '');
        setForm((prev) => ({ ...prev, durationMonths: raw }));
    };

    const formattedAmount = useMemo(() => {
        if (!form.amount) return '';
        return Number(form.amount).toLocaleString('ko-KR');
    }, [form.amount]);

    // 만기 예상일 (더미 계산)
    const maturityDate = useMemo(() => {
        const d = new Date();
        d.setMonth(d.getMonth() + Number(form.durationMonths || 0));
        return d.toISOString().split('T')[0];
    }, [form.durationMonths]);

    // 예상 이자
    const expectedInterest = useMemo(() => {
        const amt = Number(form.amount || 0);
        const months = Number(form.durationMonths || 0);
        const rate = product?.baseInterestRate ? product.baseInterestRate / 100 : 0.035;
        return Math.floor((amt * rate * months) / 12);
    }, [form.amount, form.durationMonths, product]);

    const validate = () => {
        const e = {};
        if (!form.amount || Number(form.amount) < (product?.minAmount || 10000)) {
            e.amount = `최소 가입 금액은 ${(product?.minAmount || 10000).toLocaleString()}원입니다.`;
        }
        if (!form.durationMonths || Number(form.durationMonths) < (product?.minDurationMonths || 1)) {
            e.durationMonths = `가입 개월 수를 정확히 입력해주세요. (최소 ${product?.minDurationMonths || 1}개월)`;
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
        if (!form.linkedAccountId) {
            e.linkedAccountId = '연결 계좌를 선택해주세요.';
        }
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const createDepositAccount = async (payload) => {
        return fetch('/api/account/deposit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    };
    
    const handleSubmit =  async () => {
        if (!validate()) return;

        // 실제 API에 전송될 형태 (DTO 매핑)
        const payload = {
            taskId: selectedTask?.taskId || null,
            productId: Number(form.productId),
            amount: Number(form.amount),
            durationMonths: Number(form.durationMonths),
            accountPassword: form.accountPassword,
            accountAlias: form.accountAlias,
            userId: Number(form.userId),
            linkedAccountId: Number(form.linkedAccountId),
            maturityTreatment: "AUTO_TERMINATE"

        };
        try {
            const response = await createDepositAccount(payload);
            const data = await response.json();

            switch (data.result) {
                case 'SUCCESS':
                    showAlert('계좌가 성공적으로 개설되었습니다.', () => {
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
                    showAlert('계좌 개설에 실패했습니다. 잠시 후 다시 시도해주세요.');
                    break;
                default:
                    showAlert('계좌 개설에 실패했습니다. 잠시 후 다시 시도해주세요.');
                    break;
            }
        } catch (e) {
            console.error(e);
            showAlert("서버와 통신 중 오류가 발생했습니다.");
        }
    };

    return (
        <div className={styles.container}>
            <h3 className={styles.title}>예금 가입 정보</h3>

            {/* 출금 연결 계좌 */}
            <div className={styles.field}>
                <label className={styles.label}>출금 연결 계좌</label>
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
            
            {/* 금액과 기간을 한 줄(row)에 배치할 수도 있지만, 예제 구조 유지 */}
            {/* 가입 금액 */}
            <div className={styles.field}>
                <label className={styles.label}>가입 금액</label>
                <div className={styles.inputWrap}>
                    <input
                        type="text"
                        inputMode="numeric"
                        className={`${styles.input} ${errors.amount ? styles.inputError : ''}`}
                        placeholder={`${(product?.minAmount || 10000).toLocaleString()}원 이상`}
                        value={formattedAmount}
                        onChange={handleAmountChange}
                    />
                    <span className={styles.suffix}>원</span>
                </div>
                {errors.amount && <p className={styles.errorText}>{errors.amount}</p>}
            </div>

            {/* 가입 기간 */}
            <div className={styles.field}>
                <label className={styles.label}>가입 기간</label>
                <div className={styles.inputWrap}>
                    <input
                        type="text"
                        inputMode="numeric"
                        className={`${styles.input} ${errors.durationMonths ? styles.inputError : ''}`}
                        placeholder={`개월 수 입력 (최소 ${product?.minDurationMonths || 1})`}
                        value={form.durationMonths}
                        onChange={handleDurationChange}
                        maxLength={3}
                    />
                    <span className={styles.suffix}>개월</span>
                </div>
                {errors.durationMonths && <p className={styles.errorText}>{errors.durationMonths}</p>}
            </div>

            {/* 만기 처리 방식 */}
            <div className={styles.field}>
                <label className={styles.label}>만기 처리 방식</label>
                <select
                    name="maturityTreatment"
                    className={styles.select}
                    value={form.maturityTreatment}
                    onChange={handleChange}
                >
                    {MATURITY_OPTIONS.map((m) => (
                        <option key={m.value} value={m.value}>
                            {m.label}
                        </option>
                    ))}
                </select>
            </div>

            {/* 계좌 별칭 */}
            <div className={styles.field}>
                <label className={styles.label}>계좌 별칭</label>
                <input
                    type="text"
                    name="accountAlias"
                    className={`${styles.input} ${errors.accountAlias ? styles.inputError : ''}`}
                    placeholder="예) 내 결혼자금 예금"
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

            {/* 요약 박스 */}
            <div className={styles.summaryBox}>
                <div className={styles.summaryRow}>
                    <span>만기 예상일</span>
                    <strong>{maturityDate}</strong>
                </div>
                <div className={styles.summaryRow}>
                    <span>예상 이자 (세전, 연 {product?.baseInterestRate || 3.5}%)</span>
                    <strong className={styles.highlight}>
                        {expectedInterest.toLocaleString('ko-KR')}원
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

export default RecommendDeposit;