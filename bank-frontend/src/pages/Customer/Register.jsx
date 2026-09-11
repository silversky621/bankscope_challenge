import React, { useState, useEffect } from 'react';
import styles from './Register.module.css';
import { Link, useNavigate } from 'react-router-dom';
import LoginBackgroundImage from '../../images/Login/background.png';
import LeftContentImage from '../../images/Login/frame.png';
import { useModal } from '../../context/ModalContext';
import Loading from '../../components/common/Loading';


// alert showModal로 바꾸고
// 인증번호 발송시 로딩함수걸어주기


const Register = () => {
    const { openModal } = useModal();
    const showAlert = (message, callback = null) => {
        openModal({
            message: message,
            onConfirm: callback
        });
    };

    const [step, setStep] = useState(1);
    const [isAgreed, setIsAgreed] = useState(false);
    const [formData, setFormData] = useState({
        userType: 'customer',
        name: '',
        email: '',
        password: '',
        phone: '',
        residentNumber: '',
        identificationNumber: '',
        isTermsAgreed: 0 // 백엔드 DTO에 맞게 기본값 추가
    });
    const [passwordConfirm, setPasswordConfirm] = useState('');
    const navigate = useNavigate();

    const [emailVerificationCode, setEmailVerificationCode] = useState('');
    const [isEmailSent, setIsEmailSent] = useState(false);
    const [isEmailVerified, setIsEmailVerified] = useState(false);
    const [timer, setTimer] = useState(0);
    const [isLoading, setIsLoading] = useState(false); // 로딩 상태 추가

    useEffect(() => {
        let interval = null;
        if (timer > 0) {
            interval = setInterval(() => {
                setTimer((prevTimer) => prevTimer - 1);
            }, 1000);
        } else if (timer === 0 && isEmailSent && !isEmailVerified) {
            showAlert('인증 시간이 만료되었습니다. 이메일을 다시 입력하고 인증을 진행해주세요.');
            setIsEmailSent(false);
            setEmailVerificationCode('');
            setFormData(prev => ({ ...prev, email: '' }));
        }
        return () => {
            if (interval) {
                clearInterval(interval);
            }
        };
    }, [timer, isEmailSent, isEmailVerified, showAlert]);

    // 체크박스 핸들러 추가
    const handleAgreementChange = (e) => {
        const checked = e.target.checked;
        setIsAgreed(checked);
        setFormData(prev => ({
            ...prev,
            isTermsAgreed: checked ? 1 : 0 // 체크 시 1, 해제 시 0
        }));
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const handlePartChange = (e, field, part, maxLength) => {
        const { value } = e.target;

        setFormData(prev => {
            // 해당 필드(phone, residentNumber, identificationNumber)의 현재 값을 가져옴
            // 만약 값이 없다면 빈 문자열로 처리
            const currentFieldValue = prev[field] || '';
            const parts = currentFieldValue.split('-');

            // 배열 길이를 파트 수에 맞게 조절
            while (parts.length <= part) {
                parts.push('');
            }

            parts[part] = value;
            const newValue = parts.join('-');

            return {
                ...prev,
                [field]: newValue
            };
        });

        if (value.length === maxLength && e.target.nextElementSibling?.nextElementSibling) {
            e.target.nextElementSibling.nextElementSibling.focus();
        }
    };
    const handleSendEmailCode = async () => {
        if (!formData.email) {
            showAlert('이메일을 입력해주세요.');
            return;
        }
        
        setIsLoading(true); // 로딩 시작
        
        try {
            const response = await fetch(`/api/user/email-send?email=${formData.email}&type=register`, { method: 'POST' });
            const data = await response.json();

            if (data.result === 'SUCCESS') {
                showAlert('인증코드가 발송되었습니다.');
                setIsEmailSent(true);
                setTimer(180); // 3 minutes
            } else if (data.result === 'FAILURE_DUPLICATE_EMAIL') {
                showAlert('이미 가입된 이메일입니다.');
            } else {
                showAlert('인증코드 발송에 실패했습니다.');
            }
        } catch (error)
         {
            console.error('Error sending email code:', error);
            showAlert('오류가 발생했습니다.');
        } finally {
            setIsLoading(false); // 로딩 종료
        }
    };

    const handleVerifyEmailCode = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/user/email-code-verify', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: formData.email, code: emailVerificationCode }),
            });
            const data = await response.json();

            if (data.result === 'SUCCESS') {
                showAlert('이메일 인증에 성공했습니다.');
                setIsEmailVerified(true);
                setTimer(0);
            } else if (data.result === 'FAILURE_EXPIRED') {
                showAlert('인증코드가 만료되었습니다. 다시 시도해주세요.');
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // 프론트엔드 레벨 검증 (한 번 더 확인)
        if (formData.isTermsAgreed !== 1) {
            showAlert('개인정보 수집 및 이용에 동의해야 회원가입이 가능합니다.');
            return;
        }
        
        if (!isStep2Valid()) {
            showAlert('모든 필드를 채워야 합니다.');
            return;
        }

        const finalData = {
            ...formData,
            phone: formData.phone.replace(/-/g, ''),
            residentNumber: formData.residentNumber.replace(/-/g, ''),
            identificationNumber: formData.userType === 'corporate' ? formData.identificationNumber.replace(/-/g, '') : undefined,
        };
        delete finalData.passwordConfirm;

        setIsLoading(true); // 회원가입 진행 중에도 로딩 표시
        try {
            const response = await fetch('/api/user/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(finalData),
            });

            if (response.ok) {
                const data = await response.json();
                
                // 백엔드 응답 switch-case 처리
                switch(data.result) {
                    case 'SUCCESS':
                        showAlert('회원가입 성공!', () => navigate('/Login'));
                        break;
                    case 'FAILURE_NOT_AGREED':
                        showAlert('약관에 동의하지 않았습니다. 동의 후 다시 시도해주세요.');
                        setIsAgreed(false);
                        setFormData(prev => ({ ...prev, isTermsAgreed: 0 }));
                        break;
                    case 'FAILURE':
                    default:
                        showAlert('회원가입 실패: ' + (data.message || '정보를 다시 확인해주세요.'));
                        break;
                }
            } else {
                showAlert('회원가입 실패');
            }
        } catch (error) {
            console.error('Error:', error);
            showAlert('오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    const isStep1Valid = () => formData.name && formData.email && formData.password && passwordConfirm && isEmailVerified;

    const nextStep = () => {
        if (!isStep1Valid()) {
            showAlert('모든 필드를 채우고 이메일 인증을 완료해야 합니다.');
            return;
        }
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,50}$/;
        if (!passwordRegex.test(formData.password)) {
            showAlert('비밀번호는 영문 대·소문자, 숫자, 특수문자를 모두 포함하여 8자 이상이어야 합니다.');
            return;
        }
        if (formData.password !== passwordConfirm) {
            showAlert('비밀번호가 일치하지 않습니다.');
            return;
        }
        setStep(step + 1);
    };
    const prevStep = () => setStep(step - 1);

    const isStep2Valid = () => {
        const phoneComplete = formData.phone.replace(/-/g, '').length >= 10;
        const residentNumberComplete = formData.residentNumber.replace(/-/g, '').length === 13;
        if (formData.userType === 'corporate') {
            const businessNumberComplete = formData.identificationNumber.replace(/-/g, '').length === 10;
            return phoneComplete && residentNumberComplete && businessNumberComplete;
        }
        return phoneComplete && residentNumberComplete;
    };

    const formatTime = (seconds) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
    };

    const renderStep1 = () => (
        <>
            <div className={`${styles.inputGroup} ${styles.typeSelectionGroup}`}>
                <label className={styles.groupLabel}>회원 유형</label>
                <div className={styles.segmentedControl}>
                    <div className={styles.segmentOption}>
                        <input type="radio" id="userTypeCustomer" name="userType" value="customer" checked={formData.userType === 'customer'} onChange={handleChange} />
                        <label htmlFor="userTypeCustomer">일반회원</label>
                    </div>
                    <div className={styles.segmentOption}>
                        <input type="radio" id="userTypeCorporate" name="userType" value="corporate" checked={formData.userType === 'corporate'} onChange={handleChange} />
                        <label htmlFor="userTypeCorporate">기업회원</label>
                    </div>
                </div>
            </div>
            <div className={styles.inputGroup}>
                <label htmlFor="name">이름</label>
                <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} placeholder="이름을 입력해주세요" required />
            </div>
            <div className={styles.inputGroup}>
                <label htmlFor="email">이메일</label>
                <div className={styles.emailContainer}>
                    <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} placeholder="이메일을 입력해주세요" required disabled={isEmailSent} />
                    <button type="button" onClick={handleSendEmailCode} className={styles.emailButton} disabled={isEmailVerified}>
                        {isEmailVerified ? '인증완료' : '인증번호 발송'}
                    </button>
                </div>
            </div>
            {isEmailSent && !isEmailVerified && (
                <div className={styles.inputGroup}>
                    <label htmlFor="emailVerificationCode">인증코드</label>
                    <div className={styles.emailContainer}>
                        <input type="text" id="emailVerificationCode" value={emailVerificationCode} onChange={(e) => setEmailVerificationCode(e.target.value)} placeholder="인증코드를 입력해주세요" />
                        {timer > 0 && <span className={styles.timer}>{formatTime(timer)}</span>}
                        <button type="button" onClick={handleVerifyEmailCode} className={styles.emailButton}>인증하기</button>
                    </div>
                </div>
            )}
            <div className={styles.inputGroup}>
                <label htmlFor="password">비밀번호</label>
                <input type="password" id="password" name="password" value={formData.password} onChange={handleChange} placeholder="비밀번호를 입력해주세요" required />
            </div>
            <div className={styles.inputGroup}>
                <label htmlFor="passwordConfirm">비밀번호 확인</label>
                <input type="password" id="passwordConfirm" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} placeholder="비밀번호를 다시 입력해주세요" required />
            </div>
            <button type="button" onClick={nextStep} className={styles.nextButton}>다음</button>
        </>
    );

    const renderStep2 = () => (
        <>
            <div className={styles.inputGroup}>
                <label>전화번호</label>
                <div className={styles.splitInput}>
                    <input placeholder={"3자리"} type="text" onChange={(e) => handlePartChange(e, 'phone', 0, 3)} maxLength="3" />
                    <span>-</span>
                    <input placeholder={"4자리"} type="text" onChange={(e) => handlePartChange(e, 'phone', 1, 4)} maxLength="4" />
                    <span>-</span>
                    <input placeholder={"4자리"} type="text" onChange={(e) => handlePartChange(e, 'phone', 2, 4)} maxLength="4" />
                </div>
            </div>
            <div className={styles.inputGroup}>
                <label>주민등록번호</label>
                <div className={styles.splitInput}>
                    <input placeholder={"6자리"} type="text" onChange={(e) => handlePartChange(e, 'residentNumber', 0, 6)} maxLength="6" />
                    <span>-</span>
                    <input placeholder={"7자리"} type="password" onChange={(e) => handlePartChange(e, 'residentNumber', 1, 7)} maxLength="7" />
                </div>
            </div>
            {formData.userType === 'corporate' && (
                <div className={styles.inputGroup}>
                    <label>사업자 등록 번호</label>
                    <input type="text" style={{ display: 'none' }} readOnly />
                    <div className={styles.splitInput}>
                        <input type="text" placeholder={"3자리"} autoComplete="off" onChange={(e) => handlePartChange(e, 'identificationNumber', 0, 3)} maxLength="3" />
                        <span>-</span>
                        <input type="text" placeholder={"2자리"} autoComplete="off" onChange={(e) => handlePartChange(e, 'identificationNumber', 1, 2)} maxLength="2" />
                        <span>-</span>
                        <input type="text" placeholder={"5자리"} autoComplete="off" onChange={(e) => handlePartChange(e, 'identificationNumber', 2, 5)} maxLength="5" />
                    </div>
                </div>
            )}
            <div className={styles.stepButtons}>
                <button type="button" onClick={prevStep}  className={styles.previousButton}>이전</button>
                <button type="button" onClick={() => {
                    if (!isStep2Valid()) {
                        showAlert('모든 필드를 정확히 입력해주세요.');
                        return;
                    }
                    setStep(3); // 3단계
                }} className={styles.submitButton}>다음</button>
            </div>
        </>
    );

    const renderStep3 = () => (
        <>
            <div className={styles.inputSign}>
                <label>[필수] 개인정보 및 고유식별정보 수집·이용 동의서</label>
                
                <div style={{ 
                    height: '250px', overflowY: 'scroll', padding: '15px', 
                    border: '1px solid #ddd', borderRadius: '8px', 
                    fontSize: '13px', lineHeight: '1.6', marginBottom: '15px', backgroundColor: '#f9f9f9',
                    color: '#333'
                }}>
                    <strong>1. 수집 및 이용 목적</strong><br />
                    금융거래와 관련하여 본인의 개인정보를 수집·이용하는 목적은 다음과 같습니다.<br />
                    - 금융거래 관계의 설정·유지·이행·관리: 계좌 개설, 금융상품(예·적금, 대출 등) 가입, 금융거래 승인 및 처리<br />
                    - 법령상 의무 이행: 「금융실명거래 및 비밀보장에 관한 법률」에 따른 실명 확인 및 본인 인증, 「특정 금융거래정보의 보고 및 이용 등에 관한 법률」에 따른 자금세탁방지(AML) 의무 이행<br />
                    - 신용질서 유지 및 보호: 금융사고 예방 및 조사, 분쟁 해결, 고객 민원 처리 및 상담<br />
                    - 신용정보의 조회: 신용조회회사 또는 신용정보집중기관에 대한 신용정보 조회 (대출 등 여신거래 시)<br /><br />
                    
                    <strong>2. 수집하는 개인정보 항목</strong><br />
                    은행은 서비스 제공을 위해 아래의 필수적인 개인정보 및 고유식별정보를 수집합니다.<br />
                    - [필수] 일반 개인정보: 성명, 연락처(휴대폰 번호, 자택/직장 전화번호), 이메일<br />
                    - [필수] 고유식별정보: 주민등록번호, 사업자등록번호<br />
                    (※ 고유식별정보는 금융실명법 제3조 등 관련 법령에 명확한 근거가 있는 경우에 한하여 수집 및 처리됩니다.)<br />
                    - [필수] 금융거래 정보: 상품 종류, 거래 조건(이자율, 만기 등), 거래 일시 및 금액 등 거래 설정 및 내역 정보<br /><br />
                    
                    <strong>3. 보유 및 이용 기간</strong><br />
                    수집된 개인정보는 원칙적으로 금융거래 종료일로부터 법령에서 정한 기간 동안 안전하게 보관 및 이용되며, 목적이 달성된 후에는 지체 없이 파기됩니다.<br />
                    - 원칙: 금융거래 종료일(계좌 해지, 회원 탈퇴 등)로부터 5년까지 보관 (「신용정보의 이용 및 보호에 관한 법률」 등)<br />
                    - 예외 (관련 법령에 의한 별도 보존):<br />
                    &nbsp;&nbsp;&nbsp;&nbsp;· 「전자금융거래법」에 따른 전자금융 거래기록: 5년<br />
                    &nbsp;&nbsp;&nbsp;&nbsp;· 「상법」에 따른 상업장부 및 영업 관련 중요 서류: 10년<br />
                    &nbsp;&nbsp;&nbsp;&nbsp;· 「특정 금융거래정보의 보고 및 이용 등에 관한 법률」에 따른 고객 확인 정보 및 거래기록: 5년<br />
                    (※ 단, 금융사고 조사, 분쟁 해결, 민원 처리, 법령상 의무 이행을 위해 필요한 경우 해당 목적이 달성될 때까지 보관될 수 있습니다.)<br /><br />

                    <strong>4. 동의를 거부할 권리 및 불이익</strong><br />
                    고객님은 위 개인정보 및 고유식별정보의 수집·이용에 대한 동의를 거부할 권리가 있습니다. 단, 위 정보는 금융거래 설정 및 서비스 제공을 위한 필수적 요건이므로, 동의를 거부하실 경우 계좌 개설, 대출, 스마트뱅킹 등 은행의 금융 서비스 이용이 불가능합니다.
                </div>
                <div className={styles.checkboxGroup}>
                    <input
                        type="checkbox"
                        id="agreeCheckbox"
                        checked={isAgreed}
                        onChange={handleAgreementChange}
                    />
                    <label htmlFor="agreeCheckbox" style={{cursor: 'pointer' , margin: 0, padding: 0}}>위 개인정보 수집 및 이용에 동의합니다.</label>
                </div>
            </div>

            <div className={styles.stepButtons}>
                <button type="button" onClick={() => setStep(2)} className={styles.previousButton}>이전</button>
                <button type="submit" className={styles.submitButton} disabled={formData.isTermsAgreed !== 1}>회원가입 완료</button>
            </div>
        </>
    );

    return (
        <div className={styles.pageContainer}>
            {isLoading && <Loading />} {/* 로딩 컴포넌트 추가 */}
            <div className={styles.backgroundWrapper}>
                <img src={LoginBackgroundImage} alt="Background" />
            </div>
            <div className={styles.registerCard}>
                <div className={styles.leftPane}>
                    <div className={styles.header}>
                        <h1>BankScope</h1>
                    </div>
                    <form onSubmit={handleSubmit} className={styles.form}>
                        {step === 1 && renderStep1()}
                        {step === 2 && renderStep2()}
                        {step === 3 && renderStep3()}
                    </form>
                    <div className={styles.loginLink}>
                        <span>이미 회원이신가요? </span>
                        <Link to="/login">로그인하기</Link>
                    </div>
                </div>
                <div className={styles.rightPane}>
                    <img src={LeftContentImage} alt="Visual" />
                </div>
            </div>
        </div>
    );
};

export default Register;
