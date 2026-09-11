import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import greenCardImg from '../../images/Home/Card1.png';
import blueCardImg from '../../images/Home/Card2.png';
import styles from './CardManage.module.css';
import Loading from '../../components/common/Loading.jsx';
import { useModal } from '../../context/ModalContext.jsx';

const CardManage = () => {
    const navigate = useNavigate();

    const { openModal } = useModal();
    const showAlert = (message, callback = null) => {
        openModal({
            message: message,
            onConfirm: callback
        });
    };

    const [cards, setCards] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const [expandedCardId, setExpandedCardId] = useState(null);
    const [cardDetails, setCardDetails] = useState({});

    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [cardToDelete, setCardToDelete] = useState(null);

    // 1. 카드 목록 조회
    useEffect(() => {
        fetchCardList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchCardList = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/card/', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            });
            const data = await response.json();

            switch (data.result) {
                case 'SUCCESS':
                    setCards(data.cards);
                    break;
                case 'FAILURE_SESSION':
                    showAlert('세션이 만료되었습니다. 다시 로그인해주세요.', () => {
                        navigate('/Login');
                    });
                    break;
                default:
                    showAlert('카드 목록을 불러오는데 실패했습니다.');
            }
        } catch (error) {
            console.error('API 통신 오류:', error);
            showAlert('서버와 연결할 수 없습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    // 2. 카드 상세 조회 (상세보기 클릭 시)
    const handleExpandClick = async (cardId) => {
        if (expandedCardId === cardId) {
            setExpandedCardId(null);
            return;
        }

        if (!cardDetails[cardId]) {
            setIsLoading(true);
            try {
                const response = await fetch(`/api/card/${cardId}`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                });
                const data = await response.json();

                switch (data.result) {
                    case 'SUCCESS':
                        setCardDetails(prev => ({ ...prev, [cardId]: data.card }));
                        setExpandedCardId(cardId);
                        break;
                    case 'FAILURE_SESSION':
                        showAlert('세션이 만료되었습니다. 다시 로그인해주세요.', () => {
                            navigate('/Login');
                        });
                        break;
                    default:
                        showAlert('카드 상세 정보를 불러오는데 실패했습니다.');
                }
            } catch (error) {
                console.error('카드 상세 조회 실패:', error);
                showAlert('서버와 연결할 수 없습니다.');
            } finally {
                setIsLoading(false);
            }
        } else {
            setExpandedCardId(cardId);
        }
    };

    // 3. 카드 해지 요청
    const handleDeleteConfirm = async () => {
        if (!cardToDelete) return;
        setDeleteModalOpen(false);
        setIsLoading(true);

        try {
            const response = await fetch(`/api/card/${cardToDelete}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
            });
            const data = await response.json();

            switch (data.result) {
                case 'SUCCESS':
                    showAlert('카드가 성공적으로 해지되었습니다.', () => {
                        setCardToDelete(null);
                        fetchCardList();
                    });
                    break;
                case 'FAILURE_SESSION':
                    showAlert('세션이 만료되었습니다. 다시 로그인해주세요.', () => {
                        navigate('/Login');
                    });
                    break;
                default:
                    showAlert('카드 해지에 실패했습니다.');
            }
        } catch (error) {
            console.error('카드 해지 오류:', error);
            showAlert('서버와 연결할 수 없습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    const openDeleteModal = (cardId) => {
        setCardToDelete(cardId);
        setDeleteModalOpen(true);
    };

    return (
        <div className={styles.cardManageContainer}>
            {isLoading && <Loading />}
            <h2 className={styles.sectionTitle}>내 카드 관리</h2>

            {cards.length === 0 ? (
                <div className={styles.emptyBox}>
                    <p>보유하신 카드가 없습니다.</p>
                </div>
            ) : (
                <div className={styles.cardList}>
                    {cards.map((card) => (
                        <div key={card.cardId} className={styles.cardItem}>

                            <div className={styles.cardMain}>
                                <div className={styles.cardLeft}>
                                    <img
                                        src={card.cardColor === 'blue' ? blueCardImg : greenCardImg}
                                        alt={card.cardName}
                                        className={styles.cardImage}
                                    />
                                    <div className={styles.cardInfo}>
                                        <span className={styles.cardBadge}>
                                            {card.cardType === 'CREDIT' ? '신용카드' : '체크카드'}
                                        </span>
                                        <h4 className={styles.cardName}>{card.cardName}</h4>
                                        <p className={styles.cardNumber}>{card.cardNumber}</p>
                                    </div>
                                </div>
                                <div className={styles.cardRight}>
                                    <button
                                        className={styles.deleteBtn}
                                        onClick={() => openDeleteModal(card.cardId)}
                                    >
                                        해지하기
                                    </button>
                                    <button
                                        className={styles.moreBtn}
                                        onClick={() => handleExpandClick(card.cardId)}
                                    >
                                        상세보기 {expandedCardId === card.cardId ? '∧' : '∨'}
                                    </button>
                                </div>
                            </div>

                            {expandedCardId === card.cardId && cardDetails[card.cardId] && (
                                <div className={styles.cardDetailBox}>
                                    <div className={styles.detailRow}>
                                        <span className={styles.detailLabel}>CVC 번호</span>
                                        <span className={styles.detailValue}>{cardDetails[card.cardId].cvc}</span>
                                    </div>
                                    <div className={styles.detailRow}>
                                        <span className={styles.detailLabel}>유효 기간</span>
                                        <span className={styles.detailValue}>{cardDetails[card.cardId].validThru}</span>
                                    </div>
                                    <div className={styles.detailRow}>
                                        <span className={styles.detailLabel}>발급 일자</span>
                                        <span className={styles.detailValue}>
                                            {cardDetails[card.cardId].issuedAt ? cardDetails[card.cardId].issuedAt.split('T')[0] : '-'}
                                        </span>
                                    </div>
                                    <div className={styles.detailRow}>
                                        <span className={styles.detailLabel}>상태</span>
                                        <span className={` ${styles.detailValue} ${cardDetails[card.cardId].status === 'ACTIVE' ? styles.statusActive : ''}${cardDetails[card.cardId].status === 'ISSUING' ? styles.statusISSUING : ''}${(cardDetails[card.cardId].status !== 'ACTIVE' && cardDetails[card.cardId].status !== 'ISSUING') ? styles.statusINActive : ''}`}>{cardDetails[card.cardId].status === 'ACTIVE'
                                             ? '정상 사용중'
                                             : cardDetails[card.cardId].status === 'ISSUING'
                                                 ? '발급중'
                                                 : '정지/해지'}
                                        </span>
                                        </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {deleteModalOpen && (
                <div className={styles.modalBackdrop}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <h3>카드 해지</h3>
                        <p style={{ marginTop: '15px', color: '#555', lineHeight: '1.5' }}>
                            정말 이 카드를 해지하시겠습니까?<br/>
                            해지된 카드는 복구할 수 없으며, 연결된 정기 결제가 모두 중단됩니다.
                        </p>
                        <div className={styles.modalBtnGroup}>
                            <button className={styles.cancelBtn} onClick={() => setDeleteModalOpen(false)}>취소</button>
                            <button className={styles.confirmBtn} onClick={handleDeleteConfirm}>해지하기</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CardManage;
