import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom'; // useParams 추가
import styles from './Board.module.css';
import Loading from '../../components/common/Loading'; // 로딩 컴포넌트가 있다면 활용

const BoardDetail = () => {
    const navigate = useNavigate();
    const { id } = useParams(); // App.js 라우터 설정에 따라 'id' 혹은 'boardId'로 받음

    const [article, setArticle] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchArticle = async () => {
            setIsLoading(true);
            try {
                const response = await fetch(`/api/board/?boardId=${id}`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });

                const data = await response.json();

                if (data.result === 'SUCCESS') {
                    setArticle(data.article);
                } else {
                    alert('존재하지 않는 게시글입니다.');
                    navigate(-1);
                }
            } catch (error) {
                console.error('상세 페이지 로딩 에러:', error);
                alert('데이터를 불러오는 중 오류가 발생했습니다.');
            } finally {
                setIsLoading(false);
            }
        };

        if (id) {
            fetchArticle();
        }
    }, [id, navigate]);

    // 로딩 중일 때 표시
    if (isLoading) return <div className={styles.container}>데이터를 불러오는 중입니다...</div>;

    // 데이터가 없을 때 표시
    if (!article) return null;

    return (
        <div className={styles.container}>
            <div className={styles.layoutWrapper}>
                <div className={styles.detailHeader}>
                    <div className={styles.detailRow}>
                        <div className={styles.detailLabel}>제목</div>
                        <div className={styles.detailValue}>{article.title}</div>
                    </div>
                    <div className={styles.detailRow}>
                        <div className={styles.detailLabel}>등록일</div>
                        <div className={styles.detailValue}>
                            {article.createdAt ? article.createdAt.split('T')[0].replaceAll('-', '.') : '-'}
                        </div>
                    </div>
                    {/* 조회수가 필요하다면 추가 */}
                    <div className={styles.detailRow}>
                        <div className={styles.detailLabel}>조회수</div>
                        <div className={styles.detailValue}>{article.viewCount}</div>
                    </div>
                    <div className={styles.detailRow}>
                        <div className={styles.detailLabel}>작성자</div>
                        <div className={styles.detailValue}>
                            {article.boardType === "notice" ? "새소식 관리자" : "이벤트 관리자"}
                        </div>
                    </div>
                </div>

                <div className={styles.detailContent}>
                    {article.content && article.content.split('\n').map((line, idx) => (
                        <React.Fragment key={idx}>
                            {line}
                            <br/>
                        </React.Fragment>
                    ))}
                </div>
                <div className={styles.btnArea}>
                    <button
                        className={styles.listBtn}
                        onClick={() => navigate(`/board/${article.boardType}`)}
                    >
                        목록
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BoardDetail;