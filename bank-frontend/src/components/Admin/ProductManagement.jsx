import React, { useState, useEffect } from 'react';
import styles from './ProductManagement.module.css';
import { useModal } from '../../context/ModalContext'; 
import Loading from '../common/Loading'; 

const ProductManagement = () => {
    const { openModal } = useModal(); 
    const [activeTab, setActiveTab] = useState('CHECKING');
    const [productList, setProductList] = useState([]);
    const [isLoading, setIsLoading] = useState(false); 
    const [checkedItems, setCheckedItems] = useState([]);

    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);

    const categories = [
        { id: 'CHECKING', label: '일반예금' },
        { id: 'DEPOSIT', label: '정기예금' },
        { id: 'SAVINGS', label: '정기적금' },
        { id: 'LOAN', label: '대출' },
    ];

    const initialFormState = {
        productCategory: 'DEPOSIT',
        productName: '',
        targetType: 'ALL',
        minDurationMonths: 0,
        maxDurationMonths: 0,
        minAmount: 0,
        maxAmount: 0,
        minAge: 0,
        maxAge: 0,
        baseInterestRate: 0.0,
        maxInterestRate: 0.0,     
        interestType: '단리',    
        isActive: true,         
        description: ''
    };

    const [formData, setFormData] = useState(initialFormState);


    const fetchProducts = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/product/list?category=${activeTab}`);
            const data = await response.json();
            
            switch (data.result) {
                case 'SUCCESS':
                    setProductList(data.products || []);
                    break;
                case 'FAILURE_SESSION':
                    openModal({ message: "세션이 만료되었습니다. 다시 로그인해주세요.", confirmText: "확인" });
                    break;
                default:
                    openModal({ message: "상품 목록을 불러오는데 실패했습니다.", confirmText: "확인" });
                    break;
            }
        } catch (error) {
            console.error("상품 조회 에러:", error);
            openModal({ message: "서버와 통신 중 오류가 발생했습니다.", confirmText: "확인" });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchProducts();
        setCheckedItems([]); 
    }, [activeTab]);

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        
        let processedValue = value;
        if (type === 'checkbox') {
            processedValue = checked;
        } else if (type === 'number') {
            processedValue = Number(value);
        } else if (value === 'true') {
            processedValue = true;
        } else if (value === 'false') {
            processedValue = false;
        }

        setFormData(prev => ({
            ...prev,
            [name]: processedValue
        }));
    };

    const handleCheck = (id) => {
        setCheckedItems(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
    };
    
    const handleCheckAll = (e) => {
        setCheckedItems(e.target.checked ? productList.map(item => item.productId) : []);
    };

    const handleSubmit = async () => {
        if (!formData.productName) {
            openModal({ message: "상품명을 입력해주세요.", confirmText: "확인" });
            return;
        }

        setIsLoading(true);
        const isEdit = selectedItem !== null;
        
        try {
            const url = isEdit ? `/api/product/${formData.productId}` : '/api/product/';
            const method = isEdit ? 'PATCH' : 'POST';
            
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await response.json();

            switch (data.result) {
                case 'SUCCESS':
                    setIsFormModalOpen(false); 
                    openModal({
                        message: isEdit ? "상품 정보가 수정되었습니다." : "상품이 등록되었습니다.",
                        confirmText: "확인",
                        onConfirm: () => fetchProducts()
                    });
                    break;
                case 'FAILURE_SESSION':
                    openModal({ message: "세션이 만료되었습니다. 다시 로그인해주세요.", confirmText: "확인" });
                    break;
                case 'FAILURE_UNAUTHORIZED':
                    openModal({ message: "관리자 권한이 필요합니다.", confirmText: "확인" });
                    break;
                default:
                    openModal({ message: "상품 처리에 실패했습니다.", confirmText: "확인" });
                    break;
            }
        } catch (error) {
            console.error("상품 저장 에러:", error);
            openModal({ message: "서버와 통신 중 오류가 발생했습니다.", confirmText: "확인" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = (id) => {
        openModal({
            message: "정말로 이 상품을 삭제하시겠습니까?",
            confirmText: "삭제",
            cancelText: "취소",
            onConfirm: async () => {
                setIsLoading(true);
                try {
                    const response = await fetch(`/api/product/${id}`, {
                        method: 'DELETE'
                    });
                    const data = await response.json();

                    switch (data.result) {
                        case 'SUCCESS':
                            setProductList(prev => prev.filter(item => item.productId !== id));
                            openModal({ message: "삭제되었습니다.", confirmText: "확인" });
                            break;
                        case 'FAILURE_SESSION':
                            openModal({ message: "세션이 만료되었습니다. 다시 로그인해주세요.", confirmText: "확인" });
                            break;
                        default:
                            openModal({ message: "상품 삭제에 실패했습니다.", confirmText: "확인" });
                            break;
                    }
                } catch (error) {
                    console.error("상품 삭제 에러:", error);
                    openModal({ message: "서버와 통신 중 오류가 발생했습니다.", confirmText: "확인" });
                } finally {
                    setIsLoading(false);
                }
            }
        });
    };

    const handleWriteClick = () => {
        setFormData({ ...initialFormState, productCategory: activeTab });
        setSelectedItem(null); 
        setIsFormModalOpen(true);
    };

    const handleEditClick = async (item) => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/product/${item.productId}`);
            const data = await response.json();
            
            switch (data.result) {
                case 'SUCCESS':
                    setSelectedItem(data.product);
                    setFormData({ ...data.product });
                    setIsFormModalOpen(true);
                    break;
                case 'FAILURE_PRODUCT_NOT_FOUND':
                    openModal({ message: "상품을 찾을 수 없습니다.", confirmText: "확인" });
                    break;
                default:
                    openModal({ message: "상품 정보를 불러오는데 실패했습니다.", confirmText: "확인" });
                    break;
            }
        } catch (error) {
            console.error("상품 상세 조회 에러:", error);
            openModal({ message: "서버와 통신 중 오류가 발생했습니다.", confirmText: "확인" });
        } finally {
            setIsLoading(false);
        }
    };
    const getTargetTypeName = (type) => {
        switch(type) {
            case 'INDIVIDUAL': return '개인';
            case 'CORPORATE': return '법인';
            case 'ALL': return '공통';
            default: return '계좌';
        }
    };
    return (
        <>
            {isLoading && <Loading message="데이터를 처리 중입니다..." />}

            <div className={styles.container}>
                <div className={styles.header}>
                    <h2 className={styles.pageTitle}>금융 상품 관리</h2>
                </div>

                <div className={styles.searchAndTabRow}>
                    <div className={styles.tabContainer}>
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                className={`${styles.tabBtn} ${activeTab === cat.id ? styles.activeTab : ''}`}
                                onClick={() => setActiveTab(cat.id)}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>
                    
                    <div className={styles.actionButtons}>
                        <button className={styles.outlineBtn}>- 삭제</button>
                        <button className={styles.primaryBtn} onClick={handleWriteClick}>+ 추가</button>
                    </div>
                </div>

                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th width="4%">
                                    <input type="checkbox" onChange={handleCheckAll} checked={checkedItems.length === productList.length && productList.length > 0} />
                                </th>
                                <th width="15%" className={styles.leftAlign}>상품명</th>
                                <th width="7%">대상</th>
                                <th width="9%">가입 기간</th>
                                <th width="13%">가입 금액</th>
                                <th width="9%">가입 나이</th>
                                <th width="8%">기본금리</th>
                                <th width="8%">최고금리</th>
                                <th width="8%">이자방식</th>
                                <th width="7%">상태</th>
                                <th width="9%">관리</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!isLoading && productList.length > 0 ? (
                                productList.map((item) => (
                                    <tr key={item.productId} className={checkedItems.includes(item.productId) ? styles.selectedRow : ''}>
                                        <td>
                                            <input type="checkbox" checked={checkedItems.includes(item.productId)} onChange={() => handleCheck(item.productId)} />
                                        </td>
                                        <td className={`${styles.leftAlign} ${styles.productName}`}>{item.productName}</td>
                                        <td className={styles.subText}>{getTargetTypeName(item.targetType) || '개인'}</td>
                                        <td className={styles.subText}>{item.minDurationMonths} ~ {item.maxDurationMonths}개월</td>
                                        <td className={styles.subText}>
                                            {item.minAmount ? (item.minAmount / 10000).toLocaleString() : 0}만 ~ {item.maxAmount ? (item.maxAmount / 10000).toLocaleString() : 0}만
                                        </td>
                                        <td className={styles.subText}>
                                            {(item.minAge || item.maxAge)
                                                ? `${item.minAge || 0} ~ ${item.maxAge || '제한없음'}세`
                                                : '제한없음'}
                                        </td>
                                        <td className={styles.baseRate}>{item.baseInterestRate?.toFixed(2) || '0.00'}%</td>
                                        <td className={styles.maxRate}>{item.maxInterestRate?.toFixed(2) || '0.00'}%</td>
                                        <td><span className={styles.typeBadge}>{item.interestType || '단리'}</span></td>
                                        <td>
                                            <span className={`${styles.statusBadge} ${item.isActive ? styles.active : styles.inactive}`}>
                                                {item.isActive ? '판매중' : '판매종료'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className={styles.manageBtns}>
                                                <button className={styles.textBtn} onClick={() => handleEditClick(item)}>수정</button>
                                                <span className={styles.divider}>|</span>
                                                <button className={`${styles.textBtn} ${styles.deleteText}`} onClick={() => handleDelete(item.productId)}>삭제</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : !isLoading ? (
                                <tr><td colSpan="11" className={styles.empty}>등록된 상품이 없습니다.</td></tr>
                            ) : null}
                        </tbody>
                    </table>
                </div>

                {isFormModalOpen && (
                    <div className={styles.adminModalOverlay}>
                        <div className={styles.adminModalBox}>
                            <div className={styles.adminModalHeader}>
                                {selectedItem ? "상품 정보 수정" : "상품 등록"}
                            </div>
                            
                            <div className={styles.adminModalBody}>
                                <div className={styles.adminFormGrid}>
                                    <div className={`${styles.adminFormRow} ${styles.fullWidthRow}`}>
                                        <label>상품명</label>
                                        <input type="text" name="productName" value={formData.productName} onChange={handleInputChange} placeholder="예) KB Star 정기예금" />
                                    </div>

                                    <div className={styles.adminFormRow}>
                                        <label>상품 카테고리</label>
                                        <select name="productCategory" value={formData.productCategory} onChange={handleInputChange}>
                                            {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                        </select>
                                    </div>
                                    <div className={styles.adminFormRow}>
                                        <label>상태</label>
                                        <select name="isActive" value={formData.isActive} onChange={handleInputChange}>
                                            <option value={true}>활성화 (판매중)</option>
                                            <option value={false}>비활성화 (판매종료)</option>
                                        </select>
                                    </div>

                                    <div className={styles.adminFormRow}>
                                        <label>가입 대상</label>
                                        <select name="targetType" value={formData.targetType} onChange={handleInputChange}>
                                            <option value="INDIVIDUAL">개인</option>
                                            <option value="CORPORATE">법인</option>
                                            <option value="ALL">공통</option>
                                        </select>
                                    </div>
                                    <div className={styles.adminFormRow}>
                                        <label>이자 방식</label>
                                        <select name="interestType" value={formData.interestType || '단리'} onChange={handleInputChange}>
                                            <option value="단리">단리</option>
                                            <option value="복리">복리</option>
                                        </select>
                                    </div>

                                    <div className={styles.adminFormRow}>
                                        <label>기본 금리(%)</label>
                                        <input type="number" step="0.01" name="baseInterestRate" value={formData.baseInterestRate} onChange={handleInputChange} />
                                    </div>
                                    <div className={styles.adminFormRow}>
                                        <label>최고 금리(%)</label>
                                        <input type="number" step="0.01" name="maxInterestRate" value={formData.maxInterestRate} onChange={handleInputChange} />
                                    </div>

                                    <div className={styles.adminFormRow}>
                                        <label>최소 가입기간(월)</label>
                                        <input type="number" name="minDurationMonths" value={formData.minDurationMonths} onChange={handleInputChange} />
                                    </div>
                                    <div className={styles.adminFormRow}>
                                        <label>최대 가입기간(월)</label>
                                        <input type="number" name="maxDurationMonths" value={formData.maxDurationMonths} onChange={handleInputChange} />
                                    </div>

                                    <div className={styles.adminFormRow}>
                                        <label>최소 가입금액(원)</label>
                                        <input type="number" name="minAmount" value={formData.minAmount} onChange={handleInputChange} />
                                    </div>
                                    <div className={styles.adminFormRow}>
                                        <label>최대 가입금액(원)</label>
                                        <input type="number" name="maxAmount" value={formData.maxAmount} onChange={handleInputChange} />
                                    </div>

                                    <div className={styles.adminFormRow}>
                                        <label>최소 가입나이(세)</label>
                                        <input type="number" name="minAge" value={formData.minAge ?? 0} onChange={handleInputChange} placeholder="0 = 제한 없음" />
                                    </div>
                                    <div className={styles.adminFormRow}>
                                        <label>최대 가입나이(세)</label>
                                        <input type="number" name="maxAge" value={formData.maxAge ?? 0} onChange={handleInputChange} placeholder="0 = 제한 없음" />
                                    </div>

                                </div>
                            </div>

                            <div className={styles.adminModalFooter}>
                                <button className={styles.saveBtn} onClick={handleSubmit}>저장</button>
                                <button className={styles.cancelBtn} onClick={() => setIsFormModalOpen(false)}>취소</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default ProductManagement;