import React, { useState, useEffect } from 'react';
import styles from './CorporateAccount.module.css';
import { useModal } from '../../context/ModalContext';

const CorporateAccount = ({ onComplete, selectedTask, taskId }) => {
    const { openModal } = useModal();
    const [corporateProducts, setCorporateProducts] = useState([]);
    const [userInfo, setUserInfo] = useState(null);

    const [formData, setFormData] = useState({
        companyName: selectedTask?.userName || '미등록 법인',
        productId: '',
        accountPassword: '',
        confirmPassword: '',
        accountAlias: '',
        initialDeposit: '0'
    });
    const userId = selectedTask?.userId;

    useEffect(() => {
        if (!userId) return;

        const fetchInitialData = async () => {
            try {
                const [userRes] = await Promise.all([
                    fetch(`/api/user/info?userId=${userId}`),
                ]);

                const userData = await userRes.json();
                if (userData.result === 'SUCCESS') {
                    const { user } = userData;
                    if (user.userType !== 'corporate') {
                        openModal({ title: '알림', message: '개인회원은 이 탭에 접근할 수 없습니다.', onConfirm: onComplete });
                        return;
                    }

                } else { throw new Error('사용자 정보 조회 실패'); }

            } catch (error) {
                console.error("초기 데이터 조회 실패:", error);
                openModal({ title: '알림', message: '데이터를 불러오는중 오류가 발생하였습니다.' });
                return;
            }
        };

        fetchInitialData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    // 1. 법인용 금융상품 목록 조회 (카테고리: CORPORATE)
    useEffect(() => {
        const fetchCorporateProducts = async () => {
            try {
                const response = await fetch('/api/product/list?category=CHECKING&targetType=ALL&targetType=CORPORATE');
                if (response.ok) {
                    const data = await response.json();
                    if (data.result === 'SUCCESS') {
                        setCorporateProducts(data.products || []);
                    }
                }
            } catch (error) {
                console.error("법인 상품 목록 조회 에러:", error);
            }
        };
        fetchCorporateProducts();
    }, []);

    // 2. 고객 정보(사업자등록번호 포함) 조회
    useEffect(() => {
        const fetchUserInfo = async () => {
            if (!selectedTask?.userId) return;
            try {
                const response = await fetch(`/api/user/info?userId=${selectedTask.userId}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.result === 'SUCCESS') {
                        setUserInfo(data.user);
                    }
                }
            } catch (error) {
                console.error("고객 정보 조회 에러:", error);
            }
        };
        fetchUserInfo();
    }, [selectedTask]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async () => {
        if (!formData.productId) {
            openModal({ title: '알림', message: '상품을 선택해주세요.' });
            return;
        }
        if (formData.accountPassword !== formData.confirmPassword) {
            openModal({ title: '알림', message: '비밀번호가 일치하지 않습니다.' });
            return;
        }
        if (!userInfo?.identificationNumber) {
            openModal({ title: '알림', message: '사업자등록번호를 조회할 수 없습니다.' });
            return;
        }

        const requestDto = {
            taskId: taskId || selectedTask?.taskId || null,
            productId: Number(formData.productId),
            amount: parseInt(String(formData.initialDeposit).replace(/,/g, ''), 10) || 0,
            accountPassword: formData.accountPassword,
            accountAlias: formData.accountAlias,
            userId: selectedTask?.userId,
            identificationNumber: userInfo.identificationNumber
        };

        try {
            const response = await fetch('/api/account/corporate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestDto)
            });

            const data = await response.json();
            switch (data.result) {
                case 'SUCCESS':
                    openModal({
                        title: "알림",
                        message: `법인계좌 개설이 승인되었습니다.\n계좌번호: ${data.account?.accountNumber}`,
                        onConfirm: () => onComplete?.()
                    });
                    break;
                case 'FAILURE_USER_NOT_EXIST':
                    openModal({ title: "알림", message: "존재하지 않는 사용자입니다." });
                    break;
                case 'FAILURE_NOT_CORPORATE_USER':
                    openModal({ title: "알림", message: "법인 회원이 아닙니다." });
                    break;
                case 'FAILURE':
                default:
                    openModal({ title: "알림", message: data.message || "계좌 개설에 실패했습니다." });
                    break;
            }
        } catch (error) {
            console.error("네트워크 에러:", error);
            openModal({ title: "오류", message: "네트워크 오류가 발생했습니다." });
        }
    };

    const selectedProduct = corporateProducts.find(p => p.productId === Number(formData.productId));

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
                <h1 className={styles.headerTitle}>법인계좌 개설</h1>
            </header>

            <div className={styles.formContainer}>
                <div className={styles.section}>
                    <div className={styles.labelRow}>
                        <span className={styles.centerLabel}>법인명</span>
                        <span className={styles.rightLabel}>사업자등록번호</span>
                    </div>
                    <div className={styles.inputRow}>
                        <div className={styles.displayBox}>{formData.companyName}</div>
                        <div className={styles.displayBox}>
                            {userInfo?.identificationNumber
                                ? userInfo.identificationNumber.replace(/(\d{3})(\d{2})(\d{5})/, '$1-$2-$3')
                                : '조회 중...'}
                        </div>
                    </div>
                </div>
                <div className={styles.sectionContainer}>
                <div className={styles.section}>
                    <div className={styles.labelRow}>
                        <span className={styles.centerLabel}>계좌 종류 (상품)</span>
                    </div>
                    <div className={styles.inputRow}>
                        <div className={styles.customSelectMain}>
                            <select name="productId" value={formData.productId} onChange={handleChange} required>
                                <option value="">상품을 선택하세요</option>
                                {corporateProducts.map(p => (
                                    <option key={p.productId} value={p.productId}>
                                        {p.productName}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className={styles.section}>
                    <div className={styles.labelRow}>
                        <span className={styles.centerLabel}>계좌 별칭</span>
                    </div>
                    <div className={styles.inputFieldBox}>
                        <input name="accountAlias" placeholder="예: 본사 운영자금" value={formData.accountAlias} onChange={handleChange} />
                    </div>
                </div>
                </div>

                {selectedProduct && (
                    <div className={styles.infoBox}>
                      <strong>기본금리:</strong> 연 {selectedProduct.baseInterestRate}% | <strong>최고금리:</strong> 연 {selectedProduct.maxInterestRate}%<br/>
                      <strong>가입금액:</strong> {selectedProduct.minAmount?.toLocaleString() ?? 0}원 ~ {selectedProduct.maxAmount?.toLocaleString() ?? 0}원<br/>
                      <strong>설명:</strong> {selectedProduct.description}
                    </div>
                )}

                <div className={styles.section}>
                    <div className={styles.gridTwo}>
                        <div className={styles.inputGroup}>
                            <div className={styles.centerLabel}>비밀번호</div>
                            <div className={styles.inputFieldBox}>
                                <input name="accountPassword" type="password" placeholder="●●●●" maxLength="4" value={formData.accountPassword} onChange={handleChange} />
                            </div>
                        </div>
                        <div className={styles.inputGroup}>
                            <div className={styles.centerLabel}>비밀번호 확인</div>
                            <div className={styles.inputFieldBox}>
                                <input name="confirmPassword" type="password" placeholder="●●●●" maxLength="4" value={formData.confirmPassword} onChange={handleChange} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className={styles.section}>
                    <div className={styles.labelRow}><span className={styles.centerLabel}>최초 입금액</span></div>
                    <div className={styles.amountFieldBox}>
                        <input name="initialDeposit" type="text" value={formData.initialDeposit} onChange={handleChange} />
                        <span className={styles.unit}>원</span>
                    </div>
                </div>

                <div className={styles.buttonRow}>
                    <button className={styles.btnSubmit} onClick={handleSubmit} disabled={!formData.productId}>계좌 개설 승인</button>
                </div>
            </div>
        </div>
    );
};

export default CorporateAccount;
