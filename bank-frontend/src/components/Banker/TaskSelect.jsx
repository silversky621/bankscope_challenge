import React, {useEffect, useState} from "react";
import styles from "./TaskSelect.module.css";
import accountIcon from '../../images/Banker/account-create.png';
import withdrawIcon from '../../images/Banker/GetCash.png';
import depositIcon from '../../images/Banker/Deposit.png';
import cardIcon from '../../images/Banker/card.png'
import MoneyFly from '../../images/Banker/transfer.png';
import loansIcon from '../../images/Home/Loans.png';
import corporationIcon from '../../images/Home/Corporation.png';
import WarningIcon from '../../images/Home/Warning.png';
import Transfer from '../../images/Home/Transfer.png';
import PiggyBank from '../../images/Home/PiggyBank.png';
import CorporateIcon from '../../images/Banker/corporate.png';

const TaskSelect = ({ onSelectTask, initialPage = 1 , selectedTask}) => {

    const [currentPage, setCurrentPage] = useState(initialPage);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedId, setSelectedId] = useState(1);
    const [userName, setUserName] = useState("고객");


    const allTasks = [
        { id: 1, title: "입출금 계좌 개설", subTitle: "Open an Account", icon: accountIcon },
        { id: 18, title: "법인등록", subTitle: "Corporate Register", icon: CorporateIcon },
        { id: 3, title: "입금", subTitle: "Deposit", icon: depositIcon },
        { id: 2, title: "출금", subTitle: "Withdraw", icon: withdrawIcon },
        { id: 4, title: "이체", subTitle: "Transfer", icon: Transfer},
        { id: 5, title: "카드수령", subTitle: "Manage Card Status", icon: cardIcon },
        { id: 6, title: "체크카드 발급", subTitle: "Check Card Issued", icon: cardIcon },
        { id: 10, title: "신용카드 발급", subTitle: "Credit Card Issued", icon: cardIcon },
        { id: 8, title: "예금", subTitle: "Deposit Account", icon: PiggyBank },
        { id: 9, title: "적금", subTitle: "Savings Account", icon: PiggyBank },
        { id: 14, title: "법인계좌 개설", subTitle: "Corporate Account", icon: corporationIcon },
        { id: 7, title: "통장비밀번호 변경", subTitle: "Account Password", icon: accountIcon},
        { id: 12, title: "금융상품가입", subTitle: "Financial Product", icon: MoneyFly },
        { id: 11, title: "대출 상환", subTitle: "Pay Loan", icon: loansIcon },
        { id: 13, title: "기업대출", subTitle: "Corporate Loan", icon: loansIcon },
        { id: 15, title: "법인카드 발급", subTitle: "Corporate Card Issued", icon: corporationIcon },
        { id: 16, title: "부도관리", subTitle: "bankruptcy management", icon: WarningIcon },
        { id: 17, title: "연체관리", subTitle: "Delinquency Management", icon: WarningIcon }

    ];

    // 1. 검색어 필터링을 먼저 수행 (중복 선언 방지)
    const filteredTasks = allTasks.filter((task) =>
        task.title.includes(searchTerm) || 
        task.subTitle.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // 2. 필터링된 결과 기반으로 페이지네이션 계산
    const itemsPerPage = 6;
    const totalPages = Math.ceil(filteredTasks.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentTasks = filteredTasks.slice(indexOfFirstItem, indexOfLastItem);

    // 3. 핸들러 함수들
    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1); // 검색 시 무조건 1페이지로 리셋
    };

    const handlePageChange = (pageNumber) => {
        if (pageNumber >= 1 && pageNumber <= totalPages) {
            setCurrentPage(pageNumber);
        }
    };

    const handleCardClick = (task) => {

        setSelectedId(task.id);
        if (onSelectTask) {
            onSelectTask(task.title, currentPage);
        }
    };
    
    useEffect(() => {
        const fetchUserName = async () => {
            const userId = selectedTask?.userId;
            console.log(userId)
            if (userId) {
                try {
                    const response = await fetch(`/api/user/info?userId=${userId}`);
                    if (response.ok) {
                        const data = await response.json();
                        if (data.result === 'SUCCESS' && data.user) {
                            setUserName(data.user.name);
                        } else {
                            console.error("고객 정보 조회 실패:", data.message);
                            setUserName("고객");
                        }
                    } else {
                        console.error("고객 정보 API 호출 실패:", response.status);
                        setUserName("고객");
                    }
                } catch (error) {
                    console.error("고객 정보 조회 중 에러 발생:", error);
                    setUserName("고객");
                }
            } else {
                // selectedTask.userId가 없을 경우, onSelectTask.userName을 직접 사용
                if (onSelectTask && onSelectTask.userName) {
                    setUserName(onSelectTask.userName);
                } else {
                    setUserName("고객");
                }
            }
        };
    
        fetchUserName();
    }, [onSelectTask]);

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h2 className={styles.welcomeText}>{userName} 고객님의 업무를 선택해주세요</h2>
            </header>

            <div className={styles.searchSection}>
                <div className={styles.searchBar}>
                    <span className={styles.searchIcon}>🔍</span>
                    <input
                        type="text"
                        placeholder="업무명을 검색하세요"
                        className={styles.searchInput}
                        value={searchTerm}
                        onChange={handleSearchChange} // 💡 수정된 핸들러
                    />
                </div>
                <div className={styles.tags}>
                    <span>#계좌 개설</span>
                    <span>#대출</span>
                    <span>#카드</span>
                </div>
            </div>

            <div className={styles.taskGrid}>
                {currentTasks.length > 0 ? (
                    currentTasks.map((task) => (
                        <div
                            key={task.id}
                            className={`${styles.taskCard} ${selectedId === task.id ? styles.activeCard : ""}`}
                            onClick={() => handleCardClick(task)}
                        >
                            <div className={styles.iconBox}>
                                <img src={task.icon} alt={task.title} className={styles.taskIconImg} />
                            </div>
                            <div className={styles.textBox}>
                                <span className={styles.taskTitle}>{task.title}</span>
                                <p className={styles.taskSubTitle}>{task.subTitle}</p>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className={styles.noResult} style={{ gridColumn: '1 / span 2', textAlign: 'center', padding: '50px', color: '#888' }}>
                        검색 결과가 없습니다.
                    </div>
                )}
            </div>

            {/* 4. 결과가 있을 때만 페이지네이션 렌더링 */}
            {totalPages > 0 && (
                <footer className={styles.pagination}>
                    <button
                        className={`${styles.pageBtn} ${currentPage === 1 ? styles.disabledBtn : ""}`}
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                    >
                        &lt;
                    </button>
                    {[...Array(totalPages)].map((_, index) => (
                        <button
                            key={index + 1}
                            className={`${styles.pageBtn} ${currentPage === index + 1 ? styles.activePageBtn : ""}`}
                            onClick={() => handlePageChange(index + 1)}
                        >
                            {index + 1}
                        </button>
                    ))}
                    <button
                        className={`${styles.pageBtn} ${currentPage === totalPages ? styles.disabledBtn : ""}`}
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                    >
                        &gt;
                    </button>
                </footer>
            )}
        </div>
    );
};

export default TaskSelect;
