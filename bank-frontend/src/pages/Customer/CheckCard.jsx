import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useModal } from '../../context/ModalContext';
import styles from './Card.module.css';
import checkIcon from '../../images/Common/Check.png';
import greenCardImg from '../../images/Home/Card1.png';
import blueCardImg from '../../images/Home/Card2.png';

const CheckCard = () => {
  const navigate = useNavigate();
  const { openModal } = useModal();

  const showAlert = (message, callback = null) => {
    openModal({
        message: message,
        onConfirm: callback
    });
  };

  const [step, setStep] = useState(1);
  const [step1Phase, setStep1Phase] = useState('account'); 

  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState(null);

  useEffect(() => {
      const fetchAccounts = async () => {
          try {
              const response = await fetch('/api/account/list', {
                  method: 'GET',
                  headers: {
                      'Content-Type': 'application/json'
                  }
              });
              
              const data = await response.json();
              
              if (data.result === 'SUCCESS') {
                  // 입출금 계좌(CHECKING)만 필터링
                  const checkingAccounts = data.accounts.filter(acc => acc.accountType === 'CHECKING'); // 기존 DEMAND 고려
                  setAccounts(checkingAccounts);
              } else {
                  console.error("계좌 불러오기 실패:", data.message);
              }
          } catch (error) {
              console.error("API 호출 중 에러 발생:", error);
          }
      };

      fetchAccounts();
  }, []);

  // 계좌 선택 핸들러
  const handleAccountSelect = (accountId) => {
      setSelectedAccountId(accountId);
      setStep1Phase('agreement');
  };

  // 약관 동의 상태 관리
  const [agreements, setAgreements] = useState({
    term1: false, // 개인회원 약관 (필수)
    term2: false, // 개인정보 수집 (필수)
    term3: false, // 마케팅 동의 (선택)
  });
  const [activeAgreementModal, setActiveAgreementModal] = useState(null); // 어떤 약관 모달을 띄울지

  // 모든 필수 약관이 동의되었는지 확인
  const isAllRequiredAgreed = agreements.term1 && agreements.term2;

  const handleAgreeClick = () => {
    setAgreements(prev => ({ ...prev, [activeAgreementModal]: true }));
    setActiveAgreementModal(null);
  };

  const [selectedDesign, setSelectedDesign] = useState('GREEN_BASIC');
  
  const [cardName, setCardName] = useState(''); // 별칭 작성 추가

  const [cardPwd, setCardPwd] = useState('');
  
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const keypadLayout = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

  const handleKeyClick = (val) => {
    if (pinInput.length < 6) {
      setPinInput(prev => prev + val);
    }
  };
  const handleDelete = async () => {
    setPinInput(prev => prev.slice(0, -1));
  };

  const handlePinConfirm = async () => {
    if (pinInput.length !== 6) return;

    try {
      const response = await fetch('/api/pin/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ pin: pinInput }),
      });

      const data = await response.json();

      if (data.result === 'SUCCESS') {
          console.log("핀 번호 일치 확인! 카드 발급을 진행합니다.");
          
          const cardData = {
              accountId: selectedAccountId,
              cardType: "CHECK",
              cardColor: selectedDesign === 'GREEN_BASIC' ? "green" : "blue",
              cardName: cardName || (selectedDesign === 'GREEN_BASIC' ? "그린 베이직" : "블루 프리미엄") // 기본값 제공
          };

          const cardResponse = await fetch('/api/card/', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
              },
              body: JSON.stringify(cardData)
          });

          if (cardResponse.ok) {
              const cardResult = await cardResponse.json();
              if(cardResult.result === 'SUCCESS' || cardResult.result) { // result 형태에 따라 수정 필요할 수 있음
                  setIsPinModalOpen(false);
                  setStep(4);
              } else {
                  showAlert('카드 발급에 실패했습니다.');
                  setPinInput('');
              }
          } else {
              showAlert('카드 발급 서버와 연결할 수 없습니다.');
              setPinInput('');
          }
      } else if (data.result === 'FAILURE') {
          showAlert('핀 번호가 일치하지 않습니다. 다시 입력해주세요.');
          setPinInput('');
      } else if (data.result === 'FAILURE_SESSION') {
          showAlert('로그인이 필요하거나 세션이 만료되었습니다.\n다시 로그인해주세요.');
          setIsPinModalOpen(false);
          navigate('/Login');
      } else {
          showAlert('핀 번호 확인 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.');
          setPinInput('');
      }
    } catch (error) {
      console.error('핀 번호 API 통신 오류:', error);
      alert('서버와 연결할 수 없습니다.');
    }
  };

  const handleAccountPasswordConfirm = async () => {
       if (cardPwd.length !== 4) return;
       try {
           const params = new URLSearchParams({
               accountId: String(selectedAccountId), // URLSearchParams를 위해 문자열로 변환
               accountPassword: cardPwd
           });

           const response = await fetch('/api/account/account-password', {
               method: 'POST',
               headers: {
                   'Content-Type': 'application/json',
               },
               body: JSON.stringify(Object.fromEntries(params))
           });

           const data = await response.json();
           
           // TODO: 백엔드 응답 result 값에 맞춰 수정 필요
           if (data.result === 'SUCCESS') {
               setIsPinModalOpen(true);
           } else {
               showAlert('계좌 비밀번호가 일치하지 않습니다.');
               setCardPwd('');
           }
       } catch (error) {
           console.error("계좌 비밀번호 확인 오류:", error);
           showAlert("서버와 통신 중 오류가 발생했습니다.");
       }
  };

  const steps = [
    { id: 1, title: '계좌 선택/동의' },
    { id: 2, title: '카드 설정' },
    { id: 3, title: '비밀번호 확인' }, // 타이틀 변경
    { id: 4, title: '발급 완료' },
  ];

  return (
    <div className={styles.pageContainer}>
      <div className={styles.stepperLayout}>
        
        <aside className={styles.sidebar}>
          <h2 className={styles.sidebarTitle}>BANKSCOPE<br /><span className={styles.subTitle}>체크카드 발급 신청</span></h2>
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
          
          {step === 1 && step1Phase === 'account' && (
            <div className={styles.stepBox}>
              <h3 className={styles.stepTitle}>카드를 연결할 계좌를 선택해주세요.</h3>
              
              {accounts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                      연결 가능한 입출금 계좌가 없습니다.
                  </div>
              ) : (
                  accounts.map((account) => (
                      <div key={account.accountId} className={styles.accountCard}>
                          <div className={styles.accountInfo}>
                              <h4>{account.accountAlias || '기본 입출금'}</h4>
                              <p>{account.accountNumber}</p>
                          </div>
                          <div className={styles.accountRight}>
                              <span>{account.balance?.toLocaleString()} 원</span>
                              <button 
                                  className={styles.selectBtn} 
                                  onClick={() => handleAccountSelect(account.accountId)}
                              >
                                  선택
                              </button>
                          </div>
                      </div>
                  ))
              )}
            </div>
          )}

          {step === 1 && step1Phase === 'agreement' && (
            <div className={styles.stepBox}>
              <h3 className={styles.stepTitle}>가입 약관을 확인해 주세요</h3>
              
              <div className={`${styles.agreementBox} ${agreements.term1 ? styles.agreed : ''}`} onClick={() => setActiveAgreementModal('term1')}>
                <span>[필수] 체크카드 개인회원 약관 동의</span>
                {agreements.term1 && <span className={styles.agreedBadge}>동의 완료 ✔</span>}
              </div>
              
              <div className={`${styles.agreementBox} ${agreements.term2 ? styles.agreed : ''}`} onClick={() => setActiveAgreementModal('term2')}>
                <span>[필수] 개인정보 수집 및 이용 동의</span>
                {agreements.term2 && <span className={styles.agreedBadge}>동의 완료 ✔</span>}
              </div>
              
              <div className={`${styles.agreementBox} ${agreements.term3 ? styles.agreed : ''}`} onClick={() => setActiveAgreementModal('term3')}>
                <span>[선택] 마케팅 정보 수신 동의</span>
                {agreements.term3 && <span className={styles.agreedBadge}>동의 완료 ✔</span>}
              </div>
              
              <button 
                className={`${styles.nextBtn} ${!isAllRequiredAgreed ? styles.disabledBtn : ''}`} 
                disabled={!isAllRequiredAgreed}
                onClick={() => setStep(2)}
              >
                다음 단계로
              </button>
            </div>
          )}

          {step === 2 && (
            <div className={styles.stepBox}>
              <h3 className={styles.stepTitle}>디자인 및 별칭을 설정해주세요</h3>
              <div className={styles.designGrid}>
                <div 
                  className={`${styles.designItem} ${selectedDesign === 'GREEN_BASIC' ? styles.selected : ''}`} 
                  onClick={() => setSelectedDesign('GREEN_BASIC')}
                >
                  <img src={greenCardImg} alt="그린 베이직 카드" className={styles.realCardImage} />
                  <span className={styles.designLabel}>그린 베이직</span>
                </div>

                <div 
                  className={`${styles.designItem} ${selectedDesign === 'BLUE_PREMIUM' ? styles.selected : ''}`} 
                  onClick={() => setSelectedDesign('BLUE_PREMIUM')}
                >
                  <img src={blueCardImg} alt="블루 프리미엄 카드" className={styles.realCardImage} />
                  <span className={styles.designLabel}>블루 프리미엄</span>
                </div>
              </div>
              
              {/* 별칭 입력 필드 추가 */}
              <div style={{ marginTop: '20px', width: '100%', maxWidth: '400px', display : 'flex', flexDirection : 'column', alignSelf: 'center' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>카드 별칭 설정 (선택)</label>
                  <input
                      type="text"
                      className={styles.pwdInput} // 스타일 재사용
                      placeholder="내 체크카드"
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                  />
              </div>

              <button className={styles.nextBtn} onClick={() => setStep(3)}>선택 완료</button>
            </div>
          )}

          {step === 3 && (
            <div className={styles.stepBox}>
              <h3 className={styles.stepTitle}>계좌 비밀번호 확인</h3>
              <p style={{ color: '#888', fontSize: '14px', marginBottom: '20px' }}>선택하신 계좌의 비밀번호를 입력해주세요.</p>
              <input 
                type="password" 
                className={styles.pwdInput}
                placeholder="계좌 비밀번호 4자리 입력"
                maxLength={4}
                value={cardPwd}
                onChange={(e) => setCardPwd(e.target.value.replace(/[^0-9]/g, ''))}
              />
              <button
                className={`${styles.nextBtn} ${cardPwd.length !== 4 ? styles.disabledBtn : ''}`}
                disabled={cardPwd.length !== 4}
                onClick={handleAccountPasswordConfirm} // 비밀번호 확인 함수 호출
              >
                다음 단계로
              </button>
            </div>
          )}

          {step === 4 && (
            <div className={styles.stepBox}>
              <div className={styles.completeBox}>
                <img src={checkIcon} alt="완료 체크" className={styles.checkIcon} />
                <h3 className={styles.completeTitle}>카드 발급 신청 완료!</h3>
                <p className={styles.completeDesc}>발급신청이 완료되었습니다. 카드 수령은 발급 심사 후에<br/>창구에서 가능합니다.</p>
              </div>
              <button className={styles.nextBtn} onClick={() => navigate('/Main')}>홈 화면으로 이동</button>
            </div>
          )}

        </main>
      </div>

      {activeAgreementModal && (
        <div className={styles.pinModalBackdrop}>
          <div className={styles.pinModalContent} onClick={(e) => e.stopPropagation()}>
            
            <h3>
              {activeAgreementModal === 'term1' && '[필수] 체크카드 개인회원 약관'}
              {activeAgreementModal === 'term2' && '[필수] 개인정보 수집 및 이용 동의'}
              {activeAgreementModal === 'term3' && '[선택] 마케팅 정보 수신 동의'}
            </h3>
            
            <div className={styles.termsContentBox}>
              
              {activeAgreementModal === 'term1' && (
                <>
                  <strong>제 1조 (목적)</strong><br />
                  본 약관은 고객(이하 '회원')이 은행이 발행한 체크카드를 이용함에 있어 필요한 제반 사항과 권리 및 의무를 규정함을 목적으로 합니다.<br /><br />
                  
                  <strong>제 2조 (이용 한도 및 결제)</strong><br />
                  ① 체크카드는 가입 시 연결된 결제계좌의 예금 잔액 범위 내에서만 사용이 가능합니다.<br />
                  ② 카드 승인 즉시 회원의 결제계좌에서 해당 금액이 자동 출금 처리됩니다.<br /><br />
                  
                  <strong>제 3조 (비밀번호 관리 의무)</strong><br />
                  회원은 카드 비밀번호 및 핀(PIN) 번호가 타인에게 노출되지 않도록 철저히 관리해야 하며, 고의 또는 중대한 과실로 인한 비밀번호 유출로 발생한 손해는 회원이 부담합니다.<br /><br />
                  
                  <strong>제 4조 (분실 및 도난 신고)</strong><br />
                  ① 카드의 분실 또는 도난 사실을 인지한 경우, 회원은 즉시 은행 영업점 또는 고객센터를 통해 신고해야 합니다.<br />
                  ② 신고 접수 시점 이후에 발생한 타인의 부정 사용 금액에 대해서는 은행이 책임을 부담합니다.
                </>
              )}

              {activeAgreementModal === 'term2' && (
                <>
                  <strong>1. 수집 및 이용 목적</strong><br />
                  체크카드 발급 심사, 본인 인증, 결제 서비스 제공, 금융 사고 예방 및 분쟁 처리<br /><br />
                  
                  <strong>2. 수집하는 개인정보 항목</strong><br />
                  성명, 주민등록번호(또는 외국인등록번호), 연락처, 이메일, 자택/직장 주소, 결제계좌 정보<br /><br />
                  
                  <strong>3. 개인정보의 보유 및 이용 기간</strong><br />
                  금융거래 종료일(카드 해지일)로부터 5년까지 (단, 관련 법령에 의거하여 보존할 필요가 있는 경우 해당 법령에서 정한 기간 동안 보존)<br /><br />
                  
                  <span style={{ color: '#E63946' }}><strong>※ 동의 거부 권리</strong></span><br />
                  고객님은 위 개인정보 수집 및 이용에 대한 동의를 거부할 권리가 있습니다. 단, 필수 항목 동의 거부 시 체크카드 발급 및 서비스 이용이 불가능합니다.
                </>
              )}

              {activeAgreementModal === 'term3' && (
                <>
                  <strong>1. 수집 및 이용 목적</strong><br />
                  새로운 금융상품 안내, 이벤트 참여 기회 제공, 고객 맞춤형 혜택 안내<br /><br />
                  
                  <strong>2. 보유 및 이용 기간</strong><br />
                  동의 철회 시 또는 회원 탈퇴 시까지<br /><br />
                  
                  <strong>※ 동의 거부 권리</strong><br />
                  본 동의는 선택 사항으로, 동의하지 않으셔도 체크카드 발급이 가능합니다. 단, 유용한 혜택 및 이벤트 안내를 받으실 수 없게 됩니다.
                </>
              )}

            </div>
            <div className={styles.pinActionRow}>
              <button className={styles.pinCancelBtn} onClick={() => setActiveAgreementModal(null)}>
                닫기
              </button>
              <button className={styles.nextBtn} onClick={handleAgreeClick}>
                위 약관에 동의합니다
              </button>
            </div>
          </div>
        </div>
      )}

      {isPinModalOpen && (
        <div className={styles.pinModalBackdrop}>
          <div className={styles.pinModalContent} onClick={(e) => e.stopPropagation()} style={{ width: '90%', maxWidth: '400px', textAlign: 'center', padding: '40px' }}>
            <h3>보안 핀(PIN) 번호를 입력해주세요</h3>
            <p style={{ color: '#888', fontSize: '14px', marginBottom: '20px' }}>본인 확인을 위해 6자리 핀 번호를 입력합니다.</p>
            
            <div className={styles.pinDisplay}>
              {[...Array(6)].map((_, i) => (
                <div key={i} className={`${styles.pinDot} ${i < pinInput.length ? styles.pinDotFilled : ''}`} />
              ))}
            </div>

            <div className={styles.keypad}>
              {keypadLayout.map((key, idx) => {
                if (key === '') return <div key={idx} className={styles.emptyKey} />;
                if (key === 'del') {
                  return (
                    <button key={idx} className={styles.keyBtn} onClick={handleDelete}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"></path>
                        <line x1="18" y1="9" x2="12" y2="15"></line><line x1="12" y1="9" x2="18" y2="15"></line>
                      </svg>
                    </button>
                  );
                }
                return (
                  <button key={idx} className={styles.keyBtn} onClick={() => handleKeyClick(key)}>
                    {key}
                  </button>
                );
              })}
            </div>

            <div className={styles.pinActionRow}>
              <button
                className={styles.pinCancelBtn}
                onClick={() => {
                  setPinInput('');
                  setIsPinModalOpen(false);
                }}
              >
                취소
              </button>
              <button
                className={`${styles.nextBtn} ${pinInput.length !== 6 ? styles.disabledBtn : ''}`}
                disabled={pinInput.length !== 6}
                onClick={handlePinConfirm}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default CheckCard;
