import React, {useCallback, useState} from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import Loading from '../../components/common/Loading.jsx';
import styles from './AiRecommend.module.css';
import { useModal } from '../../context/ModalContext';

const CATEGORY_LABEL = {
    DEPOSIT: '예금',
    SAVINGS: '적금',
    LOAN: '대출',
    CHECKING: '입출금',
};

const AiRecommend = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiResult, setAiResult] = useState(null);
    const [error, setError] = useState(null);
    const { openModal } = useModal();
    const showAlert = useCallback((message, onConfirm = null) => {
        openModal({
            message: message,
            onConfirm: onConfirm
        });
    }, [openModal]);


    const handleAiRecommend = async () => {
        setIsAiLoading(true);
        setError(null);
        try {
            const res = await fetch(`/py/recommend/${user.id}`);
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || '추천 서버 오류');
            }
            const data = await res.json();
            setAiResult(data.products ?? []);
        } catch (e) {
            showAlert('금융상품 추천은 로그인 상태에서만 가능합니다.', () => {
                navigate('/login');
            })
            setError(e.message);
        } finally {
            setIsAiLoading(false);
        }
    };

    return (
        <div className={styles.pageContainer}>
            <div className={styles.aiCard}>
                <h2 className={styles.aiTitle}> AI 맞춤 금융상품 추천</h2>

                {!isAiLoading && !aiResult && (
                    <>
                        <p className={styles.aiDesc}>
                            고객님의 자산, 거래 패턴, 대출 현황을 AI가 분석하여<br />
                            가장 적합한 금융상품을 추천해 드립니다.
                        </p>
                        {error && (
                            <p style={{ color: '#ff6b6b', marginBottom: '12px' }}>{error}</p>
                        )}
                        <button className={styles.aiButton} onClick={handleAiRecommend}>
                            내 맞춤 상품 분석하기
                        </button>
                    </>
                )}

                {isAiLoading && (
                    <div className={styles.aiLoadingBox}>
                        <Loading />
                        <p style={{ margin: 0, fontWeight: '600', fontSize: '18px', marginTop: '10px' }}>
                            AI가 고객님의 데이터를 심층 분석 중입니다...
                        </p>
                        <p style={{ fontSize: '14px', color: '#b2dfdb', margin: 0 }}>
                            (약 3~5초 정도 소요될 수 있습니다)
                        </p>
                    </div>
                )}

                {!isAiLoading && aiResult && (
                    <div className={styles.aiResultContainer}>
                        <div style={{ marginBottom: '20px' }}>
                            <p style={{ fontWeight: '600', margin: '0 0 5px 0', fontSize: '20px' }}>
                                분석이 완료되었습니다!
                            </p>
                            <p style={{ margin: 0, fontSize: '15px', color: '#d1e8e2' }}>
                                고객님께 가장 적합한 맞춤 상품입니다.
                            </p>
                        </div>

                        <div className={styles.resultList}>
                            {aiResult.length === 0 ? (
                                <p style={{ color: '#d1e8e2' }}>추천 상품이 없습니다.</p>
                            ) : (
                                aiResult.map((item) => (
                                    <div key={item.productId} className={styles.aiResultCard}>
                                        <div className={styles.aiResultInfo}>
                                            <span className={styles.badge}>
                                                {CATEGORY_LABEL[item.productCategory] ?? item.productCategory}
                                            </span>
                                            <h4>{item.productName}</h4>
                                            <p>{item.description}</p>
                                        </div>
                                        <div className={styles.aiResultRate}>
                                            최고 연 {item.maxInterestRate}%
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className={styles.btnGroup}>
                            <button
                                className={styles.aiButton}
                                onClick={() => navigate(-1)}
                            >
                                돌아가기
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AiRecommend;