import React, { useState, useEffect } from 'react';
import styles from './Kiosk.module.css';
import BackgroundImage from '../../images/Kiosk/kioskBackground.jpg';
import KioskLogin from './KioskLogin';
import KioskTaskSelect from './KioskTaskSelect';
import KioskComplete from './KioskComplete';
import KioskNonMember from './KioskNonMember';
import CustomModal from '../../components/common/CustomModal';

const Kiosk = () => {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        userId: '',
        ssn: '',
        userName: '',
        task: '',
        taskType: '',
    });
    const [dashboardData, setDashboardData] = useState({
        waitingCount: 0,
        averageTime: 0,
        availableCounter: 0
    });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAiMode, setIsAiMode] = useState(false);

    const fetchDashboardData = async () => {
        try {
            const [waitingRes, timeRes, counterRes] = await Promise.all([
                fetch('/api/kiosk/waiting-count'),
                fetch('/api/kiosk/average-time'),
                fetch('/api/kiosk/available-count')
            ]);
            const waitingCountText = await waitingRes.text();
            const averageTimeText = await timeRes.text();
            const availableCounterText = await counterRes.text();
            setDashboardData({
                waitingCount: Number(waitingCountText) || 0,
                averageTime: parseFloat(averageTimeText) || 0,
                availableCounter: Number(availableCounterText) || 0
            });
        } catch (error) {
            console.error("Failed to fetch dashboard data", error);
        }
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchDashboardData();
        const interval = setInterval(fetchDashboardData, 5000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (step === 1) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            fetchDashboardData();
        }
    }, [step]);

    const handleGoHome = () => {
        setFormData({ userId: '', ssn: '', task: '', userName: '', taskType: '' });
        setIsAiMode(false);
        setStep(1);
    };

    const handleAddMoreTask = () => {
        setFormData(prev => ({ ...prev, task: '', taskType: '' }));
        setIsAiMode(false); // 추가 업무 접수는 직접 접수로 간주
        setStep(4); 
    };

    const handleAiAutoSelect = () => {
        setIsAiMode(true);
        setStep(5);
    };

    const getCurrentDateTime = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = now.getHours();
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? '오후' : '오전';
        const headerHours = hours % 12 || 12;
        return <>{year}년{month}월{day}일<br />{ampm} {headerHours} : {minutes}</>;
    };

    const renderStep = () => {
        switch (step) {
            case 0:
                return (
                    <KioskNonMember 
                        formData={formData} 
                        setFormData={setFormData} 
                        onNext={() => setStep(3)} 
                        onPrev={() => setStep(1)} 
                    />
                );
            case 1:
                return (
                    <div className={styles.mainArea}>
                        <img src={BackgroundImage} alt="배경이미지" className={styles.backgroundImage} />
                        <div className={styles.content}>
                            <div className={styles.progressIndicator}>
                                <div className={`${styles.step} ${styles.active}`}></div>
                                <div className={styles.step}></div>
                                <div className={styles.step}></div>
                                <div className={styles.step}></div>
                                <div className={styles.step}></div>
                            </div>
                            <h1 className={styles.title}>비교는 빠르게<br/>선택은 안전하게</h1>
                            <p className={styles.subtitle}>AI 기반 창구 자동배치로 최적의 담당자를<br/>연결해 드립니다.</p>
                        </div>
                        <div className={styles.infoCards}>
                            <div className={styles.card}><span className={styles.cardTitle}>현재 대기 고객</span><span className={styles.cardValue}>{dashboardData.waitingCount}</span></div>
                            <div className={styles.card}><span className={styles.cardTitle}>예상 대기 시간</span><span className={styles.cardValue}>약 {Math.round(dashboardData.averageTime)}분</span></div>
                            <div className={styles.card}><span className={styles.cardTitle}>운영중인 창구</span><span className={styles.cardValue}>{dashboardData.availableCounter}</span></div>
                        </div>
                        <div className={styles.buttonContainer}>
                            <button className={styles.startButton} onClick={() => setStep(2)} disabled={dashboardData.availableCounter === 0}>회원 접수 시작하기</button>
                            <button className={styles.startButton2} onClick={() => setStep(0)} disabled={dashboardData.availableCounter === 0}>비회원 접수 시작하기</button>
                        </div>
                    </div>
                );
            case 2:
                return <KioskLogin formData={formData} setFormData={setFormData} onNext={() => setStep(3)} onPrev={() => setStep(1)} />;
            case 3:
                return (
                    <div className={styles.loginArea}>
                        <div className={styles.userInfoWrapper}>
                            <span className={styles.userBadge}>
                                <span className={styles.badgeText}>본인확인완료</span>
                                <span className={styles.badgeDot}>•</span>
                                <span className={styles.userName}>{formData.userName}님</span>
                            </span>
                        </div>

                        <div className={styles.progressIndicator}>
                            <div className={styles.step}></div>
                            <div className={styles.step}></div>
                            <div className={`${styles.step} ${styles.active}`}></div>
                            <div className={styles.step}></div>
                            <div className={styles.step}></div>
                        </div>
                        <div className={styles.loginHeader} style={{ marginTop: '20px' }}>
                            <h2 className={styles.loginTitle}>접수 방식을 선택해주세요</h2>
                            <p className={styles.loginSubtitle}>원하시는 접수 방식을 선택해주세요.</p>
                        </div>
                        
                        <div className={styles.modeSelectContainer}>
                            <div className={styles.modeCard}>
                                <h3 className={styles.modeTitle}>자동 접수</h3>
                                <p className={styles.modeDesc}>
                                    고객님의 정보를 AI가 분석하여<br/>
                                    <strong>가장 빠르고 적합한 창구</strong>로<br/>
                                    알아서 안내해 드립니다.
                                </p>
                                <button className={styles.modeButtonPrimary} onClick={handleAiAutoSelect}>
                                    자동 접수하기
                                </button>
                            </div>

                            <div className={styles.modeCard}>
                                <h3 className={styles.modeTitle}>직접 접수</h3>
                                <p className={styles.modeDesc}>
                                    원하시는 <strong>업무를 직접 선택</strong>하여<br/>
                                    해당 창구로 번호표를<br/>
                                    발급받습니다.
                                </p>
                                <button className={styles.modeButtonSecondary} onClick={() => {
                                    setIsAiMode(false);
                                    setStep(4);
                                }}>
                                    직접 접수하기
                                </button>
                            </div>
                        </div>
                        
                        <button className={styles.prevButton} onClick={() => setStep(1)}>
                            ← 처음으로
                        </button>
                    </div>
                );
            case 4:
                return <KioskTaskSelect formData={formData} setFormData={setFormData} onNext={() => setStep(5)} onPrev={() => setStep(3)} userName={formData.userName} />;
            case 5:
                return <KioskComplete 
                            formData={formData} 
                            onGoHome={handleGoHome} 
                            onAddMore={handleAddMoreTask} 
                            userName={formData.userName} 
                            isAiMode={isAiMode}
                        />;
            default:
                return null;
        }
    };

    return (
        <div className={styles.kioskContainer}>
            <div className={styles.header}>
                <span className={styles.logo}>BankScope</span>
                <span className={styles.dateTime}>{getCurrentDateTime()}</span>
            </div>
            {renderStep()}
            <CustomModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="알림"
                onConfirm={() => {
                    console.log("확인 버튼 클릭됨");
                    setIsModalOpen(false);
                }}
                onCancel={() => {
                    console.log("취소 버튼 클릭됨");
                    setIsModalOpen(false);
                }}
                confirmText="확인"
                cancelText="취소"
            >
                <div style={{ textAlign: 'center', fontSize: '1.2rem', color: '#333' }}>
                    <p>현재 개발중인 기능입니다.</p>
                </div>
            </CustomModal>
        </div>
    );
};

export default Kiosk;