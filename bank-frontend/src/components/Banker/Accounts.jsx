/* eslint-disable no-unused-vars */
import React, {useState, useEffect, useCallback} from "react";
import styles from "./Accounts.module.css";
import { useAuth } from '../../context/AuthContext';
import { useModal } from '../../context/ModalContext';

const Accounts = ({ onCreate, selectedTask }) => {
    const { openModal } = useModal();

    const showAlert = useCallback((message, onConfirm = null) => {
        openModal({
            message: message,
            onConfirm: onConfirm
        });
    }, [openModal]);
    // 1. 상태 관리
    const { user } = useAuth(); // Banker의 user 정보 (로그인한 행원)
    const [activeTab, setActiveTab] = useState("예금 계좌");
    
    // 고객의 userType에 따라 customerType 초기값 설정 (기본은 '개인')
    const [customerType, setCustomerType] = useState("개인"); 

    const [depositProducts, setDepositProducts] = useState([]);
    const [savingsProducts, setSavingsProducts] = useState([]);
    const [selectedProductId, setSelectedProductId] = useState("");
    const [userAccounts, setUserAccounts] = useState([]);

    const [formData, setFormData] = useState({
        amount: "",
        accountAlias: "",
        accountPassword: "",
        confirmPassword: "",
        durationMonths: "",
        linkedAccount: "", // 연결계좌 (공통) - accountId
        linkedAccountNumber: "", // 연결계좌 계좌번호 (적금)
        linkedAccountPassword: "", // 연결계좌 비밀번호 (적금)
        autoTransferDate: "1" // 자동이체 약정일 (적금)
    });

    const tabs = ["예금 계좌", "적금 계좌"];

    // 💡 selectedTask.userId 변경 시 고객 유형 자동 식별 및 상품 목록 초기화
    useEffect(() => {
        const fetchCustomerType = async () => {
            const userId = selectedTask?.userId;
            if (!userId) {
                setCustomerType("개인"); // userId가 없으면 기본값으로 초기화
                setSelectedProductId(""); // 상품 선택 초기화
                return;
            }

            try {
                const response = await fetch(`/api/user/info?userId=${userId}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.result === 'SUCCESS' && data.user) {
                        const newCustomerType = data.user.userType === 'corporate' ? '법인' : '개인';
                        setCustomerType(newCustomerType);
                        setSelectedProductId(""); // 고객 유형 변경 시 상품 선택 초기화
                    } else {
                        console.error("고객 정보 조회 실패:", data.message);
                        setCustomerType("개인"); // 실패 시 기본값
                        setSelectedProductId("");
                    }
                } else {
                    console.error("고객 정보 API 호출 실패:", response.status);
                    setCustomerType("개인"); // 실패 시 기본값
                    setSelectedProductId("");
                }
            } catch (error) {
                console.error("고객 정보 조회 중 에러 발생:", error);
                setCustomerType("개인"); // 에러 시 기본값
                setSelectedProductId("");
            }
        };

        fetchCustomerType();
    }, [selectedTask?.userId]); // selectedTask.userId를 의존성 배열에 포함

// 2. 상품 목록 비동기 조회 (customerType 변경 시 연쇄 반응)
    useEffect(() => {
        const fetchProducts = async () => {
            setSelectedProductId(""); // 상품 목록 로드 전 선택된 상품 초기화
            try {
                // UI 상태값을 API 파라미터로 변환
                const targetType = customerType === "개인" ? "INDIVIDUAL" : "CORPORATE";

                // 예금 상품 조회 (targetType 동적 적용)
                const depRes = await fetch(`/api/product/list?category=DEPOSIT&targetType=${targetType}&targetType=ALL`); // &targetType=ALL 제거
                if (depRes.ok) {
                    const depData = await depRes.json();
                    if (depData.result === 'SUCCESS') {
                        setDepositProducts(depData.products || []);
                    }
                } else {
                    setDepositProducts([]);
                }

                // 적금 상품 조회 (targetType 동적 적용)
                const savRes = await fetch(`/api/product/list?category=SAVINGS&targetType=${targetType}&targetType=ALL`);
                if (savRes.ok) {
                    const savData = await savRes.json();
                    if (savData.result === 'SUCCESS') {
                        setSavingsProducts(savData.products || []);
                    }
                } else {
                    setSavingsProducts([]);
                }
            } catch (error) {
                console.error("상품 목록 조회 실패:", error);
                setDepositProducts([]);
                setSavingsProducts([]);
            }
        };

        fetchProducts().catch(console.error);
    }, [customerType]); // 💡 customerType이 변경될 때마다 상품 목록을 새로 고침

    // 탭 변경 시 선택된 상품 및 입력값 초기화
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelectedProductId("");
        setFormData(prev => ({
            ...prev,
            amount: "",
            durationMonths: "",
            linkedAccount: "",
            linkedAccountNumber: "",
            linkedAccountPassword: "",
            autoTransferDate: "1"
        }));
    }, [activeTab]);


    useEffect(() => {
        const getUserAccounts = async () => {
            const userId = selectedTask?.userId;
            if (userId) {
                try {
                    const response = await fetch(`/api/account/user/${userId}`);
                    if (response.ok) {
                        const rawData = await response.json();
                        const data = Array.isArray(rawData) ? rawData : rawData.accounts || [];
                        
                        // 💡 JSON 응답에서 accounts 배열을 순회하여 매핑하는 코드
                        const mappedAccounts = data.map(account => ({
                            linkedAccount: account.accountId,
                            linkedAccountNumber: account.accountNumber,
                            accountAlias: account.accountAlias,
                            balance: account.balance
                        }));
                        
                        setUserAccounts(mappedAccounts);

                        if (mappedAccounts.length > 0) {
                            setFormData(prev => ({
                                ...prev,

                                // 적금 탭이 아닌 경우 linkedAccountNumber는 초기화 상태 유지
                                linkedAccountNumber: activeTab === "적금 계좌" ? mappedAccounts.linkedAccountNumber : ""
                            }));
                        }
                    } else {
                        setUserAccounts([]);
                        setFormData(prev => ({
                            ...prev,
                            linkedAccount: "",
                            linkedAccountNumber: ""
                        }));
                    }
                } catch (error) {
                    console.error("계좌 목록 로드 에러:", error);
                    setUserAccounts([]);
                    setFormData(prev => ({
                        ...prev,
                        linkedAccount: "",
                        linkedAccountNumber: ""
                    }));
                }
            } else {
                setUserAccounts([]);
                setFormData(prev => ({
                    ...prev,
                    linkedAccount: "",
                    linkedAccountNumber: ""
                }));
            }
        };
        getUserAccounts();
    }, [selectedTask?.userId, activeTab]); // activeTab을 의존성 배열에 추가

    const currentProducts = activeTab === "예금 계좌" ? depositProducts : savingsProducts;
    const selectedProduct = currentProducts.find(p => p.productId === Number(selectedProductId));

    // 입력값 변경 핸들러
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // 연결계좌 선택 핸들러
    const handleLinkedAccountChange = (e) => {
        const selectedAccountId = e.target.value;
        setFormData(prev => ({ ...prev, linkedAccount: selectedAccountId }));

        if (activeTab === "적금 계좌") {
            const selectedAcc = userAccounts.find(acc => acc.linkedAccount === Number(selectedAccountId));
            if (selectedAcc) {
                setFormData(prev => ({ ...prev, linkedAccountNumber: selectedAcc.linkedAccountNumber }));
            } else {
                setFormData(prev => ({ ...prev, linkedAccountNumber: "" }));
            }
        }
    };

    // 3. 계좌 개설 로직 분리
    const createDepositAccount = async (payload) => {
        return fetch('/api/account/deposit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    };

    const createSavingsAccount = async (payload) => {
        return fetch('/api/account/savings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    };

    // 4. Submit 핸들러 및 DTO 매핑
    const handleSubmit = async () => {
        if (!selectedProductId) {
            showAlert("상품을 선택해주세요.");
            return;
        }
        if (formData.accountPassword !== formData.confirmPassword) {
            showAlert("비밀번호와 비밀번호 확인이 일치하지 않습니다.");
            return;
        }
        
        const duration = Number(formData.durationMonths);
        if (!duration || duration < selectedProduct.minDurationMonths || duration > selectedProduct.maxDurationMonths) {
            showAlert(`가입 기간은 ${selectedProduct.minDurationMonths}개월에서 ${selectedProduct.maxDurationMonths}개월 사이여야 합니다.`);
            return;
        }

        const amount = Number(formData.amount);
        if (amount < selectedProduct.minAmount || amount > selectedProduct.maxAmount) {
            showAlert(`가입 금액은 ${selectedProduct.minAmount.toLocaleString()}원에서 ${selectedProduct.maxAmount.toLocaleString()}원 사이여야 합니다.`);
            return;
        }

        let payload;
        if (activeTab === "예금 계좌") {
            payload = {
                taskId: selectedTask?.taskId || null,
                productId: Number(selectedProductId),
                amount: amount,                            // 예금은 amount
                durationMonths: duration,                  // 예금은 durationMonths
                accountPassword: formData.accountPassword,
                accountAlias: formData.accountAlias,
                userId: selectedTask?.userId || null,
                linkedAccountId: Number(formData.linkedAccount), // 공통: 이름 맞춤
                maturityTreatment: "AUTO_TERMINATE"              // 예금 필수 추가값
            };
        } else {
            payload = {
                taskId: selectedTask?.taskId || null,
                productId: Number(selectedProductId),
                installmentAmount: amount,                 // 💡 적금은 installmentAmount
                termMonths: duration,                      // 💡 적금은 termMonths
                accountPassword: formData.accountPassword,
                accountAlias: formData.accountAlias,
                userId: selectedTask?.userId || null,
                linkedAccountId: Number(formData.linkedAccount), // 공통: 이름 맞춤
                linkedAccountNumber: formData.linkedAccountNumber,
                linkedAccountPassword: formData.linkedAccountPassword,
                paymentDay: Number(formData.autoTransferDate)    // 💡 적금은 paymentDay
            };
        }
        try {
            let response;
            if (activeTab === "예금 계좌") {
                response = await createDepositAccount(payload);
            } else {
                response = await createSavingsAccount(payload);
            }

            const data = await response.json();
            // 5. 응답 결과 처리 분기
            switch (data.result) {
                case 'SUCCESS':
                    showAlert('계좌가 성공적으로 개설되었습니다.', () => {
                        onCreate?.(data);
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
        } catch (error) {
            console.error("계좌 개설 처리 중 에러 발생:", error);
            showAlert("서버와 통신 중 오류가 발생했습니다.");
        }
    };

    return (
        <div className={styles.accountsContainer}>
            {/* 상단 탭 메뉴 */}
            <div className={styles.tabContainer}>
                {tabs.map((tab) => (
                    <div
                        key={tab}
                        className={`${styles.tab} ${activeTab === tab ? styles.activeTab : ""}`}
                        onClick={() => setActiveTab(tab)}
                    >
                        {tab}
                    </div>
                ))}
            </div>

            {/* 입력 폼 영역 */}
            <div className={styles.formGrid}>
                {/* 1행: 이름, 주민등록번호, 계좌별칭 */}
                <div className={styles.inputGroup}>
                    <label>이름</label>
                    <input type="text" value={selectedTask?.userName || "고객명"} disabled className={styles.input} />
                    <div className={styles.radioGroup}>
                        <label>
                            <input
                                type="radio"
                                name="customerType"
                                checked={customerType === "개인"}
                                onChange={() => setCustomerType("개인")}
                            />
                            개인
                        </label>
                        <label>
                            <input
                                type="radio"
                                name="customerType"
                                checked={customerType === "법인"}
                                onChange={() => setCustomerType("법인")}
                            />
                            법인
                        </label>
                    </div>
                </div>

                <div className={styles.inputGroup}>
                    <label>주민등록번호</label>
                    <span className={styles.input}>701012-1324567</span> {/* 주민번호 마스킹 유지 */}
                </div>

                <div className={`${styles.inputGroup} ${styles.alignRight}`}>
                    <label>계좌 별칭</label>
                    <input 
                        type="text" 
                        name="accountAlias"
                        value={formData.accountAlias || ""}
                        onChange={handleChange}
                        placeholder="예: 내 집 마련 통장" 
                        className={styles.input} 
                    />
                </div>

                {/* 2행: 상품 선택 및 금리 안내 (2칸 차지), 최초 입금액 */}
                <div className={`${styles.inputGroup} ${styles.colSpan2}`}>
                    <label>상품 선택</label>
                    <select 
                        className={styles.select} 
                        value={selectedProductId}
                        onChange={(e) => setSelectedProductId(e.target.value)}
                    >
                        <option value="">상품을 선택해주세요</option>
                        {currentProducts.map(product => (
                            <option key={product.productId} value={product.productId || ""}>
                                {product.productName}
                            </option>
                        ))}
                    </select>
                    
                    {/* 선택된 상품의 상세 정보 표시 */}
                    <div className={styles.infoBox} style={{ whiteSpace: "pre-line", fontSize: "0.85rem", lineHeight: "1.5" }}>
                        {selectedProduct ? (
                            <>
                                <strong>기본금리:</strong> 연 {selectedProduct.baseInterestRate}% | <strong>최고금리:</strong> 연 {selectedProduct.maxInterestRate}%<br/>
                                <strong>가입기간:</strong> {selectedProduct.minDurationMonths}개월 ~ {selectedProduct.maxDurationMonths}개월<br/>
                                <strong>가입금액:</strong> {selectedProduct.minAmount?.toLocaleString() ?? 0}원 ~ {selectedProduct.maxAmount?.toLocaleString() ?? 0}원<br/>
                                <strong>설명:</strong> {selectedProduct.description}
                            </>
                        ) : (
                            "원하시는 상품을 선택하면 상세 정보가 여기에 표시됩니다."
                        )}
                    </div>
                </div>

                {/* 예금/적금에 따른 입금액 라벨 및 안내 문구 */}
                <div className={styles.inputGroup}>
                    <label>{activeTab === "예금 계좌" ? "최초 입금액 (원)" : "월 납입액 (원)"}</label>
                    <input 
                        type="number" 
                        name="amount"
                        value={formData.amount || ""}
                        onChange={handleChange}
                        placeholder="금액 입력" 
                        className={styles.input} 
                    />
                    {activeTab === "적금 계좌" && (
                        <small style={{ color: "#666", display: "block", marginTop: "4px", fontSize: "0.75rem" }}>
                            가입 시 연결계좌에서 최초입금됩니다.
                        </small>
                    )}
                </div>

                {/* 3행: 계좌 비밀번호, 계좌 비밀번호 확인, 가입 기간 */}
                <div className={styles.inputGroup}>
                    <label>계좌 비밀번호</label>
                    <input 
                        type="password" 
                        name="accountPassword"
                        value={formData.accountPassword || ""}
                        onChange={handleChange}
                        maxLength="4"
                        placeholder="●●●●" 
                        className={styles.input} 
                    />
                </div>

                <div className={styles.inputGroup}>
                    <label>계좌 비밀번호 확인</label>
                    <input 
                        type="password" 
                        name="confirmPassword"
                        value={formData.confirmPassword || ""}
                        onChange={handleChange}
                        maxLength="4"
                        placeholder="●●●●" 
                        className={styles.input} 
                    />
                </div>

                <div className={styles.inputGroup}>
                    <label>가입 기간 (개월)</label>
                    <input 
                        type="number" 
                        name="durationMonths"
                        value={formData.durationMonths || ""}
                        onChange={handleChange}
                        placeholder="가입 기간(개월) 입력" 
                        className={styles.input} 
                    />
                </div>

                {/* 연결계좌 (공통) */}
                <div className={styles.inputGroup}>
                    <label>연결계좌</label>
                    <select 
                        name="linkedAccount"
                        value={formData.linkedAccount || ""}
                        onChange={handleLinkedAccountChange} // 새로운 핸들러 사용
                        className={styles.select}
                    >
                        <option value="">연결할 계좌를 선택해주세요</option>
                        {userAccounts.map(account => (
                            <option key={account.linkedAccount} value={account.linkedAccount || ""}>
                                {account.accountAlias} ({account.linkedAccountNumber})
                            </option>
                        ))}
                    </select>
                </div>

                {/* 적금에만 존재하는 필드들 */}
                {activeTab === "적금 계좌" && (
                    <>
                        <div className={styles.inputGroup}>
                            <label>연결계좌 계좌번호</label>
                            <input 
                                type="text" 
                                name="linkedAccountNumber"
                                value={formData.linkedAccountNumber || ""}
                                onChange={handleChange} // readOnly이므로 직접 수정은 안되지만, 혹시 모를 경우를 대비
                                placeholder="계좌번호 자동 입력" 
                                className={styles.input}
                                readOnly // 수정 불가능하게 설정
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label>연결계좌 비밀번호</label>
                            <input 
                                type="password" 
                                name="linkedAccountPassword"
                                value={formData.linkedAccountPassword || ""}
                                onChange={handleChange}
                                maxLength="4"
                                placeholder="●●●●" 
                                className={styles.input} 
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label>자동이체 약정일</label>
                            <select 
                                name="autoTransferDate"
                                value={formData.autoTransferDate || ""}
                                onChange={handleChange}
                                className={styles.select}
                            >
                                <option value="1">매월 1일</option>
                                <option value="5">매월 5일</option>
                                <option value="10">매월 10일</option>
                                <option value="15">매월 15일</option>
                                <option value="20">매월 20일</option>
                                <option value="25">매월 25일</option>
                            </select>
                        </div>
                    </>
                )}
            </div>

            <div className={styles.accountBtnRow}>
                <button className={styles.btnCreate} onClick={handleSubmit}>
                    계좌 개설
                </button>
            </div>
        </div>
    );
};

export default Accounts;
