import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import styles from './MyPage.module.css';
import profileImg from "../../images/Mypage/Profile.png"
import lockImg from "../../images/Mypage/Lock.png"
/*import otpImg from "../../images/Mypage/Mobile.png"*/
import lockBlackImg from "../../images/Mypage/LockRe.png"
import arrowImg from "../../images/Mypage/ArrowRight.png"
import Loading from '../../components/common/Loading';
import { useModal } from '../../context/ModalContext';
import CardManage from './CardManage.jsx';

const MyPage = () => {
    const { openModal } = useModal();
    const showAlert = (message, callback = null) => {
        openModal({
            message: message,
            onConfirm: callback
        });
    };
    const { user, loading, logout } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('accounts');
    const [accounts, setAccounts] = useState([]);

    // 이메일 인증 관련 상태
    const [emailCode, setEmailCode] = useState('');
    const [isEmailSent, setIsEmailSent] = useState(false);
    const [isEmailVerified, setIsEmailVerified] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // 정보 수정 관련 상태
    const [newName, setNewName] = useState('');
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newPasswordConfirm, setNewPasswordConfirm] = useState('');

    useEffect(() => {
        if (!loading && !user) {
            showAlert('로그인 후 이용가능합니다.', () => {
                navigate("/Login");
            })
        } else if (user && newName === '') {
             setNewName(user.name);
        }
    }, [user, loading, navigate, showAlert]);

    useEffect(() => {
        if (activeTab === 'accounts' && user) {
            const fetchMyAccounts = async () => {
                try {
                    const response = await fetch('/api/account/list', {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    const data = await response.json();
                    
                    if (data.result === 'SUCCESS') {
                        setAccounts(data.accounts);
                    } else {
                        console.error("계좌 불러오기 실패:", data.message);
                    }
                } catch (error) {
                    console.error("API 호출 중 에러 발생:", error);
                }
            };

            fetchMyAccounts();
        }
    }, [activeTab, user]);

    if (loading) return <Loading />; // Loading 컴포넌트 사용
    if (!user) return null;

    console.log("User Info:", user);

    // 이메일 인증번호 발송
    const handleSendEmailCode = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/user/email-send?email=${user.email}&type=password`, { method: 'POST' });
            const data = await response.json();

            if (data.result === 'SUCCESS') {
                showAlert('인증코드가 발송되었습니다.');
                setIsEmailSent(true);
            } else {
                showAlert('인증코드 발송에 실패했습니다.');
            }
        } catch (error) {
            console.error('Error sending email code:', error);
            showAlert('오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    // 이메일 인증번호 확인
    const handleVerifyEmailCode = async () => {
        if (!emailCode) {
            showAlert('인증번호를 입력해주세요.');
            return;
        }
        setIsLoading(true);
        try {
            const response = await fetch('/api/user/email-code-verify', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.email, code: emailCode }),
            });
            const data = await response.json();

            if (data.result === 'SUCCESS') {
                showAlert('이메일 인증에 성공했습니다.');
                setIsEmailVerified(true);
            } else if (data.result === 'FAILURE_EXPIRED') {
                showAlert('인증코드가 만료되었습니다. 다시 시도해주세요.');
                setIsEmailSent(false); // 다시 발송하도록 상태 초기화
            } else {
                showAlert('인증코드가 일치하지 않습니다.');
            }
        } catch (error) {
            console.error('Error verifying email code:', error);
            showAlert('오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    // 정보 수정 (비밀번호/이름)
    const handleUpdateInfo = async () => {
        if (!isEmailVerified) {
            showAlert('먼저 이메일 인증을 완료해주세요.');
            return;
        }

        if (!oldPassword) {
            showAlert('기존 비밀번호를 입력해주세요.');
            return;
        }
        if (!newPassword) {
            showAlert('새 비밀번호를 입력해주세요.');
            return;
        }

        // 유효성 검사 (정규식)
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,50}$/;
        const nameRegex = /^[가-힣]+$/;

        if (!passwordRegex.test(newPassword)) {
            showAlert('비밀번호는 영문 대·소문자, 숫자, 특수문자를 모두 포함하여 8자 이상이어야 합니다.');
            return;
        }

        if (newPassword !== newPasswordConfirm) {
            showAlert('새 비밀번호가 일치하지 않습니다.');
            return;
        }

        if (newName && !nameRegex.test(newName)) {
            showAlert('이름은 한글만 입력 가능하며, 영문이나 숫자는 포함할 수 없습니다.');
            return;
        }

        setIsLoading(true);
        try {
            const requestBody = {
                oldPassword: oldPassword,
                newPassword: newPassword,
            };
            
            // 이름이 변경되었을 경우에만 추가
            if (newName !== user.name) {
                requestBody.name = newName;
            }

            const response = await fetch('/api/user/password', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            });
            const data = await response.json();

            if (data.result === 'SUCCESS') {
                showAlert('정보가 성공적으로 변경되었습니다. 다시 로그인해주세요.', async () => {
                     if (logout) {
                         await logout(); // Context의 logout 호출
                     }
                     navigate('/Login');
                });
            } else {
                showAlert('정보 변경에 실패했습니다. 기존 비밀번호를 확인해주세요.');
            }
        } catch (error) {
            console.error('Error updating info:', error);
            showAlert('오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };


    // 1. 계정 관리
    const renderAccountManagement = () => (
        <div className={styles.managementWrapper}>
            <h2 className={styles.managementTitle}>개인 정보 변경</h2>
            <div className={styles.formWrapper}>

                <div className={styles.formGroup}>
                    <label className={styles.formLabel}>이메일</label>
                    <div className={styles.inputRow}>
                        <input 
                            type="text" 
                            defaultValue={user.email} 
                            disabled 
                            className={`${styles.input} ${styles.flex1}`} 
                        />
                        <button 
                            className={styles.formBtn} 
                            onClick={handleSendEmailCode}
                            disabled={isEmailVerified || isLoading}
                        >
                            {isEmailVerified ? '인증완료' : '인증번호 발송'}
                        </button>
                    </div>
                    
                    {isEmailSent && !isEmailVerified && (
                        <div className={styles.inputRow}>
                            <input 
                                type="text" 
                                placeholder="인증번호를 입력해주세요" 
                                className={`${styles.input} ${styles.flex1}`} 
                                value={emailCode}
                                onChange={(e) => setEmailCode(e.target.value)}
                            />
                            <button className={styles.formBtn} onClick={handleVerifyEmailCode} disabled={isLoading}>확인</button>
                        </div>
                    )}
                    
                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>이름</label>
                        <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="이름을 입력해주세요"
                            className={styles.input}
                            disabled={!isEmailVerified}
                        />
                    </div>
                </div>
                
                <div className={styles.formGroup}>
                    <label className={styles.formLabel}>기존 비밀번호</label>
                    <input 
                        type="password" 
                        placeholder="기존 비밀번호를 입력해주세요" 
                        className={styles.input} 
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        disabled={!isEmailVerified}
                    />
                </div>
                <div className={styles.formGroup}>
                    <label className={styles.formLabel}>새 비밀번호</label>
                    <input 
                        type="password" 
                        placeholder="새 비밀번호 (대·소문자·숫자·특수문자 포함 8자 이상)"
                        className={styles.input} 
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        disabled={!isEmailVerified}
                    />
                </div>
                <div className={styles.formGroup}>
                    <label className={styles.formLabel}>새 비밀번호 재확인</label>
                    <input 
                        type="password" 
                        placeholder="새 비밀번호를 동일하게 입력해주세요" 
                        className={styles.input} 
                        value={newPasswordConfirm}
                        onChange={(e) => setNewPasswordConfirm(e.target.value)}
                        disabled={!isEmailVerified}
                    />
                </div>
                
                <div style={{ textAlign: 'center', marginTop: '20px' }}>
                    <button 
                        className={styles.formBtn} 
                        style={{ width: '200px', height: '50px', fontSize: '16px' }}
                        onClick={handleUpdateInfo}
                        disabled={!isEmailVerified || isLoading}
                    >
                        정보 수정하기
                    </button>
                </div>
            </div>
        </div>
    );

    // 2. 계정 보안
    const renderSecurity = () => (
        <div className={styles.securityWrapper}>

            <div className={styles.securityCard} onClick={() => navigate('/PinSetup')} style={{ cursor: 'pointer' }}>
                <img src={lockImg} alt="Lock" className={styles.securityIconImg} />
                <span className={styles.securityTitle}>핀번호 생성</span>
            </div>
            <div className={styles.securityCard} onClick={() => navigate('/PinReset')} style={{ cursor: 'pointer' }}>
                {/*<img src={otpImg} alt="OTP" className={styles.securityIconImg} />*/}
                <img src={lockBlackImg} alt="OTP" className={styles.securityIconImg} />
                <span className={styles.securityTitle}>핀번호 재설정</span>
            </div>
        </div>
    );

    // 계좌 유형 한글로 변환
    const getAccountTypeName = (type) => {
        switch(type) {
            case 'CHECKING': return '입출금';
            case 'DEPOSIT': return '예금';
            case 'SAVINGS': return '적금';
            default: return '계좌';
        }
    };

    // 3. 계좌 관리
    const renderAccounts = () => {
        return (
            <div className={styles.accountsWrapper}>
                <h2 className={styles.sectionTitle}>계좌 조회</h2>
                
                <div className={styles.accountList}>
                    {accounts.length === 0 ? (
                        <div className={styles.noAccounts}>
                            보유하신 계좌가 없습니다.
                        </div>
                    ) : (
                        accounts.map((account) => (
                            <div key={account.id || account.accountId} className={styles.accountCard}>
                                <div className={styles.accountInfo}>
                                    <div className={styles.accountNameRow}>
                                        {/* accountAlias가 있으면 그걸 띄우고, 없으면 accountType을 한글로 변환해서 띄움 */}
                                        <span className={styles.accountName}>
                                            {account.accountAlias || `기본 ${getAccountTypeName(account.accountType)}`}
                                        </span>
                                    </div>
                                    <span className={styles.accountNumber}>{account.accountNumber}</span>
                                </div>
                                
                                <div className={styles.accountActions}>
                                    <span className={styles.balance}>{account.balance?.toLocaleString()} 원</span>
                                    {account.accountType === 'CHECKING' && account.status == 'ACTIVE' && (
                                        <button 
                                            className={styles.transferBtn}
                                            onClick={() => navigate('/Transfer', { state: { account } })}
                                        >
                                            이체
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className={styles.container}>
            {isLoading && <Loading />}
            <div className={styles.layoutWrapper}>
                
                <div className={styles.sidebar}>
                    <div className={styles.profileArea}>
                        <img src={profileImg} alt="Profile" className={styles.profileImage} />
                        <div className={styles.textCenter}>
                            <p className={styles.profileName}>
                                환영합니다. <strong>{user.name}</strong>님
                            </p>
                            <p className={styles.profileEmail}>{user.email}</p>
                        </div>
                    </div>

                    <div className={styles.menuArea}>
                        <div 
                            className={`${styles.menuItem} ${activeTab === 'account' ? styles.active : ''}`}
                            onClick={() => setActiveTab('account')}
                        >
                            <span>계정 관리</span>
                            <img src={arrowImg} alt="Select" className={styles.chevronImg} />
                        </div>
                        <div 
                            className={`${styles.menuItem} ${activeTab === 'security' ? styles.active : ''}`}
                            onClick={() => setActiveTab('security')}
                        >
                            <span>계정 보안</span>
                            <img src={arrowImg} alt="Select" className={styles.chevronImg} />
                        </div>
                        <div 
                            className={`${styles.menuItem} ${activeTab === 'accounts' ? styles.active : ''}`}
                            onClick={() => setActiveTab('accounts')}
                        >
                            <span>계좌 관리</span>
                            <img src={arrowImg} alt="Select" className={styles.chevronImg} />
                        </div>
                        <div 
                            className={`${styles.menuItem} ${activeTab === 'cards' ? styles.active : ''}`}
                            onClick={() => setActiveTab('cards')}
                        >
                            <span>내 카드 관리</span>
                            <img src={arrowImg} alt="Select" className={styles.chevronImg} />
                        </div>
                    </div>
                </div>

                <div className={styles.contentArea}>
                    {activeTab === 'account' && renderAccountManagement()}
                    {activeTab === 'security' && renderSecurity()}
                    {activeTab === 'accounts' && renderAccounts()}
                    {activeTab === 'cards' && <CardManage />}
                </div>

            </div>
        </div>
    );
};

export default MyPage;
