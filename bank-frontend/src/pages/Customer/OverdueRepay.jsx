import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Overdue.module.css';
import checkIcon from '../../images/Common/Check.png';

const OverdueRepay = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [repayAmount, setRepayAmount] = useState('');

  const steps = [
    { id: 1, title: '내역 확인' },
    { id: 2, title: '상환 금액' },
    { id: 3, title: '출금 계좌' },
    { id: 4, title: '상환 완료' },
  ];

  return (
    <div className={styles.pageContainer}>
      <div className={styles.stepperLayout}>
        
        <aside className={styles.sidebar}>
          <h2 className={styles.sidebarTitle}>
            BANKSCOPE<br />연체금 즉시 상환
          </h2>
          <div className={styles.stepList}>
            {steps.map((s) => (
              <div key={s.id} className={`${styles.stepItem} ${step >= s.id ? styles.active : ''}`}>
                <div className={styles.stepCircle}>{s.id}</div>
                <span>{s.title}</span>
              </div>
            ))}
          </div>
        </aside>

        <main className={styles.mainContent}>
          
          {step === 1 && (
            <div className={styles.stepBox}>
              <h3 className={styles.stepTitle}>기업 자금 대출</h3>
              <div className={styles.detailRow}>
                <span>미납 이자</span>
                <span>320,500원</span>
              </div>
              <div className={styles.detailRow}>
                <span>지연 배상금</span>
                <span>84,000원</span>
              </div>
              <div className={styles.detailTotal}>
                <span>합계</span>
                <span>404,500원</span>
              </div>
              <button className={styles.nextBtn} onClick={() => setStep(2)}>다음 단계로</button>
            </div>
          )}

          {step === 2 && (
            <div className={styles.stepBox}>
              <h3 className={styles.stepTitle}>상환 금액을 입력해주세요.</h3>
              <input 
                type="text" 
                className={styles.amountInput}
                placeholder="금액 입력"
                value={repayAmount}
                onChange={(e) => setRepayAmount(e.target.value)}
              />
              <button className={styles.nextBtn} onClick={() => setStep(3)}>다음 단계로</button>
            </div>
          )}

          {step === 3 && (
            <div className={styles.stepBox}>
              <h3 className={styles.stepTitle}>출금 계좌를 선택해주세요.</h3>
              
              <div className={styles.accountCard}>
                <div className={styles.accountInfo}>
                  <h4>ㅇㅇ기업 계좌 <span style={{fontSize:'10px', background:'#4A9C82', color:'white', padding:'2px 6px', borderRadius:'10px', marginLeft:'4px'}}>주계좌</span></h4>
                  <p>000-00000000-0</p>
                </div>
                <div className={styles.accountRight}>
                  <span>1,000,000 원</span>
                  <button className={styles.selectBtn} onClick={() => setStep(4)}>선택</button>
                </div>
              </div>

              <div className={styles.accountCard}>
                <div className={styles.accountInfo}>
                  <h4>ㅇㅇ기업 계좌</h4>
                  <p>000-00000000-0</p>
                </div>
                <div className={styles.accountRight}>
                  <span>1,000,000 원</span>
                  <button className={styles.selectBtn} onClick={() => setStep(4)}>선택</button>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className={styles.stepBox}>
              <div className={styles.completeBox}>
                <img src={checkIcon} alt="완료 체크" className={styles.checkIcon} />
                <h3 className={styles.completeTitle}>상환 완료!</h3>
                <p className={styles.completeDesc}>금융기록이<br/>정상 업데이트되었습니다.</p>
              </div>
              <button className={styles.nextBtn} onClick={() => navigate('/Main')}>홈 화면으로 이동</button>
            </div>
          )}

        </main>
      </div>
    </div>
  );
};

export default OverdueRepay;