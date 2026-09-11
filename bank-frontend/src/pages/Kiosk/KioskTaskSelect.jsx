import React, { useState, useEffect } from 'react';
import styles from './Kiosk.module.css';


const KioskTaskSelect = ({ setFormData, onNext, onPrev, userName }) => {
    const [activeCategory, setActiveCategory] = useState(0);
    const [waitingCounts, setWaitingCounts] = useState({ '빠른 업무': 0, '상담 업무': 0, '기업 • 특수': 0 });

    useEffect(() => {
        const fetchWaiting = async () => {
            try {
                const res = await fetch('/api/kiosk/waiting-count-by-type');
                if (res.ok) {
                    const data = await res.json();
                    setWaitingCounts(data);
                }
            } catch (e) {
                console.error('대기 인원 조회 실패:', e);
            }
        };
        fetchWaiting();
        const interval = setInterval(fetchWaiting, 5000);
        return () => clearInterval(interval);
    }, []);

    const categories = [
        {
            id: 0,
            title: '빠른 업무',
            subtitle: 'EXPRESS SERVICE',
            items: ['입출금 계좌개설','입금', '출금','이체','체크카드 발급','통장 비밀번호 변경','카드수령'],
            timeLabel: '건당 3~5분',
            typeKey: '빠른 업무',
            columns: 1
        },
        {
            id: 1,
            title: '상담 업무',
            subtitle: 'CONSULTATION',
            items: ['예금','적금','대출 상환','금융상품가입','신용카드 발급','신용대출','소상공인 대출', '주택담보대출', '전세자금대출', '연금신청'],
            timeLabel: '건당 10분',
            typeKey: '상담 업무',
            columns: 2
        },
        {
            id: 2,
            title: '기업 • 특수',
            subtitle: 'CORPORATE / SPECIAL',
            items: ['기업대출', '법인계좌 개설','법인카드 발급','부도관리','연체관리'],
            timeLabel: '건당 25분',
            typeKey: '기업 • 특수',
            columns: 1
        }
    ];
    // 업무 선택 시 formData에 저장하고 다음 단계로 이동
    const handleTaskClick = (task, taskType) => {
        setFormData(prev => ({ ...prev, task: task, taskType: taskType }));
        onNext();
    };

    return (
        <div className={styles.taskSelectArea}>
            {/* 상단 로그인 유저 정보 표시 */}
            <div className={styles.userInfoWrapper}>
                <span className={styles.userBadge}>
                    <span className={styles.badgeText}>본인확인완료</span>
                    <span className={styles.badgeDot}>•</span>
                    <span className={styles.userName}>{userName}님</span>
                </span>
            </div>

            <div className={styles.progressIndicator}>
                <div className={styles.step}></div>
                <div className={styles.step}></div>
                <div className={styles.step}></div>
                <div className={`${styles.step} ${styles.active}`}></div>
                <div className={styles.step}></div>
            </div>

            <div className={styles.taskHeader}>
                <h2 className={styles.taskMainTitle}>어떤 업무로 방문하셨나요?</h2>
            </div>

            {/* 업무 카테고리 카드 영역 */}
            <div className={styles.categoryContainer}>
                {categories.map((cat) => (
                    <div
                        key={cat.id}
                        className={`${styles.categoryCard} ${activeCategory === cat.id ? styles.activeCard : ''}`}
                        onClick={() => setActiveCategory(cat.id)}
                    >
                        <div className={styles.categoryTitleBox}>
                            <h3 className={styles.categoryTitle}>{cat.title}</h3>
                            <p className={styles.categorySubtitle}>{cat.subtitle}</p>
                        </div>

                        {/* 활성화된 카테고리일 때만 세부 버튼 렌더링 */}
                        {activeCategory === cat.id && (
                            <>
                                <div className={styles.taskGrid} style={{ gridTemplateColumns: `repeat(${cat.columns}, 1fr)` }}>
                                    {cat.items.map((item, index) => (
                                        <button
                                            key={index}
                                            className={styles.taskItemBtn}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleTaskClick(item, cat.title);
                                            }}
                                        >
                                            {item}
                                        </button>
                                    ))}
                                </div>
                                <div className={styles.categoryFooter}>
                                    {cat.timeLabel}·대기 {waitingCounts[cat.typeKey] ?? 0}명
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </div>

            {/* 이전으로 버튼 */}
            <button className={styles.prevButton} onClick={onPrev}>
                ← 이전으로
            </button>
        </div>
    );
};

export default KioskTaskSelect;