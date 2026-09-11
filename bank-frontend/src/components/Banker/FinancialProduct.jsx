import React, { useCallback, useEffect, useState } from 'react';
import styles from './FinancialProduct.module.css';
import TransFerIcon from '../../images/Banker/transfer.png';
import { useModal } from '../../context/ModalContext';

const FinancialProduct = ({ onSubmit, selectedTask }) => {
    const { openModal } = useModal();

    const showAlert = useCallback((message, onConfirm = null) => {
        openModal({
            message: message,
            onConfirm: onConfirm
        });
    }, [openModal]);

    // 상태 관리
    const [targetType, setTargetType] = useState('INDIVIDUAL');
    const [products, setProducts] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [selectedAccount, setSelectedAccount] = useState(null);
    const [formData, setFormData] = useState({
        principalAmount: '',
        durationMonths: '',
        paymentDay: ''
    });

    // Step 2-1 & 2-3: 고객 유형 식별 및 연결 계좌 조회
    useEffect(() => {
        const fetchUserAndAccounts = async () => {
            const userId = selectedTask?.userId;
            if (!userId) {
                setTargetType('INDIVIDUAL');
                setAccounts([]);
                return;
            }

            try {
                // Step 2-1: 고객 유형 식별
                const userRes = await fetch(`/api/user/info?userId=${userId}`);
                if (userRes.ok) {
                    const userData = await userRes.json();
                    if (userData.result === 'SUCCESS' && userData.user) {
                        const newTargetType = userData.user.userType === 'corporate' ? 'CORPORATE' : 'INDIVIDUAL';
                        setTargetType(newTargetType);
                        setSelectedProduct(null); // 고객 유형 변경 시 상품 선택 초기화
                    }
                } else {
                    console.error("고객 정보 호출 실패:", userRes.status);
                }

                // Step 2-3: 연결 계좌 조회
                const accRes = await fetch(`/api/account/user/${userId}`);
                if (accRes.ok) {
                    const accData = await accRes.json();
                    const accountList = Array.isArray(accData) ? accData : (accData.accounts || []);
                    setAccounts(accountList);
                } else {
                    console.error("계좌 목록 호출 실패:", accRes.status);
                    setAccounts([]);
                }
            } catch (error) {
                console.error("데이터 통신 중 오류 발생:", error);
            }
        };

        fetchUserAndAccounts();
    }, [selectedTask?.userId]);

    // Step 2-2: 대출 상품 목록 조회
    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const url = `/api/product/list?category=LOAN&targetType=${targetType}&targetType=ALL`;
                const response = await fetch(url);
                
                if (response.ok) {
                    const data = await response.json();
                    const productList = data.result === 'SUCCESS' ? data.products : (Array.isArray(data) ? data : []);
                    setProducts(productList || []);
                } else {
                    console.error("상품 목록 호출 실패:", response.status);
                    setProducts([]);
                }
            } catch (error) {
                console.error("상품 목록 조회 중 오류 발생:", error);
                setProducts([]);
            }
        };

        fetchProducts();
    }, [targetType]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleReset = () => {
        setFormData({
            principalAmount: '',
            durationMonths: '',
            paymentDay: ''
        });
        setSelectedProduct(null);
        setSelectedAccount(null);
    };

    // Step 3: 대출 신청 (Submit) 로직
    const handleSubmit = async () => {
        // 필수 값 Validation
        if (!selectedTask?.userId) {
            showAlert('상담 중인 고객 정보(userId)가 없습니다.');
            return;
        }
        if (!selectedProduct) {
            showAlert('가입하실 대출 상품을 선택해주세요.');
            return;
        }
        if (!selectedAccount) {
            showAlert('연결할 계좌를 선택해주세요.');
            return;
        }
        if (!formData.principalAmount || Number(formData.principalAmount) <= 0) {
            showAlert('유효한 대출 원금(원)을 입력해주세요.');
            return;
        }
        if (!formData.durationMonths || Number(formData.durationMonths) <= 0) {
            showAlert('유효한 대출 기간(개월)을 입력해주세요.');
            return;
        }
        if (!formData.paymentDay || Number(formData.paymentDay) < 1 || Number(formData.paymentDay) > 31) {
            showAlert('유효한 매월 상환일(1~31)을 선택하거나 입력해주세요.');
            return;
        }

        const payload = {
            userId: Number(selectedTask.userId),
            productId: Number(selectedProduct),
            linkedAccountId: Number(selectedAccount),
            principalAmount: Number(formData.principalAmount),
            durationMonths: Number(formData.durationMonths),
            paymentDay: Number(formData.paymentDay),
            info: "" // 백엔드 로직 안전성을 위해 빈 문자열 추가
        };

        // 백엔드의 NullPointerException 방지를 위해 taskId가 있을 때만 페이로드에 추가
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
                    showAlert('대출 상품 신청이 완료되었습니다.', () => {
                        onSubmit?.(payload);
                    });
                } else if(data.result === 'FAILURE_INVALID_AMOUNT') {
                    showAlert('올바르지않은 대출 원금입니다.');

                } else if ( data.result === 'FAILURE_INVALID_ACCOUNT') {
                    showAlert('올바르지않은 계좌입니다.')
                }
                else showAlert(`대출 신청에 실패했습니다: ${data.message || '알 수 없는 오류'}`);
            } else {
                showAlert(`서버 응답 오류로 신청에 실패했습니다. (${response.status})`);
            }
        } catch (error) {
            console.error("대출 신청 처리 중 통신 에러 발생:", error);
            showAlert('통신 오류가 발생했습니다.');
        }
    };

    const formatNumber = (num) => new Intl.NumberFormat('ko-KR').format(num);

    return (
        <div className={styles.container}>
            {/* 1. 상단 타이틀 */}
            <div className={styles.headerTitle}>
                <span><img className={styles.icon} src={TransFerIcon} alt="금융상품가입"/></span> 대출 상품 가입
            </div>

            {/* 2. 금융 상품 목록 그리드 (스크롤 추가) */}
            <div className={styles.productGrid} style={{ minHeight: '150px', maxHeight: '300px', overflowY: 'auto' }}>
                {products.length > 0 ? (
                    products.map(product => (
                        <div
                            key={product.productId}
                            className={`${styles.productCard} ${selectedProduct === product.productId ? styles.selected : ''}`}
                            onClick={() => setSelectedProduct(product.productId)}
                        >
                            <span className={styles.tag}>
                                {product.productCategory === 'LOAN' ? '대출' : product.productCategory}
                            </span>
                            <div className={styles.productInfo}>
                                <h3 className={styles.productName}>{product.productName}</h3>
                                <p className={styles.productDesc}>{product.description}</p>
                            </div>
                            {product.baseInterestRate && (
                                <span className={styles.rateHighlight}>
                                    기본 연 {product.baseInterestRate}% 
                                    {product.maxInterestRate && ` ~ 최고 연 ${product.maxInterestRate}%`}
                                </span>
                            )}
                            {product.maxAmount && (
                                <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '8px' }}>
                                    최대한도: {formatNumber(product.maxAmount)}원
                                </div>
                            )}
                        </div>
                    ))
                ) : (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#888', gridColumn: '1 / -1' }}>
                        조회된 대출 상품이 없습니다.
                    </div>
                )}
            </div>

            {/* 3. 연결 계좌 선택 (스크롤 추가) */}
            <div className={styles.accountSection}>
                <div className={styles.sectionLabel}>연결 계좌 선택</div>
                <div className={styles.accountList} style={{ minHeight: '100px', maxHeight: '200px', overflowY: 'auto' }}>
                    {accounts.length > 0 ? (
                        accounts.map(account => (
                            <div
                                key={account.accountId}
                                className={`${styles.accountCard} ${selectedAccount === account.accountId ? styles.selected : ''}`}
                                onClick={() => setSelectedAccount(account.accountId)}
                            >
                                <div className={styles.accountLeft}>
                                    <span className={styles.tag}>
                                        {account.accountType === 'CHECKING' ? '입출금' : account.accountType}
                                    </span>
                                    <div className={styles.accountDetails}>
                                        <span className={styles.accountName}>
                                            {account.accountAlias || account.productName || '알 수 없는 계좌'}
                                        </span>
                                        <span className={styles.accountNumber}>{account.accountNumber}</span>
                                    </div>
                                </div>
                                <div className={styles.accountRight}>
                                    {formatNumber(account.balance)} 원
                                </div>
                            </div>
                        ))
                    ) : (
                        <div style={{ textAlign: 'center', padding: '20px', color: '#888'}}>
                            조회 가능한 연결 계좌가 없습니다.
                        </div>
                    )}
                </div>
            </div>

            {/* 4. 입력 폼 (대출 원금, 대출 기간, 매월 상환일) */}
            <div className={styles.inputFormRow} style={{ flexWrap: 'wrap', gap: '15px' }}>
                <div className={styles.inputGroup} style={{ flex: '1 1 30%' }}>
                    <label>대출 원금</label>
                    <div className={styles.amountInputWrap}>
                        <input
                            type="number"
                            name="principalAmount"
                            value={formData.principalAmount}
                            onChange={handleChange}
                            placeholder="예: 10000000"
                        />
                        <span className={styles.unit}>원</span>
                    </div>
                </div>

                <div className={styles.inputGroup} style={{ flex: '1 1 30%' }}>
                    <label>대출 기간</label>
                    <div className={styles.amountInputWrap}>
                        <input
                            type="number"
                            name="durationMonths"
                            value={formData.durationMonths}
                            onChange={handleChange}
                            placeholder="예: 24"
                        />
                        <span className={styles.unit}>개월</span>
                    </div>
                </div>

                <div className={styles.inputGroup} style={{ flex: '1 1 30%' }}>
                    <label>매월 상환일</label>
                    <select 
                        name="paymentDay" 
                        value={formData.paymentDay} 
                        onChange={handleChange} 
                        className={styles.dateSelect}
                        style={{ width: '100%', height: '40px', borderRadius: '4px', border: '1px solid #ccc' }}
                    >
                        <option value="">상환일 선택</option>
                        {[1, 5, 10, 15, 20, 25].map(day => (
                            <option key={day} value={day}>매월 {day}일</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* 5. 하단 버튼 영역 */}
            <div className={styles.buttonRow}>
                <div className={styles.rightActions}>
                    <button className={styles.btnReset} onClick={handleReset}>초기화</button>
                    <button className={styles.btnSubmit} onClick={handleSubmit}>신청 확정</button>
                </div>
            </div>
        </div>
    );
};

export default FinancialProduct;
