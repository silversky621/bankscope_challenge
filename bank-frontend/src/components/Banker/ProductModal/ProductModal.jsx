/* eslint-disable react-hooks/set-state-in-effect */
import styles from './ProductModal.module.css';
import React, { useEffect, useState } from 'react';
import RecommendDeposit from "./RecommendDeposit.jsx";
import RecommendSavings from "./RecommendSavings.jsx";
import RecommendLoan from "./RecommendLoan.jsx";
import RecommendChecking from "./RecommendChecking.jsx";

const ProductModal = ({ product, isOpen, onClose, selectedTask }) => {
  const [isRendered, setIsRendered] = useState(false);
  const [isAnimate, setIsAnimate] = useState(false);

  useEffect(() => {
    let firstFrame;
    let secondFrame;

    if (isOpen && product) {
      setIsRendered(true);
      firstFrame = requestAnimationFrame(() => {
        secondFrame = requestAnimationFrame(() => setIsAnimate(true));
      });
    } else {
      setIsAnimate(false);
    }

    return () => {
      if (firstFrame) cancelAnimationFrame(firstFrame);
      if (secondFrame) cancelAnimationFrame(secondFrame);
    };
  }, [isOpen, product]);

  const handleTransitionEnd = (e) => {
    if (e.target === e.currentTarget && e.propertyName === 'opacity' && !isAnimate) {
      setIsRendered(false);
    }
  };

  if (!isRendered || !product) return null;
  // 조건부 렌더링을 위한 헬퍼 함수
  const renderRecommendForm = () => {
    switch (product.productCategory) {
      case 'DEPOSIT':
        return <RecommendDeposit product={product} onClose={onClose} selectedTask={selectedTask} />;
      case 'SAVINGS':
        return <RecommendSavings product={product} onClose={onClose} selectedTask={selectedTask} />;
      case 'LOAN':
        return <RecommendLoan product={product} onClose={onClose} selectedTask={selectedTask} />;
      case 'CHECKING' :
        return <RecommendChecking product = {product} onClose = {onClose} selectedTask = {selectedTask} />;
      default:
        return <div style={{ padding: '20px', color: '#666', textAlign: 'center' }}>해당 카테고리의 폼을 찾을 수 없습니다. ({product.productCategory})</div>;

    }
  };

  return (
      <div
        className={`${styles.modalOverlay} ${isAnimate ? styles.isOpen : ''}`}
        onTransitionEnd={handleTransitionEnd}
      >
        <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
          <header className={styles.header}>
            <h2>금융상품 가입 안내</h2>
            <button className={styles.closeBtn} onClick={onClose}>&times;</button>
          </header>

          {/* 좌우 2단 그리드 */}
          <div className={styles.bodyGrid}>
            {/* 왼쪽: 상품 상세설명 */}
            <div className={styles.leftPane}>
              <div className={styles.productBadge}>추천 상품</div>
              <h3 className={styles.productName}>{product.name}</h3>
              <p className={styles.productDesc}>{product.description}</p>
              
              <div className={styles.productDetailItem}>
                <p>
                  <span className={styles.label}>기준금리 ~ 최대금리</span>
                  <span className={styles.value}>{product.baseInterestRate}% ~ {product.maxInterestRate}%</span>
                </p>
              </div>
              
              <div className={styles.productDetailItem}>
                <p>
                  <span className={styles.label}>가입 금액</span>
                  <span className={styles.value}>
                    {product.minAmount?.toLocaleString()}원 ~ {product.maxAmount?.toLocaleString()}원
                  </span>
                </p>
              </div>
              
              <div className={styles.productDetailItem}>
                <p>
                  <span className={styles.label}>가입 기간</span>
                  <span className={styles.value}>{product.minDurationMonths}개월 ~ {product.maxDurationMonths}개월</span>
                </p>
              </div>
            </div>

            {/* 오른쪽: 상품 가입 폼 */}
            <div className={styles.rightPane}>
              <div className={styles.formSection}>
                {renderRecommendForm()}
              </div>
            </div>
          </div>

        </div>
      </div>
  );
};

export default ProductModal;
