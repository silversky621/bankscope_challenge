import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Card.module.css'
import checkIcon from '../../images/Common/Check.png';
import greenCardImg from '../../images/Home/Card1.png';
import blueCardImg from '../../images/Home/Card2.png';
import Loading from '../../components/common/Loading.jsx';
import { useModal } from '../../context/ModalContext';

const CreditCard = () => {
    const navigate = useNavigate();
    const { openModal } = useModal();
    
    // 내부 상태 관리
    const [step, setStep] = useState(1);
    
    const [selectedCard, setSelectedCard] = useState(null);
    const [expandedCardId, setExpandedCardId] = useState(null); // 더보기 아코디언
    const [activeModal, setActiveModal] = useState(null);
    const [cardPwd, setCardPwd] = useState('');
    const [agreements, setAgreements] = useState({ term1: false, term2: false });

    const [isPinModalOpen, setIsPinModalOpen] = useState(false);
    const [pinInput, setPinInput] = useState('');
    const keypadLayout = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

    // 카드 별칭 및 결제일
    const [cardName, setCardName] = useState('');
    const [paymentDay, setPaymentDay] = useState(''); // 결제일 상태 추가

    // 계좌 목록 상태 추가
    const [accounts, setAccounts] = useState([]);
    const [selectedAccountId, setSelectedAccountId] = useState(null);

    const showAlert = (message, callback = null) => {
        openModal({
            message: message,
            onConfirm: callback
        });
    };

    // 계좌 목록 조회 API 호출 (결제계좌 선택 단계인 step 2에서 호출)
    useEffect(() => {
        if (step === 2) {
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
                        const checkingAccounts = data.accounts.filter(acc => acc.accountType === 'CHECKING' || acc.accountType === 'DEMAND');
                        setAccounts(checkingAccounts);
                    } else {
                        console.error("계좌 불러오기 실패:", data.message);
                    }
                } catch (error) {
                    console.error("API 호출 중 에러 발생:", error);
                }
            };
  
            fetchAccounts();
        }
    }, [step]);


    const handleKeyClick = (val) => {
        if (pinInput.length < 6) setPinInput(prev => prev + val);
    };
    const handleDelete = () => setPinInput(prev => prev.slice(0, -1));

    const handlePinConfirm = async () => {
        if (pinInput.length !== 6) return;
        try {
            const response = await fetch('/api/pin/confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ pin: pinInput }),
            });
            const data = await response.json();
            
            if (data.result === 'SUCCESS') {
                console.log("핀 번호 일치 확인! 카드 발급을 진행합니다.");
                
                const cardData = {
                    accountId: selectedAccountId,
                    cardType: "CREDIT",
                    paymentDay: Number(paymentDay), // 문자열을 숫자로 변환
                    cardColor: selectedCard === 'MRLIFE' ? "green" : "blue",
                    cardName: cardName || (selectedCard === 'MRLIFE' ? "BankScope Mr.Life" : "뱅크스코프 트래블 플러스")
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
                    if(cardResult.result === 'SUCCESS' || cardResult.result) { 
                        setIsPinModalOpen(false);
                        setStep(6); // 심사 로딩 화면으로 이동
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
            console.error('API 오류:', error);
            showAlert('서버와 연결할 수 없습니다.');
        }
    };

    // 계좌 비밀번호 확인 핸들러 (POST /api/account/account-password)
    const handleAccountPasswordConfirm = async () => {
        if (cardPwd.length !== 4) return;
        try {
            const params = new URLSearchParams();
            params.append('accountId', String(selectedAccountId));
            params.append('accountPassword', cardPwd);
 
            const response = await fetch('/api/account/account-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(Object.fromEntries(params))
            });
 
            const data = await response.json();
            
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

    // 신용카드 리스트 mock 데이터
    const cardList = [
        {
            id: 'MRLIFE',
            highlight: '최대 52만원 캐시백',
            name: 'BankScope Mr.Life',
            subtitle: '뱅크스코프',
            benefits: ['스타벅스, 커피빈 등 커피전문점 10% 결제일 할인', '이마트, 홈플러스, 롯데마트 주말 10% 할인', 'SKT, KT, LG U+ 통신요금 10% 할인'],
            image: greenCardImg
        },
        {
            id: 'TRAVEL',
            highlight: '해외 수수료 0원',
            name: '뱅크스코프 트래블 플러스',
            subtitle: '뱅크스코프',
            benefits: ['해외 전 가맹점 결제 수수료 100% 면제', '전 세계 공항 라운지 연 2회 무료', '국내 대중교통 5% 청구할인'],
            image: blueCardImg
        }
    ];

    const isAllRequiredAgreed = agreements.term1 && agreements.term2;

    // 더보기 토글
    const toggleExpand = (id) => {
        setExpandedCardId(prev => prev === id ? null : id);
    };

    // 상품 선택하기 클릭
    const handleJoinClick = (cardId) => {
        setSelectedCard(cardId);
        setStep(2); 
    };

    // 계좌 선택 핸들러 (선택 즉시 다음 단계로 이동)
    const handleAccountSelect = (accountId) => {
        setSelectedAccountId(accountId);
        setStep(3); // 약관 동의로 넘어감
    };

    // 약관 동의
    const handleAgreeClick = () => {
        setAgreements(prev => ({ ...prev, [activeModal]: true }));
        setActiveModal(null);
    };

    // 가짜 로딩 (결제능력 심사)
    useEffect(() => {
        if (step === 6) {
            // 결제능력 심사
            const timer = setTimeout(() => setStep(7), 3000);
            return () => clearTimeout(timer);
        }
    }, [step]);

    const getSidebarActiveStep = () => {
        if (step === 1) return 1;
        if (step === 2) return 2;
        if (step === 3) return 3;
        if (step === 4) return 4;
        if (step >= 5) return 5;
        return 1;
    };

    const sidebarSteps = [
        { id: 1, title: '상품 선택' },
        { id: 2, title: '결제계좌 선택' },
        { id: 3, title: '약관 동의' },
        { id: 4, title: '카드 설정' },
        { id: 5, title: '인증 및 완료' },
    ];

    return (
        <div className={styles.pageContainer}>
            <div className={styles.stepperLayout}>
                
                <aside className={styles.sidebar}>
                    <h2 className={styles.sidebarTitle}>
                        BANKSCOPE<br /><span className={styles.subTitle}>신용카드 발급 신청</span>
                    </h2>
                    <div className={styles.stepList}>
                        {sidebarSteps.map((s) => (
                            <div key={s.id} className={`${styles.stepItem} ${getSidebarActiveStep() >= s.id ? styles.active : ''}`}>
                                <div className={styles.stepCircle}>{s.id}</div>
                                <span>{s.title}</span>
                            </div>
                        ))}
                    </div>
                </aside>

                <main className={styles.mainContent}>
                    
                    {/* 1. 상품 선택 */}
                    {step === 1 && (
                        <div className={styles.stepBox}>
                            <h3 className={styles.stepTitle}>발급을 원하시는 카드를 선택해주세요</h3>
                            
                            <div className={styles.cardListContainer}>
                                {cardList.map((card) => (
                                    <div key={card.id} className={styles.cardListItem}>
                                        <div className={styles.cardListMain}>
                                            <div className={styles.cardListLeft}>
                                                <img src={card.image} alt={card.name} className={styles.cardListImage} />
                                                <div className={styles.cardListText}>
                                                    <span className={styles.cardHighlight}>{card.highlight}</span>
                                                    <span className={styles.cardTitle}>{card.name}</span>
                                                    <span className={styles.cardSubtitle}>{card.subtitle}</span>
                                                </div>
                                            </div>
                                            <div className={styles.cardListRight}>
                                                <button className={styles.joinBtn} onClick={() => handleJoinClick(card.id)}>
                                                    선택하기
                                                </button>
                                                <button className={styles.moreBtn} onClick={() => toggleExpand(card.id)}>
                                                    더보기 {expandedCardId === card.id ? '∧' : '∨'}
                                                </button>
                                            </div>
                                        </div>
                                        
                                        {expandedCardId === card.id && (
                                            <div className={styles.expandedBenefits}>
                                                <strong>주요 혜택 안내</strong>
                                                <ul>
                                                    {card.benefits.map((benefit, idx) => (
                                                        <li key={idx}>{benefit}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 2. 결제계좌 선택 */}
                    {step === 2 && (
                        <div className={styles.stepBox}>
                            <h3 className={styles.stepTitle}>결제 계좌 선택</h3>
                            <p style={{ color: '#888', marginBottom: '20px' }}>신용카드 대금이 출금될 계좌를 선택해주세요.</p>

                            <div style={{ marginBottom: '20px' }}>
                                {accounts.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '40px', color: '#999', background: '#f4f5f6', borderRadius: '12px' }}>
                                        연결 가능한 입출금 계좌가 없습니다.
                                    </div>
                                ) : (
                                    <div>
                                        {accounts.map((account) => (
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
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* 3. 약관 동의 */}
                    {step === 3 && (
                        <div className={styles.stepBox}>
                            <h3 className={styles.stepTitle}>약관 동의</h3>
                            <p style={{ color: '#888', marginBottom: '20px' }}>카드 발급을 위해 아래 약관에 동의해주세요.</p>

                            <div className={`${styles.agreementBox} ${agreements.term1 ? styles.agreed : ''}`} onClick={() => setActiveModal('term1')}>
                                <span>[필수] 신용카드 개인회원 표준약관</span>
                                {agreements.term1 && <span className={styles.agreedBadge}>동의 완료 ✔</span>}
                            </div>
                            <div className={`${styles.agreementBox} ${agreements.term2 ? styles.agreed : ''}`} onClick={() => setActiveModal('term2')} style={{ marginBottom: '40px' }}>
                                <span>[필수] 신용조회 및 개인정보 제공 동의</span>
                                {agreements.term2 && <span className={styles.agreedBadge}>동의 완료 ✔</span>}
                            </div>

                            <button 
                                className={`${styles.nextBtn} ${!isAllRequiredAgreed ? styles.disabledBtn : ''}`}
                                disabled={!isAllRequiredAgreed}
                                onClick={() => setStep(4)}
                            >
                                다음 단계로
                            </button>
                        </div>
                    )}

                    {/* 4. 카드 설정 (별칭 + 결제일) */}
                    {step === 4 && (
                        <div className={styles.stepBox}>
                            <h3 className={styles.stepTitle}>카드 설정</h3>
                            <p style={{ color: '#888', marginBottom: '20px' }}>카드 별칭과 대금 결제일을 선택해주세요.</p>
                            
                            <h4 style={{ marginBottom: '10px' }}>카드 별칭 설정 (선택)</h4>
                            <input
                                type="text"
                                className={styles.pwdInput}
                                placeholder="예: 내 첫 신용카드"
                                value={cardName}
                                onChange={(e) => setCardName(e.target.value)}
                                style={{ marginBottom: '20px' }}
                            />

                            {/* 결제일 선택 추가 */}
                            <h4 style={{ marginBottom: '10px' }}>결제일 선택</h4>
                            <select
                                className={styles.pwdInput}
                                value={paymentDay}
                                onChange={(e) => setPaymentDay(e.target.value)}
                                style={{ marginBottom: '40px', appearance: 'auto' }}
                            >
                                <option value="">결제일을 선택해주세요</option>
                                {[1, 5, 10, 14, 15, 20, 25].map(day => (
                                    <option key={day} value={day}>매월 {day}일</option>
                                ))}
                            </select>

                            <button 
                                className={`${styles.nextBtn} ${!paymentDay ? styles.disabledBtn : ''}`}
                                disabled={!paymentDay}
                                onClick={() => setStep(5)}
                            >
                                다음 단계로
                            </button>
                        </div>
                    )}

                    {/* 5. 통장 비밀번호 입력 */}
                    {step === 5 && (
                        <div className={styles.stepBox}>
                            <h3 className={styles.stepTitle}>계좌 비밀번호 확인</h3>
                            <p style={{ color: '#888', fontSize: '14px', marginBottom: '20px' }}>본인 확인을 위해 선택하신 결제 계좌의 비밀번호 4자리를 입력해주세요.</p>
                            
                            <input 
                                type="password" 
                                className={styles.pwdInput}
                                placeholder="계좌 비밀번호 4자리 입력"
                                maxLength={4}
                                value={cardPwd}
                                onChange={(e) => setCardPwd(e.target.value.replace(/[^0-9]/g, ''))}
                                style={{ marginBottom: '40px' }}
                            />

                            <button 
                                className={`${styles.nextBtn} ${cardPwd.length !== 4 ? styles.disabledBtn : ''}`}
                                disabled={cardPwd.length !== 4}
                                onClick={handleAccountPasswordConfirm}
                            >
                                본인 인증 및 신청
                            </button>
                        </div>
                    )}

                    {/* 6. 심사 중 가짜 로딩 */}
                    {step === 6 && (
                        <div className={styles.stepBox} style={{ textAlign: 'center', padding: '100px 0' }}>
                            <Loading />
                            <h3 className={styles.stepTitle} style={{ marginTop: '30px' }}>결제능력 및 신용점수를 심사 중입니다...</h3>
                            <p style={{ color: '#888' }}>잠시만 기다려주세요. 최대 1분 정도 소요될 수 있습니다.</p>
                        </div>
                    )}

                    {/* 7. 발급 완료 */}
                    {step === 7 && (
                        <div className={styles.stepBox}>
                            <div className={styles.completeBox}>
                                <img src={checkIcon} alt="완료 체크" className={styles.checkIcon} />
                                <h3 className={styles.completeTitle}>카드 발급 신청 완료!</h3>
                                <p className={styles.completeDesc}>
                                    발급신청이 완료되었습니다. 카드 수령은 발급 심사 후에<br/>
                                    창구에서 가능합니다.
                                </p>
                            </div>
                            <button className={styles.nextBtn} onClick={() => navigate('/Main')}>홈 화면으로 이동</button>
                        </div>
                    )}

                </main>
            </div>

            {/* 약관 모달 */}
            {activeModal && (
                <div className={styles.pinModalBackdrop}>
                    <div className={styles.pinModalContent} onClick={(e) => e.stopPropagation()}>
                        
                        {activeModal === 'term1' && (
                            <>
                                <h3>[필수] 신용카드 개인회원 표준약관</h3>
                                
                                <div className={styles.termsContentBox}>
                                    <strong>제 1조 (목적)</strong><br />
                                    본 약관은 신용카드업자와 회원 간의 신용카드 이용에 관한 제반 사항을 정함을 목적으로 합니다.<br /><br />
                                    
                                    <strong>제 2조 (카드의 이용 및 한도)</strong><br />
                                    ① 회원은 부여된 신용한도 내에서 카드를 이용할 수 있으며, 결제일에 대금을 납부해야 합니다.<br />
                                    ② 회원은 카드를 타인에게 양도하거나 대여할 수 없으며, 이를 위반하여 발생한 손해는 회원이 부담합니다.<br /><br />
                                    
                                    <strong>제 3조 (비밀번호 관리 의무)</strong><br />
                                    회원은 카드 비밀번호 및 PIN 번호가 타인에게 노출되지 않도록 철저히 관리해야 하며, 고의 또는 중대한 과실로 인한 유출로 발생한 손해는 회원이 책임집니다.
                                </div>
                                <div className={styles.pinActionRow}>
                                    <button className={styles.pinCancelBtn} onClick={() => setActiveModal(null)}>
                                        닫기
                                    </button>
                                    <button className={styles.nextBtn} onClick={handleAgreeClick}>
                                        위 약관에 동의합니다
                                    </button>
                                </div>
                            </>
                        )}

                        {activeModal === 'term2' && (
                            <>
                                <h3>[필수] 신용조회 및 제공 동의</h3>
                                
                                <div className={styles.termsContentBox}>
                                    <strong>1. 수집 및 이용 목적</strong><br />
                                    신용카드 발급 심사, 결제능력 평가, 신용 질서 문란 행위 조사 및 카드 이용 한도 산정<br /><br />
                                    
                                    <strong>2. 제공받는 자</strong><br />
                                    NICE평가정보, 코리아크레딧뷰로(KCB) 등 국가 지정 신용평가기관<br /><br />
                                    
                                    <strong>3. 보유 및 이용 기간</strong><br />
                                    본 동의서의 효력은 카드 발급 심사 완료 시점 또는 고객의 동의 철회 시까지 유지됩니다.
                                </div>
                                <div className={styles.pinActionRow}>
                                    <button className={styles.pinCancelBtn} onClick={() => setActiveModal(null)}>
                                        닫기
                                    </button>
                                    <button className={styles.nextBtn} onClick={handleAgreeClick}>
                                        위 약관에 동의합니다
                                    </button>
                                </div>
                            </>
                        )}

                        {activeModal.startsWith('benefits_') && (() => {
                            const card = cardList.find(c => c.id === activeModal.split('_')[1]);
                            return (
                                <>
                                    <h3>{card.name} 주요 혜택</h3>
                                    <div className={styles.termsContentBox}>
                                        <ul style={{ margin: 0, paddingLeft: '20px' }}>
                                            {card.benefits.map((benefit, idx) => (
                                                <li key={idx} style={{ marginBottom: '10px' }}><strong>{benefit}</strong></li>
                                            ))}
                                        </ul>
                                    </div>
                                    <button className={styles.nextBtn} onClick={() => setActiveModal(null)}>닫기</button>
                                </>
                            );
                        })()}

                    </div>
                </div>
            )}

            {/* 핀 번호 입력 모달 */}
            {isPinModalOpen && (
                <div className={styles.pinModalBackdrop}>
                    <div className={styles.pinModalContent} onClick={(e) => e.stopPropagation()}>
                        <h3>보안 핀(PIN) 번호를 입력해주세요</h3>
                        
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

export default CreditCard;
