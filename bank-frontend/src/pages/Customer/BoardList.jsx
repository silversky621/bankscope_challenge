import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styles from './Board.module.css';

const BoardList = () => {
    const { boardType } = useParams();
    const navigate = useNavigate();

    const title = boardType === 'notice' ? '새소식' : '이벤트';

    // 데이터 관리를 위한 State
    const [articles, setArticles] = useState([]);
    const [pageVo, setPageVo] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);

    // boardType(탭)이 바뀌면 무조건 1페이지로 초기화
    useEffect(() => {
        setCurrentPage(1);
    }, [boardType]);

    // 게시글 목록 및 페이징 데이터 불러오기
    useEffect(() => {
        const fetchList = async () => {
            setIsLoading(true);
            try {
                const response = await fetch(`/api/board/list?boardType=${boardType}&page=${currentPage}`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                });
                const data = await response.json();

                if (data.result === 'SUCCESS') {
                    setArticles(data.articles);
                    setPageVo(data.pageVo);
                }
            } catch (error) {
                console.error('목록 로딩 에러:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchList();
    }, [boardType, currentPage]); // 탭이나 페이지가 변경될 때마다 실행

    // 페이징 버튼 렌더링 함수
    const renderPagination = () => {
        if (!pageVo) return null;

        const pages = [];
        for (let i = pageVo.startPage; i <= pageVo.endPage; i++) {
            pages.push(
                <button
                    key={i}
                    className={`${styles.pageBtn} ${currentPage === i ? styles.activePage : ''}`}
                    onClick={() => setCurrentPage(i)}
                >
                    {i}
                </button>
            );
        }

        return (
            <div className={styles.pagination}>
                <button
                    className={styles.pageBtn}
                    onClick={() => setCurrentPage(prev => Math.max(pageVo.minPage, prev - 1))}
                    disabled={currentPage === pageVo.minPage} // 1페이지면 이전 버튼 비활성화
                >
                    &lt;
                </button>
                {pages}
                <button
                    className={styles.pageBtn}
                    onClick={() => setCurrentPage(prev => Math.min(pageVo.maxPage, prev + 1))}
                    disabled={currentPage === pageVo.maxPage} // 마지막 페이지면 다음 버튼 비활성화
                >
                    &gt;
                </button>
            </div>
        );
    };

    return (
        <div className={styles.container}>
            <div className={styles.layoutWrapper}>
                <h2 className={styles.pageTitle}>{title}</h2>

                <table className={styles.boardTable}>
                    <thead>
                    <tr>
                        <th className={styles.colId}>번호</th>
                        <th className={styles.colTitle}>제목</th>
                        <th className={styles.colDate}>등록일</th>
                    </tr>
                    </thead>
                    <tbody>
                    {isLoading ? (
                        <tr>
                            <td colSpan="3" style={{ textAlign: 'center', padding: '50px 0' }}>로딩 중...</td>
                        </tr>
                    ) : articles.length > 0 ? (
                        articles.map((article, index) => {
                            // 역순 번호 계산: 전체 게시물 수 - ((현재페이지 - 1) * 페이지당게시물수) - 인덱스
                            const listNum = pageVo.totalCount - ((pageVo.requestPage - 1) * pageVo.rowCount) - index;
                            return (
                                <tr
                                    key={article.boardId}
                                    onClick={() => navigate(`/board/detail/${article.boardId}`)}
                                    className={styles.tableRow}
                                >
                                    <td className={styles.colId}>{listNum}</td>
                                    <td className={styles.colTitleText}>{article.title}</td>
                                    <td className={styles.colDate}>
                                        {article.createdAt ? article.createdAt.split('T')[0].replaceAll('-', '.') : '-'}
                                    </td>
                                </tr>
                            );
                        })
                    ) : (
                        <tr>
                            <td colSpan="3" style={{ textAlign: 'center', padding: '50px 0' }}>게시글이 없습니다.</td>
                        </tr>
                    )}
                    </tbody>
                </table>

                {/* 하단 페이징 영역 */}
                {renderPagination()}
            </div>
        </div>
    );
};

export default BoardList;