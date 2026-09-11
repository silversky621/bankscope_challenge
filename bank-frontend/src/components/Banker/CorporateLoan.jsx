import React, { useState, useEffect } from 'react';
import styles from './CorporateLoan.module.css';
import { useModal } from '../../context/ModalContext';

const CorporateLoan = ({ onReturnToTaskSelect, onComplete, selectedTask }) => {
    const { openModal } = useModal();

    // 1. State Management (백엔드 DTO 규격에 맞춘 상태)
    const [targetType] = useState('CORPORATE');
    const [products, setProducts] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [selectedAccount, setSelectedAccount] = useState(null);
    const [formData, setFormData] = useState({
        principalAmount: '',
        durationMonths: '',
        paymentDay: ''
    });

    // 2 & 3. Validation (법인 검증) 및 Data Fetching
    useEffect(() => {
        const validateAndFetch = async () => {
            const userId = selectedTask?.userId;
            if (!userId) {
                openModal({ message: "상담 중인 고객 정보가 없습니다.", onConfirm: onReturnToTaskSelect });
                return;
            }

            try {
                // 고객 유형 식별 및 접근 차단 로직
                const userRes = await fetch(`/api/user/info?userId=${userId}`);
                if (userRes.ok) {
                    const userData = await userRes.json();
                    if (userData.result === 'SUCCESS' && userData.user) {
                        if (userData.user.userType !== 'corporate') {
                            openModal({
                                message: "개인손님이 이용할 수 없는 기능입니다.",
                                onConfirm: onComplete
                            } );
                            return; // 비법인 고객일 경우 데이터 로드 중단 및 조기 종료
                        }
                    }
                } else {
                    openModal({ message: "고객 정보 조회에 실패했습니다.", onConfirm: onReturnToTaskSelect });
                    return;
                }

                // 법인 대출 상품 조회
                const prodUrl = `/api/product/list?category=LOAN&targetType=${targetType}&targetType=ALL`;
                const prodRes = await fetch(prodUrl);
                if (prodRes.ok) {
                    const prodData = await prodRes.json();
                    const productList = prodData.result === 'SUCCESS' ? prodData.products : (Array.isArray(prodData) ? prodData : []);
                    setProducts(productList || []);
                }

                // 법인 고객 계좌 조회
                const accRes = await fetch(`/api/account/user/${userId}`);
                if (accRes.ok) {
                    const accData = await accRes.json();
                    const accountList = Array.isArray(accData) ? accData : (accData.accounts || []);
                    setAccounts(accountList);
                }
            } catch (error) {
                console.error("데이터 조회 중 에러 발생:", error);
            }
        };

        validateAndFetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedTask?.userId, targetType]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // 5. Submit Logic (대출 승인 API 호출)
    const handleSubmit = async () => {
        if (!selectedProduct) {
            openModal({ message: "가입하실 법인 대출 상품을 선택해주세요." });
            return;
        }
        if (!selectedAccount) {
            openModal({ message: "연결할 법인 계좌를 선택해주세요." });
            return;
        }
        if (!formData.principalAmount || Number(formData.principalAmount) <= 0) {
            openModal({ message: "유효한 대출 원금(원)을 입력해주세요." });
            return;
        }
        if (!formData.durationMonths || Number(formData.durationMonths) <= 0) {
            openModal({ message: "유효한 대출 기간(개월)을 입력해주세요." });
            return;
        }
        if (!formData.paymentDay || Number(formData.paymentDay) < 1 || Number(formData.paymentDay) > 31) {
            openModal({ message: "유효한 매월 상환일(1~31)을 선택해주세요." });
            return;
        }

        // 명시적 Number 캐스팅 적용
        const payload = {
            userId: Number(selectedTask.userId),
            productId: Number(selectedProduct),
            linkedAccountId: Number(selectedAccount),
            principalAmount: Number(formData.principalAmount),
            durationMonths: Number(formData.durationMonths),
            paymentDay: Number(formData.paymentDay),
            info: ""
        };

        if (selectedTask.taskId) {
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
                    openModal({
                        title: "알림",
                        message: "법인 대출 신청 및 승인이 완료되었습니다.",
                        confirmText: "확인",
                        onConfirm: () => {
                            if (onComplete) {
                                onComplete(payload);
                            } else {
                                onReturnToTaskSelect?.();
                            }
                        }
                    });
                } else {
                    openModal({ message: `대출 승인에 실패했습니다: ${data.message || '알 수 없는 오류'}` });
                }
            } else {
                openModal({ message: `서버 응답 오류로 승인에 실패했습니다. (${response.status})` });
            }
        } catch (error) {
            console.error("대출 승인 처리 중 통신 에러 발생:", error);
            openModal({ message: "통신 오류가 발생했습니다." });
        }
    };

    const formatNumber = (num) => new Intl.NumberFormat('ko-KR').format(num);

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
                <h1 className={styles.headerTitle}>법인 대출 심사</h1>
            </header>

            <div className={styles.formContainer}>
                
                {/* 4. UI 렌더링: 상품 목록 카드 UI */}
                <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>법인 대출 상품 선택</h3>
                    <div className={styles.scrollableList}>
                        {products.length > 0 ? products.map(product => (
                            <div
                                key={product.productId}
                                className={`${styles.cardItem} ${selectedProduct === product.productId ? styles.cardItemSelected : ''}`}
                                onClick={() => setSelectedProduct(product.productId)}
                            >
                                <div className={styles.cardHeader}>
                                    <span className={styles.cardTag}>
                                        {product.productCategory === 'LOAN' ? '법인대출' : product.productCategory}
                                    </span>
                                    {product.baseInterestRate && (
                                        <span className={styles.cardRate}>
                                            연 {product.baseInterestRate}% {product.maxInterestRate && `~ ${product.maxInterestRate}%`}
                                        </span>
                                    )}
                                </div>
                                <h4 className={styles.cardTitle}>{product.productName}</h4>
                                <p className={styles.cardDesc}>{product.description}</p>
                                {product.maxAmount && (
                                    <div className={styles.cardFooter}>
                                        최대한도: <strong>{formatNumber(product.maxAmount)}원</strong>
                                    </div>
                                )}
                            </div>
                        )) : (
                            <div className={styles.emptyMessage}>
                                조회된 대출 상품이 없습니다.
                            </div>
                        )}
                    </div>
                </div>

                {/* UI 렌더링: 연결 계좌 카드 UI */}
                <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>연결 계좌 선택</h3>
                    <div className={styles.scrollableList}>
                        {accounts.length > 0 ? accounts.map(account => (
                            <div
                                key={account.accountId}
                                className={`${styles.cardItem} ${selectedAccount === account.accountId ? styles.cardItemSelected : ''}`}
                                onClick={() => setSelectedAccount(account.accountId)}
                            >
                                <div className={styles.accountCard}>
                                    <div className={styles.accountLeft}>
                                        <span className={styles.accountTag}>
                                            {account.accountType === 'CHECKING' ? '입출금' : account.accountType}
                                        </span>
                                        <div className={styles.accountDetails}>
                                            <span className={styles.accountName}>
                                                {account.accountAlias || account.productName || '법인 계좌'}
                                            </span>
                                            <span className={styles.accountNumber}>
                                                {account.accountNumber}
                                            </span>
                                        </div>
                                    </div>
                                    <div className={styles.accountBalance}>
                                        {formatNumber(account.balance)} 원
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <div className={styles.emptyMessage}>
                                조회 가능한 연결 계좌가 없습니다.
                            </div>
                        )}
                    </div>
                </div>

                {/* UI 렌더링: 입력 폼 섹션 */}
                <div className={styles.section}>
                    <div className={styles.formGrid}>
                        <div className={styles.inputGroup}>
                            <label>대출 원금 (원)</label>
                            <div className={styles.inputWrapper}>
                                <input 
                                    name="principalAmount" 
                                    type="number" 
                                    value={formData.principalAmount} 
                                    onChange={handleChange} 
                                    placeholder="예: 500000000"
                                />
                                <span className={styles.unit}>원</span>
                            </div>
                        </div>

                        <div className={styles.inputGroup}>
                            <label>대출 기간 (개월)</label>
                            <div className={styles.inputWrapper}>
                                <input 
                                    name="durationMonths" 
                                    type="number" 
                                    value={formData.durationMonths} 
                                    onChange={handleChange} 
                                    placeholder="예: 36"
                                />
                                <span className={styles.unit}>개월</span>
                            </div>
                        </div>

                        <div className={styles.inputGroup}>
                            <label>매월 상환일</label>
                            <div className={styles.inputWrapper}>
                                <select 
                                    name="paymentDay" 
                                    value={formData.paymentDay} 
                                    onChange={handleChange} 
                                >
                                    <option value="">선택</option>
                                    {[1, 5, 10, 15, 20, 25].map(day => (
                                        <option key={day} value={day}>매월 {day}일</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 5. 버튼 영역 */}
                <div className={styles.buttonRow}>
                    <button className={styles.btnSubmit} onClick={handleSubmit}>심사 완료/승인</button>
                </div>
            </div>
        </div>
    );
};

export default CorporateLoan;
