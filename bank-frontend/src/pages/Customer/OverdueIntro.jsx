import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Overdue.module.css';

const OverdueIntro = () => {
  const navigate = useNavigate();

  return (
    <div className={styles.pageContainer}>
      <div className={styles.introWrapper}>
        <div className={styles.introHeader}>
          <h2 className={styles.introTitle}>기업 연체 관리</h2>
          <button 
            className={styles.redBtn} 
            onClick={() => navigate('/overdue/repay')}
          >
            즉시 상환하기
          </button>
        </div>

        <div className={styles.cardContainer}>
          <div className={styles.infoCard}>
            <span className={styles.cardLabel}>미납 건수</span>
            <span className={`${styles.cardValue} ${styles.red}`}>2건</span>
          </div>
          <div className={styles.infoCard}>
            <span className={styles.cardLabel}>총 연체 금액</span>
            <span className={styles.cardValue}>404,500원</span>
          </div>
        </div>

        <button className={styles.homeBtn} onClick={() => navigate('/Main')}>
          메인 화면으로
        </button>
      </div>
    </div>
  );
};

export default OverdueIntro;