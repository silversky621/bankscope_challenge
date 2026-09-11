import React, {useState, useEffect, useRef} from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './PinSetup.module.css';
import Loading from '../../components/common/Loading';
import CustomModal from '../../components/common/CustomModal';

const PinSetup = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);

    const [name, setName] = useState('');
    const [rrnFirst, setRrnFirst] = useState('');
    const [rrnSecond, setRrnSecond] = useState('');
    const [phone, setPhone] = useState('');
    const [verifyCode, setVerifyCode] = useState('');
    const [isCodeSent, setIsCodeSent] = useState(false);
    const [isVerified, setIsVerified] = useState(false);
    const [isLoading, setIsLoading] = useState(false); // 로딩 상태 추가

    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [pinError, setPinError] = useState('');

    const isValidPhone = /^01[016789]\d{8}$/.test(phone);

    const isFormFilled = name.trim() !== '' && rrnFirst.length === 6 && rrnSecond.length === 7 && isValidPhone;

    const [modalConfig, setModalConfig] = useState({
        isOpen: false,
        message: '',
        onConfirm: null
    });
    const modalActionHandled = useRef(false);

    const showAlert = (message, callback = null) => {
        modalActionHandled.current = false; // 핸들러 리셋
        setModalConfig({
            isOpen: true,
            message: message,
            onConfirm: callback // 확인 버튼 클릭 시 실행할 함수 (필요할 때만 사용)
        });
    };
    const handleModalClose = () => {
        if (modalActionHandled.current) return;
        modalActionHandled.current = true;
        setModalConfig(prev => ({ ...prev, isOpen: false }));
        if (modalConfig.onConfirm) {
            modalConfig.onConfirm();
        }
    };
    // 1단계 로직
    const handleSendCode = async () => {
        if (!isFormFilled) {
            showAlert('이름, 주민등록번호, 휴대폰 번호를\n모두 올바르게 입력해주세요.');
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch('/api/sms/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone }),
            });
            const data = await response.json();

            switch (data.result) {
                case 'SUCCESS':
                    showAlert('인증번호가 전송되었습니다.');
                    setIsCodeSent(true);
                    break;
                case 'FAILURE':
                    showAlert('인증번호 전송에 실패했습니다.\n번호를 다시 확인해주세요.');
                    break;
                case 'FAILURE_SESSION' :
                    showAlert('세션이 만료되 었습니다. 로그인 후 다시 시도해주세요.');
                    break;
                case 'FAILURE_NOT_SAME_PHONE' :
                    showAlert('전화번호가 일치하지 않습니다.\n다시 시도해주세요.');
                    break;
                default:
                    showAlert('서버 오류가 발생했습니다.\n잠시 후 다시 시도해주세요.');
                    break;
            }
        } catch (error) {
            console.error('전송 에러:', error);
            showAlert('인증번호 전송 중 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyCode = async () => {
        if (verifyCode.length === 0) {
            alert('인증번호를 입력해주세요.');
            return;
        }
        setIsLoading(true); // 로딩 시작
        try {
            const response = await fetch('/api/sms/verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ phone, code: verifyCode }),
            });
            const data = await response.json();
            if (data.result === 'SUCCESS') {
                showAlert('인증이 완료되었습니다.');
                setIsVerified(true);
            } else {
                showAlert('인증번호가 일치하지 않습니다.');
            }
        } catch (error) {
            console.error('인증번호 확인 오류:', error);
            showAlert('인증번호 확인 중 오류가 발생했습니다.');
        } finally {
            setIsLoading(false); // 로딩 종료
        }
    };

    // 단계 전환 로직
    const handleNextStep = () => {
        if (step === 1 && isVerified) setStep(2);
        else if (step === 4) navigate('/My');
    };

    // 2, 3단계: 키패드 입력 로직
    const handleKeyClick = (val) => {
        if (step === 2 && pin.length < 6) {
            setPin(prev => prev + val);
        } else if (step === 3 && confirmPin.length < 6) {
            setConfirmPin(prev => prev + val);
            setPinError('');
        }
    };

    const handleDelete = () => {
        if (step === 2) setPin(prev => prev.slice(0, -1));
        else if (step === 3) setConfirmPin(prev => prev.slice(0, -1));
    };

    useEffect(() => {
        if (step === 2 && pin.length === 6) {
            setTimeout(() => setStep(3), 300);
        }
    }, [pin, step]);

    // 3단계: 핀 번호 확인 및 서버 최종 등록 로직
    useEffect(() => {
        // 서버에 핀 번호를 저장하는 내부 비동기 함수
        const registerPinToServer = async () => {
            setIsLoading(true); // 로딩 시작
            try {
                // 요청하신 형식: /api/pin/?pin=123456 (POST 방식)
                const response = await fetch('/api/pin/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    // 필요한 경우 body에 추가 정보를 담을 수 있습니다.
                    body: JSON.stringify({ phone: phone, pin: confirmPin }),
                });

                const data = await response.json();

                if (data.result === 'SUCCESS') {
                    setStep(4); // 성공 시 4단계(완료)로 이동
                } else {
                    showAlert('핀 번호 등록에 실패했습니다.\n다시 시도해주세요.');
                    setConfirmPin('');
                    setPin('');
                    setStep(2); // 실패 시 2단계(번호 입력)로 리셋
                }
            } catch (error) {
                console.error('핀 등록 통신 에러:', error);
                showAlert('서버와 통신 중 오류가 발생했습니다.');
            } finally {
                setIsLoading(false); // 로딩 종료
            }
        };

        // 조건: 3단계이고, 입력한 핀 번호가 6자리일 때 실행
        if (step === 3 && confirmPin.length === 6) {
            if (pin === confirmPin) {
                // 1차 비밀번호와 2차 확인 번호가 일치하면 서버로 전송
                setTimeout(() => {
                    registerPinToServer();
                }, 300);
            } else {
                // 일치하지 않으면 에러 메시지 출력 후 초기화
                setPinError('핀 번호가 일치하지 않습니다. 다시 입력해주세요.');
                setTimeout(() => setConfirmPin(''), 800);
            }
        }
    }, [confirmPin, pin, step, phone]);

    // 보안 키패드 배열
    const keypadLayout = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

    // 핀 번호 동그라미 렌더링 함수
    const renderPinDots = (currentLength) => {
        return (
            <div className={styles.pinDisplay}>
                {[...Array(6)].map((_, i) => (
                    <div key={i} className={`${styles.pinDot} ${i < currentLength ? styles.pinDotFilled : ''}`} />
                ))}
            </div>
        );
    };

    return (
        <div className={styles.pageContainer}>
            {isLoading && <Loading message="인증 처리 중..." />}
            <div className={styles.contentBox}>

                <div className={styles.sidebar}>
                    <h2 className={styles.logoTitle}>BANKSCOPE</h2>
                    <h3 className={styles.pageTitle}>핀 번호 발급</h3>

                    <ul className={styles.stepList}>
                        {[
                            { id: 1, text: '본인 확인' },
                            { id: 2, text: '핀 번호 설정' },
                            { id: 3, text: '핀 번호 확인' },
                            { id: 4, text: '발급 완료' }
                        ].map((s) => (
                            <li key={s.id} className={step >= s.id ? styles.activeStep : styles.inactiveStep}>
                                <div className={styles.stepCircle}>{s.id}</div>
                                <span>{s.text}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className={styles.mainContent}>

                    {step === 1 && (
                        <div className={styles.stepContainer}>
                            <h3 className={styles.sectionTitle}>본인 인증 절차가 필요합니다.</h3>
                            <p className={styles.sectionSubtitle}>SMS 인증</p>

                            <div className={styles.formGroup}>
                                <label>이름</label>
                                <input type="text" placeholder="이름 입력" className={styles.input} value={name} onChange={(e) => setName(e.target.value)} />
                            </div>
                            <div className={styles.formGroup}>
                                <label>주민등록번호</label>
                                <div className={styles.rrnWrapper}>
                                    <input type="text" maxLength={6} placeholder="앞 6자리" className={styles.input} value={rrnFirst} onChange={(e) => setRrnFirst(e.target.value.replace(/[^0-9]/g, ''))} />
                                    <span>-</span>
                                    <input type="password" maxLength={7} placeholder="뒤 7자리" className={styles.input} value={rrnSecond} onChange={(e) => setRrnSecond(e.target.value.replace(/[^0-9]/g, ''))} />
                                </div>
                            </div>
                            <div className={styles.formGroup}>
                                <label>휴대폰 번호</label>
                                <div className={styles.phoneWrapper}>
                                    <input
                                        type="text"
                                        placeholder="- 없이 010부터 입력"
                                        className={styles.input}
                                        value={phone}
                                        maxLength={11}
                                        onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                                    />
                                    <button className={`${styles.actionBtn} ${!isFormFilled ? styles.disabledActionBtn : ''}`} onClick={handleSendCode} disabled={!isFormFilled || isVerified || isLoading}>
                                        {isCodeSent ? '재전송' : '인증번호 전송'}
                                    </button>
                                </div>

                                {phone.length > 0 && !isValidPhone && (
                                    <p style={{ color: '#e74c3c', fontSize: '12px', marginTop: '5px' }}>올바른 휴대폰 번호 형식이 아닙니다.</p>
                                )}
                            </div>

                            {isCodeSent && (
                                <div className={styles.formGroup}>
                                    <label>인증번호</label>
                                    <div className={styles.verifyWrapper}>
                                        <input type="text" placeholder="인증번호 입력" className={styles.input} value={verifyCode} onChange={(e) => setVerifyCode(e.target.value.replace(/[^0-9]/g, ''))} disabled={isVerified} />
                                        <button className={`${styles.actionBtn} ${isVerified ? styles.verifiedBtn : ''}`} onClick={handleVerifyCode} disabled={isVerified || verifyCode.length === 0 || isLoading}>
                                            {isVerified ? '인증완료' : '인증 확인'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            <button className={isVerified ? styles.nextBtnActive : styles.nextBtnDisabled} onClick={handleNextStep} disabled={!isVerified}>
                                다음 단계로
                            </button>
                        </div>
                    )}

                    {/* 2단계 & 3단계: 핀 번호 입력 및 확인 */}
                    {(step === 2 || step === 3) && (
                        <div className={styles.stepContainer}>
                            <h3 className={styles.sectionTitle}>
                                {step === 2 ? '사용하실 핀 번호를 입력해주세요.' : '핀 번호를 한 번 더 입력해주세요.'}
                            </h3>
                            <p className={styles.sectionSubtitle}>
                                {step === 2 ? '안전한 거래를 위한 6자리 숫자' : (pinError || '비밀번호 확인')}
                            </p>
                            {pinError && <p className={styles.errorMessage}>{pinError}</p>}

                            {renderPinDots(step === 2 ? pin.length : confirmPin.length)}

                            <div className={styles.keypad}>
                                {keypadLayout.map((key, idx) => {
                                    if (key === '') return <div key={idx} className={styles.emptyKey} />;
                                    if (key === 'del') {
                                        return (
                                            <button key={idx} className={styles.keyBtn} onClick={handleDelete}>
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"></path>
                                                    <line x1="18" y1="9" x2="12" y2="15"></line>
                                                    <line x1="12" y1="9" x2="18" y2="15"></line>
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
                        </div>
                    )}

                    {/* 4단계: 완료 화면 */}
                    {step === 4 && (
                        <div className={styles.completeContainer}>
                            <div className={styles.successIcon}>
                                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#4A9C82" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                                </svg>
                            </div>
                            <h3 className={styles.sectionTitle}>핀 번호 설정 완료</h3>
                            <p className={styles.sectionSubtitle} style={{marginBottom: '50px'}}>
                                새로운 핀 번호가 성공적으로 등록되었습니다.<br/>
                                이제 안전하게 서비스를 이용해보세요.
                            </p>
                            <button className={styles.nextBtnActive} onClick={handleNextStep}>
                                마이페이지로 돌아가기
                            </button>
                        </div>
                    )}

                </div>
            </div>
            <CustomModal
                isOpen={modalConfig.isOpen}
                onClose={handleModalClose}
                title="안내"
                onConfirm={handleModalClose}
                confirmText="확인"
            >
                <div style={{ padding: '20px', textAlign: 'center', fontSize: '1.2rem', color: '#333', whiteSpace: 'pre-line', lineHeight: '1.5' }}>
                    {modalConfig.message}
                </div>
            </CustomModal>
        </div>
    );

};


export default PinSetup;
