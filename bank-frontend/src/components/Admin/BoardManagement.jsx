import React, { useState, useEffect } from 'react';
import styles from './BoardManagement.module.css';
import CustomModal from '../common/CustomModal';

const BoardManagement = ({ type, title }) => {
    const [viewMode, setViewMode] = useState('list'); // 'list', 'write', 'edit'
    
    // 삭제 전용 모달 상태
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    
    // 공통 알림(Alert) 모달 상태
    const [alertModal, setAlertModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        onCloseCallback: null 
    });

    const [postList, setPostList] = useState([]);
    
    // 페이지네이션 및 상태
    const [isLoading, setIsLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0); 
    
    const itemsPerPage = 5;

    // 작성, 수정 폼 상태
    const [inputTitle, setInputTitle] = useState('');
    const [inputContent, setInputContent] = useState('');

    // 에러 원천 차단
    let currentType = type || '';
    if (!currentType && title) {
        currentType = title.includes('이벤트') ? 'event' : 'notice';
    }

    let safeType = currentType.toLowerCase().trim();
    if (safeType === 'news' || safeType === '새소식') safeType = 'notice';
    if (safeType === 'events' || safeType === '이벤트') safeType = 'event';

    // 탭이 바뀔 때 리셋
    useEffect(() => {
        setCurrentPage(1);
        setViewMode('list');
    }, [safeType, title]);


    // ==========================================
    // 공통 알림 모달 제어 함수
    // ==========================================
    const showAlert = (title, message, onCloseCallback = null) => {
        setAlertModal({ isOpen: true, title, message, onCloseCallback });
    };

    const handleAlertClose = () => {
        if (alertModal.onCloseCallback) {
            alertModal.onCloseCallback();
        }
        setAlertModal(prev => ({ ...prev, isOpen: false }));
    };


    // ==========================================
    // 1. 게시글 목록 조회 (GET)
    // ==========================================
    const fetchBoardData = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/board/list?boardType=${safeType}&page=${currentPage}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include', 
            });

            if (!response.ok) throw new Error('API 연결 실패');

            const data = await response.json();

            if (data.result === "SUCCESS") {
                setPostList(data.articles || []);
                
                setTotalPages(data.pageVo?.maxPage || 1);
                setTotalCount(data.pageVo?.totalCount || 0); 
            } else {
                setPostList([]);
                setTotalCount(0);
            }
        } catch (error) {
            console.error(`${title} API 연결 실패.`, error);
            
            const mockData = Array.from({ length: 12 }, (_, i) => ({
                boardId: 12 - i, 
                title: `${title} 게시판의 ${12 - i}번째 테스트 글입니다.`,
                createdAt: '2026-03-11T12:00:00',
                content: '상세 내용'
            }));

            const startIndex = (currentPage - 1) * itemsPerPage;
            setPostList(mockData.slice(startIndex, startIndex + itemsPerPage));
            setTotalPages(Math.ceil(mockData.length / itemsPerPage));
            setTotalCount(mockData.length); 
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchBoardData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [safeType, currentPage]);


    // ==========================================
    // 2. 게시글 등록 및 수정 (POST / PATCH)
    // ==========================================
    const handleSubmit = async () => {
        if (!inputTitle.trim() || !inputContent.trim()) {
            showAlert('입력 확인', '제목과 내용을 모두 입력해주세요.');
            return;
        }

        const params = new URLSearchParams();
        params.append('boardType', safeType);
        params.append('title', inputTitle);
        params.append('content', inputContent);
        
        if (viewMode === 'edit' && selectedItem) {
            params.append('boardId', selectedItem.boardId); 
        }

        const method = viewMode === 'write' ? 'POST' : 'PATCH';

        try {
            const response = await fetch(`/api/board/?${params.toString()}`, {
                method: method,
                credentials: 'include',
            });

            const data = await response.json();
            
            if (data.result === "SUCCESS") {
                const successMsg = viewMode === 'write' ? '게시글이 성공적으로 등록되었습니다.' : '게시글이 성공적으로 수정되었습니다.';
                
                showAlert('저장 완료', successMsg, () => {
                    setViewMode('list');
                    fetchBoardData(); 
                });
            } else {
                showAlert('요청 실패', '요청 처리에 실패했습니다.');
            }
        } catch (error) {
            console.error('Submit Error:', error);
            showAlert('서버 오류', '서버 오류가 발생했습니다.');
        }
    };


    // ==========================================
    // 3. 게시글 삭제 (DELETE)
    // ==========================================
    const confirmDelete = async () => {
        setIsModalOpen(false); 

        try {
            const response = await fetch(`/api/board/?boardId=${selectedItem.boardId}`, { 
                method: 'DELETE',
                credentials: 'include',
            });
            
            const data = await response.json();
            
            if (data.result === "SUCCESS") {
                showAlert('삭제 완료', '해당 게시글이 성공적으로 삭제되었습니다.', () => {
                    if (postList.length === 1 && currentPage > 1) {
                        setCurrentPage(currentPage - 1);
                    } else {
                        fetchBoardData(); 
                    }
                });
            } else {
                showAlert('삭제 실패', '삭제 권한이 없거나 실패했습니다.');
            }
        } catch (error) {
            console.error('Delete Error:', error);
            setPostList(postList.filter(p => p.boardId !== selectedItem.boardId));
        }
    };


    // --- 이벤트 핸들러 ---
    const handleWrite = () => {
        setSelectedItem(null); 
        setInputTitle('');
        setInputContent('');
        setViewMode('write');
    };

    const handleEdit = async (item) => {
        setSelectedItem(item);
        
        try {
            const response = await fetch(`/api/board/?boardId=${item.boardId}`, {
                method: 'GET',
                credentials: 'include'
            });
            const data = await response.json();
            
            if(data.result === "SUCCESS" && data.article) {
                setInputTitle(data.article.title);
                setInputContent(data.article.content);
            } else {
                setInputTitle(item.title);
                setInputContent(item.content || '');
            }
        } catch {
            setInputTitle(item.title);
            setInputContent(item.content || '');
        }
        
        setViewMode('edit');
    };

    const handleDeleteClick = (item) => {
        setSelectedItem(item);
        setIsModalOpen(true);
    };

    const handlePageChange = (pageNumber) => {
        if (pageNumber >= 1 && pageNumber <= totalPages) {
            setCurrentPage(pageNumber);
        }
    };

    return (
        <div className={styles.container}>
            {viewMode === 'list' ? (
                <>
                    <div className={styles.headerRow}>
                        <h2 className={styles.title}>{title} 관리</h2>
                        <button className={styles.writeBtn} onClick={handleWrite}>작성</button>
                    </div>

                    <table className={styles.table}>
                        <thead className={styles.thead}>
                            <tr>
                                <th className={styles.th} style={{ width: '80px' }}>번호</th>
                                <th className={`${styles.th} ${styles.titleCell}`}>제목</th>
                                <th className={styles.th} style={{ width: '150px' }}>등록일</th>
                                <th className={styles.th} style={{ width: '150px' }}>관리</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan="4" style={{ textAlign: 'center', padding: '40px' }}>
                                        데이터를 불러오는 중입니다...
                                    </td>
                                </tr>
                            ) : postList.length > 0 ? (
                                postList.map((item, index) => {
                                    const displayNum = totalCount - ((currentPage - 1) * itemsPerPage) - index;

                                    return (
                                        <tr key={item.boardId} className={styles.tr}>
                                            <td className={styles.td}>{displayNum}</td>
                                            <td className={`${styles.td} ${styles.titleCell}`}>{item.title}</td>
                                            <td className={styles.td}>
                                                {item.createdAt ? item.createdAt.split('T')[0].replaceAll('-', '.') : ''}
                                            </td>
                                            <td className={styles.td}>
                                                <button className={styles.deleteBtn} onClick={() => handleDeleteClick(item)}>삭제</button>
                                                <button className={styles.editBtn} onClick={() => handleEdit(item)}>수정</button>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan="4" style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
                                        등록된 게시글이 없습니다.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>

                    {/* 페이지네이션 */}
                    {!isLoading && totalPages > 0 && (
                        <div className={styles.pagination}>
                            <button 
                                onClick={() => handlePageChange(currentPage - 1)} 
                                disabled={currentPage === 1}
                                className={styles.pageBtn}
                            >
                                &lt;
                            </button>
                            
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                <button 
                                    key={page} 
                                    onClick={() => handlePageChange(page)}
                                    className={`${styles.pageBtn} ${currentPage === page ? styles.activePage : ''}`}
                                >
                                    {page}
                                </button>
                            ))}

                            <button 
                                onClick={() => handlePageChange(currentPage + 1)} 
                                disabled={currentPage === totalPages}
                                className={styles.pageBtn}
                            >
                                &gt;
                            </button>
                        </div>
                    )}
                </>
            ) : (
                <div className={styles.formContainer}>
                    <h2 className={styles.formTitle}>{viewMode === 'write' ? `${title} 작성` : `${title} 수정`}</h2>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>제목</label>
                        <input 
                            type="text" 
                            className={styles.inputTitle} 
                            placeholder="제목" 
                            value={inputTitle}
                            onChange={(e) => setInputTitle(e.target.value)}
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>내용</label>
                        <textarea 
                            className={styles.textarea} 
                            placeholder="내용을 입력하세요." 
                            value={inputContent}
                            onChange={(e) => setInputContent(e.target.value)}
                        />
                    </div>
                    <div className={styles.btnRow}>
                        <button className={styles.cancelBtn} onClick={() => setViewMode('list')}>취소</button>
                        <button className={styles.submitBtn} onClick={handleSubmit}>등록</button>
                    </div>
                </div>
            )}

            {/* 삭제 전용 확인 모달  */}
            <CustomModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="삭제 확인"
                onConfirm={confirmDelete}
                onCancel={() => setIsModalOpen(false)}
                confirmText="삭제 실행"
                cancelText="취소"
            >
                <div style={{ textAlign: 'center', padding: '20px 0', fontSize: '15px', color: '#334155' }}>
                    <strong style={{ fontSize: '16px', color: '#1e293b' }}>{selectedItem?.title}</strong><br/><br/>
                    해당 게시글을 정말로 삭제하시겠습니까?<br/>
                    삭제된 데이터는 복구할 수 없습니다.
                </div>
            </CustomModal>

            {/* 공통 안내(Alert) 전용 모달 */}
            <CustomModal
                isOpen={alertModal.isOpen}
                onClose={handleAlertClose}
                title={alertModal.title}
                onConfirm={handleAlertClose}
                confirmText="확인"
            >
                <div style={{ textAlign: 'center', padding: '30px 0', fontSize: '16px', color: '#334155', fontWeight: '500' }}>
                    {alertModal.message}
                </div>
            </CustomModal>

        </div>
    );
};

export default BoardManagement;
