import React, { useState, useEffect } from 'react';
import styles from './InterestManagement.module.css';
import { useModal } from '../../context/ModalContext'; 
import Loading from '../common/Loading';

export default function InterestManagement() {
  const { openModal } = useModal(); 
  const [activeTab, setActiveTab] = useState('DEPOSIT');
  const [productList, setProductList] = useState([]);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null); 
  const [historyList, setHistoryList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    baseRate: '', primeRate: '', changeReason: '', startDate: new Date().toISOString().split('T')[0]
  });

  const categories = [
    { id: 'DEPOSIT', label: '예금' },
    { id: 'SAVING', label: '적금' },
    { id: 'LOAN', label: '대출' },
    { id: 'FUND', label: '펀드' }
  ];

  useEffect(() => {
    const fetchProducts = async () => {
      setIsLoading(true);
      /*await new Promise(resolve => setTimeout(resolve, 300))*/;
      
      let mockProducts = activeTab === 'DEPOSIT' ? [
        { id: 1, name: 'Star 정기예금', beforeRate: '3.20', currentRate: '3.50', type: '정기예금', trend: 'up' },
        { id: 2, name: '쏠편한 정기예금', beforeRate: '3.30', currentRate: '3.60', type: '정기예금', trend: 'flat' },
        { id: 3, name: '패밀리 예금', beforeRate: '3.40', currentRate: '3.15', type: '회전예금', trend: 'down' }, 
      ] : [];
      setProductList(mockProducts);
      setIsLoading(false);
    };
    fetchProducts();
  }, [activeTab]);

  const handleProductClick = (item) => {
    setSelectedProduct(item);
    setFormData({ baseRate: '', primeRate: '', changeReason: '', startDate: new Date().toISOString().split('T')[0] });
    setHistoryList([
      { id: 101, date: '2025.12.05', beforeMax: '3.20', afterBase: '3.20', afterMax: '3.50', reason: '기준 금리 인상분 반영' },
      { id: 102, date: '2024.11.05', beforeMax: '3.00', afterBase: '3.00', afterMax: '3.20', reason: '정기 금리 조정' }
    ]);
    setIsFormModalOpen(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const calcMaxRate = () => ( (parseFloat(formData.baseRate) || 0) + (parseFloat(formData.primeRate) || 0) ).toFixed(2);

  const handleSave = () => {
    if (!formData.baseRate || !formData.primeRate || !formData.changeReason) {
      openModal({ message: "필수 항목을 모두 입력해주세요.", confirmText: "확인" });
      return;
    }
    openModal({
      message: `금리를 ${calcMaxRate()}% 로 변경하시겠습니까?`,
      confirmText: "변경 실행", cancelText: "취소",
      onConfirm: async () => {
        setIsLoading(true);
        await new Promise(resolve => setTimeout(resolve, 500)); 
        setIsLoading(false);
        setIsFormModalOpen(false);
        openModal({ message: "저장되었습니다.", confirmText: "확인" });
      }
    });
  };

  return (
    <div className={styles.layout}>
      {isLoading && <Loading message="데이터를 처리 중입니다..." />}

      <div className={styles.header}>
        <h2 className={styles.pageTitle}>금리 관리</h2>
        
        <div className={styles.searchAndTabRow}>
          <div className={styles.tabContainer}>
            {categories.map(cat => (
              <button key={cat.id} className={`${styles.tabBtn} ${activeTab === cat.id ? styles.activeTab : ''}`} onClick={() => setActiveTab(cat.id)}>
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th width="40%" className={styles.leftAlign}>상품명</th>
              <th width="15%">상품 유형</th>
              <th width="15%">이전 금리</th>
              <th width="15%">현재 최고 금리</th>
              <th width="15%">변동 추이</th>
            </tr>
          </thead>
          <tbody>
            {productList.length > 0 ? productList.map(item => (
              <tr key={item.id} className={styles.clickableRow} onClick={() => handleProductClick(item)}>
                <td className={styles.leftAlign}><b>{item.name}</b></td>
                
                <td><span className={styles.typeBadge}>{item.type}</span></td>
                <td className={styles.num}>{item.beforeRate}%</td>
                <td className={styles.num}><span className={styles.highlightRate}>{item.currentRate}%</span></td>
                
                <td>
                  {item.trend === 'up' && (
                    <span className={`${styles.trendBadge} ${styles.trendUp}`}>▲ 인상</span>
                  )}
                  {item.trend === 'flat' && (
                    <span className={`${styles.trendBadge} ${styles.trendFlat}`}>- 유지</span>
                  )}
                  {item.trend === 'down' && (
                    <span className={`${styles.trendBadge} ${styles.trendDown}`}>▼ 인하</span>
                  )}
                </td>
                
              </tr>
            )) : <tr><td colSpan="5" style={{padding:'60px', color:'#999'}}>데이터가 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>

      {isFormModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBox} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitleArea}>
                <small style={{color: '#009A83', fontWeight:700}}>선택된 상품</small>
                <h2>{selectedProduct.name}</h2>
              </div>
              <button className={styles.closeBtn} onClick={() => setIsFormModalOpen(false)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.modalSplit}>
                <div>
                  <div className={styles.formSectionTitle}>금리 등록</div>
                  <div className={styles.rowGroup}>
                    <div className={styles.inputGroup}>
                      <label className={styles.inputLabel}>기본 금리 (%)</label>
                      <input type="number" step="0.01" name="baseRate" className={styles.cleanInput} placeholder="예: 3.00" onChange={handleInputChange} />
                    </div>
                    <div className={styles.inputGroup}>
                      <label className={styles.inputLabel}>우대 금리 (%)</label>
                      <input type="number" step="0.01" name="primeRate" className={styles.cleanInput} placeholder="예: 0.20" onChange={handleInputChange} />
                    </div>
                  </div>
                  <div className={styles.calcResultBox}>
                    <span>최종 금리</span><b style={{fontSize:'18px', color:'#009A83'}}>{calcMaxRate()}%</b>
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={styles.inputLabel}>적용 시작일</label>
                    <input type="date" name="startDate" className={styles.cleanInput} value={formData.startDate} onChange={handleInputChange} />
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={styles.inputLabel}>변동 사유</label>
                    <textarea name="changeReason" className={styles.cleanInput} rows="3" placeholder="변동 사유를 상세히 적어주세요 (맑은 고딕)" onChange={handleInputChange} />
                  </div>
                </div>
                <div>
                  <div className={styles.formSectionTitle}>변동 이력</div>
                  <div className={styles.timeline}>
                    {historyList.map(h => (
                      <div key={h.id} className={styles.timelineItem}>
                        <div className={styles.tlContent}>
                          <small>{h.date}</small>
                          <div>{h.beforeMax}% → <b style={{color: '#009A83'}}>{h.afterMax}%</b></div>
                          <div className={styles.tlReason}>{h.reason}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={() => setIsFormModalOpen(false)}>취소</button>
              <button className={styles.actionBtn} onClick={handleSave}>수정</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
