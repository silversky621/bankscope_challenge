import React, { useState, useEffect, useCallback } from 'react';
import styles from './Card.module.css';
import { useModal } from '../../context/ModalContext';

const Card = ({ selectedTask, onSuccess }) => {
    // 카드수령(웹에서 이미 신청한 카드를 수령)이면, 발급 폼 대신 '카드 목록'(신청 카드 정보 + 활성화 버튼)을 기본으로 보여준다.
    const [activeTab, setActiveTab] = useState(
        selectedTask?.taskDetailType === '카드수령' ? 'list' : 'register'
    );
    const { openModal } = useModal();

    const showAlert = useCallback((message, onConfirm = null) => {
        openModal({
            message: message,
            onConfirm: onConfirm
        });
    }, [openModal]);

    const initialFormData = {
        cardName: '',
        cardType: 'CREDIT', // 'CHECK' or 'CREDIT'
        accountId: '',
        paymentDay: 14, // Default payment day
        userId: selectedTask?.userId || null,
        cardColor: 'blue', // 'blue' or 'green'
        creditLimit: null,
        password: ''
    };

    const [formData, setFormData] = useState(initialFormData);
    const [accounts, setAccounts] = useState([]);
    const [cardList, setCardList] = useState([]);
    const [selectedCardId, setSelectedCardId] = useState(null);

    // Fetch user's accounts
    useEffect(() => {
        const fetchAccounts = async () => {
            if (!selectedTask || !selectedTask.userId) return;
            try {
                const response = await fetch(`/api/account/user/${selectedTask.userId}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.result === 'SUCCESS') {
                        // Filter for deposit accounts only
                        const depositAccounts = data.accounts.filter(acc => acc.accountType === 'CHECKING');
                        setAccounts(depositAccounts);
                        /*if (depositAccounts.length > 0) {
                            setFormData(prev => ({ ...prev, accountId: depositAccounts[0].accountId }));
                        }*/
                    }
                }
            } catch (error) {
                console.error("Error fetching accounts:", error);
                showAlert('계좌 목록을 불러오는 중 오류가 발생했습니다.');
            }
        };
        fetchAccounts();
    }, [selectedTask, showAlert]);

    const fetchCardList = useCallback( async () => {
        if (!selectedTask || !selectedTask.userId) return;


        try {
            const response = await fetch(`/api/card/workspace/list?userId=${selectedTask.userId}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.result === 'SUCCESS') {
                    setCardList(data.cards || []);
                } else if (data.result === 'FAILURE_SESSION') {
                    showAlert('세션이 만료되었습니다. 다시 로그인해주세요.');
                } else {
                    showAlert('카드 목록을 불러오는데 실패했습니다.');
                }
            } else {
                showAlert('서버 응답 오류로 카드 목록을 불러오지 못했습니다.');
            }
        } catch (error) {
            console.error("Error fetching card list:", error);
            showAlert('네트워크 오류가 발생했습니다.');
        }
    }, [selectedTask, showAlert]);
    const handleTabChange = (tab) => {
        setActiveTab(tab);
        if (tab === 'list') {
            setSelectedCardId(null); // 사용자가 클릭하는 순간 초기화!
        }
    };
    useEffect(() => {
        if (activeTab === 'list') {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            fetchCardList().catch(console.error);
        }
    }, [activeTab, fetchCardList]);

    const handleChange = (e) => {
        const {name, value} = e.target;
        setFormData(prev => ({...prev, [name]: value}));
    };

    const handleColorSelection = (color) => {
        setFormData(prev => ({ ...prev, cardColor: color }));
    };

    const resetForm = () => {
        setFormData(initialFormData);
    };

    const handleSubmit = async () => {
        if (!formData.cardName.trim()) {
            showAlert('카드 별칭을 입력해주세요.');
            return;
        }
        const requestDto = {
            ...formData,
            userId: selectedTask.userId,
        };

        if (formData.cardType !== 'CREDIT') {
            delete requestDto.paymentDay;
            delete requestDto.creditLimit;
        }

        try {
            const response = await fetch('/api/card/workspace', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestDto)
            });

            if (response.ok) {
                const data = await response.json();
                if (data.result === 'SUCCESS') {
                    showAlert('카드가 성공적으로 발급되었습니다.', () => {
                        setActiveTab('list'); // 발급 성공 알림 창의 '확인'을 누르면 목록 탭으로 이동
                        if (onSuccess) onSuccess(); // 그리고 onSuccess (태스크 완료 등) 실행
                    });
                } else {
                    showAlert(`카드 발급 실패: ${data.result}`);
                }
            } else {
                showAlert('서버 응답 오류로 카드 발급에 실패했습니다.');
            }
        } catch (error) {
            console.error("Error creating card:", error);
            showAlert('네트워크 오류가 발생했습니다.');
        }
    };

    const handleStatusUpdate = async (cardId, currentStatus) => {
        if (!selectedTask || !selectedTask.userId) return;

        // 예시: ISSUING 상태일 때만 ACTIVE로 변경 가능
        if (currentStatus !== 'ISSUING') {
            showAlert('현재 발급 처리(ISSUING -> ACTIVE)가 가능한 상태가 아닙니다.');
            return;
        }

        try {
            const response = await fetch(`/api/card/workspace/${cardId}/status?status=ACTIVE&userId=${selectedTask.userId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.result === 'SUCCESS') {
                    showAlert('카드 발급이 완료(활성화)되었습니다.', async () => {
                        await fetchCardList(); // 목록 새로고침
                        if (onSuccess) onSuccess();
                    });
                } else {
                    showAlert(`카드 상태 변경 실패: ${data.result}`);
                }
            } else {
                showAlert('서버 응답 오류로 상태 변경에 실패했습니다.');
            }
        } catch (error) {
            console.error("Error updating card status:", error);
            showAlert('네트워크 오류가 발생했습니다.');
        }
    };


        const handleDeleteCard = async () => {
        if (!selectedTask || !selectedTask.userId) return;
        if (!selectedCardId) {
            showAlert('해지할 카드를 먼저 선택해주세요.');
            return;
        }

        try {
            const response = await fetch(`/api/card/workspace/${selectedCardId}?userId=${selectedTask.userId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.result === 'SUCCESS') {
                    showAlert('선택한 카드가 성공적으로 해지(삭제)되었습니다.', async () => {
                        await fetchCardList(); // 목록 새로고침
                        setSelectedCardId(null);
                        if (onSuccess) onSuccess();
                    });
                } else {
                    showAlert(`카드 해지 실패: ${data.result}`);
                }
            } else {
                showAlert('서버 응답 오류로 카드 해지에 실패했습니다.');
            }
        } catch (error) {
            console.error("Error deleting card:", error);
            showAlert('네트워크 오류가 발생했습니다.');
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.headerTabs}>
                <div
                    className={`${styles.tab} ${activeTab === 'register' ? styles.active : ''}`}
                    onClick={() => handleTabChange('register')} // 변경
                >
                    카드 발급
                </div>
                <div
                    className={`${styles.tab} ${activeTab === 'list' ? styles.active : ''}`}
                    onClick={() => handleTabChange('list')} // 변경
                >
                    고객 카드 조회/해지
                </div>
            </div>

            {activeTab === 'register' && (
                <div className={styles.registerContent}>
                    <div className={styles.formGrid}>
                        <div className={styles.inputGroup}>
                            <label>이름</label>
                            <div style={{ width: '100%', height: '2rem', textAlign: 'center' }}>{selectedTask?.userName || '고객 정보 없음'}</div>
                        </div>

                        <div className={styles.inputGroup}>
                            <label>카드 별칭</label>
                            <input type="text" name="cardName" value={formData.cardName} onChange={handleChange} />
                        </div>

                        <div className={`${styles.inputGroup} ${styles.fullWidth}`}>
                            <label>디자인 선택</label>
                            <div className={styles.cardDesignSelector}>
                                <div
                                    className={`${styles.cardVisual} ${formData.cardColor === 'blue' ? styles.selectedDesign : ''}`}
                                    style={{ backgroundColor: "#6d97de" }}
                                    onClick={() => handleColorSelection('blue')}
                                >
                                    <div className={styles.cardChip}></div>
                                    <div className={styles.cardLogo}>●●</div>
                                </div>
                                <div
                                    className={`${styles.cardVisual} ${formData.cardColor === 'green' ? styles.selectedDesign : ''}`}
                                    style={{ backgroundColor: "#4e9a8e" }}
                                    onClick={() => handleColorSelection('green')}
                                >
                                    <div className={styles.cardChip}></div>
                                    <div className={styles.cardLogo}>●●</div>
                                </div>
                            </div>
                        </div>

                        <div className={styles.inputGroup}>
                            <label>카드 종류</label>
                            <div className={styles.radioRow}>
                                <label className={styles.radioLabel}>
                                    <input type="radio" name="cardType" value="CREDIT" checked={formData.cardType === 'CREDIT'} onChange={handleChange} />
                                    <span className={styles.customRadio}></span> 신용
                                </label>
                                <label className={styles.radioLabel}>
                                    <input type="radio" name="cardType" value="CHECK" checked={formData.cardType === 'CHECK'} onChange={handleChange} />
                                    <span className={styles.customRadio}></span> 체크
                                </label>
                            </div>
                        </div>

                        <div className={styles.inputGroup}>
                            <label>출금 계좌</label>
                            <select name="accountId" value={formData.accountId} onChange={handleChange}>
                                <option value="">출금 계좌를 선택해주세요.</option>
                                {accounts.map(acc => (
                                    <option key={acc.accountId} value={acc.accountId}>
                                        {`${acc.productName} ${acc.accountNumber}`}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {formData.cardType === 'CREDIT' && (
                            <>
                                <div className={styles.inputGroup}>
                                    <label>카드 한도</label>
                                    <input type="number" name="creditLimit" value={formData.creditLimit} onChange={handleChange} />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>결제일</label>
                                    <select name="paymentDay" value={formData.paymentDay} onChange={handleChange}>
                                        <option value={5}>매월 5일</option>
                                        <option value={14}>매월 14일</option>
                                        <option value={25}>매월 25일</option>
                                    </select>
                                </div>
                            </>
                        )}


                    </div>

                    <div className={styles.registerActions}>
                        <button className={styles.btnReset} onClick={resetForm}>초기화</button>
                        <button className={styles.btnSubmit} onClick={handleSubmit}>카드 발급 실행</button>
                    </div>
                </div>
            )}

            {/* --- 탭 2: 카드 목록 리스트 --- */}
            {activeTab === 'list' && (
                <div className={styles.listContent}>
                    {cardList.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '20px', color: '#888' }}>
                            조회된 카드가 없습니다.
                        </div>
                    ) : (
                        <div className={styles.cardList}>
                            {cardList.map((card) => (
                                <div
                                    key={card.cardId}
                                    className={`${styles.cardItem} ${selectedCardId === card.cardId ? styles.selectedCard : ''}`}
                                    onClick={() => setSelectedCardId(selectedCardId === card.cardId ? null : card.cardId)}
                                >
                                    <div
                                        className={styles.cardVisual}
                                        style={{
                                            backgroundColor: card.cardColor === 'blue' ? '#6d97de' : '#4e9a8e'
                                        }}
                                    >
                                        <div className={styles.cardChip}></div>
                                        <div className={styles.cardLogo}>●●</div>
                                    </div>
                                    <div className={styles.cardInfo}>
                                        <div className={styles.tagRow}>
                                            <span className={styles.tagType}>{card.cardType === 'CREDIT' ? '신용' : '체크'}</span>
                                            <span className={`${styles.tagStatus} 
                                                ${card.status === 'ISSUING'
                                                ? styles.pending
                                                : card.status === 'INACTIVE' || card.status === 'CANCELED'
                                                ? styles.inActive
                                                : styles.activeStatus}
                                                `}>
                                                {card.status}
                                            </span>

                                            {/* 발급 대기 중(ISSUING)인 카드인 경우, 발급 완료(활성화) 버튼 표시 */}
                                            {card.status === 'ISSUING' && (
                                                <button
                                                    className={styles.btnStatusUpdate}
                                                    onClick={(e) => {
                                                        e.stopPropagation(); // 카드 선택 이벤트 방지
                                                        handleStatusUpdate(card.cardId, card.status).catch(console.error);
                                                    }}
                                                >
                                                    발급 처리
                                                </button>
                                            )}
                                        </div>
                                        <div className={styles.infoRow}>
                                            <span className={styles.label}>카드 별칭:</span>
                                            <span className={styles.value}>{card.cardName || '이름 없음'}</span>
                                        </div>
                                        <div className={styles.infoRow}>
                                            <span className={styles.label}>카드 번호:</span>
                                            <span className={styles.value}>{card.cardNumber}</span>
                                        </div>
                                        <div className={styles.infoRow}>
                                            <span className={styles.label}>{card.status === 'ISSUING' ? '신청일' : '발급일'} :</span>
                                            <span className={styles.value}>
                                                {card.issuedAt ? new Date(card.issuedAt).toLocaleDateString() : '-'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className={styles.listActions}>
                        <button
                            className={styles.btnTerminate}
                            onClick={handleDeleteCard}
                            disabled={!selectedCardId}
                            style={{ opacity: selectedCardId ? 1 : 0.5, cursor: selectedCardId ? 'pointer' : 'not-allowed' }}
                        >
                            선택한 카드 해지 실행
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Card;
