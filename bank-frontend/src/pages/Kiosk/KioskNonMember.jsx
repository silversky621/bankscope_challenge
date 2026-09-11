import React, { useState, useRef } from 'react';
import styles from './Kiosk.module.css';
import CustomModal from '../../components/common/CustomModal';

const KioskNonMember = ({ setFormData, onNext, onPrev }) => {
    const [localData, setLocalData] = useState({
        name: '',
        ssnFront: '',
        ssnBack: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMessage, setModalMessage] = useState('');

    const [isConsentModalOpen, setIsConsentModalOpen] = useState(false);
    const [isAgreed, setIsAgreed] = useState(false);

    const ssnFrontRef = useRef(null);
    const ssnBackRef = useRef(null);

    const handleChange = (e) => {
        const { name, value } = e.target;
        
        // 숫자만 입력되도록 처리
        if ((name === 'ssnFront' || name === 'ssnBack') && !/^\d*$/.test(value)) {
            return;
        }

        setLocalData({
            ...localData,
            [name]: value
        });

        // 앞자리 6자리 입력 완료 시 뒷자리로 포커스 이동
        if (name === 'ssnFront' && value.length === 6) {
            ssnBackRef.current?.focus();
        }
    };

    // 확인 버튼 핸들러
    const handleFirstConfirm = () => {
        const fullSsn = localData.ssnFront + localData.ssnBack;

        if (!localData.name || fullSsn.length !== 13) {
            setModalMessage('이름과 주민등록번호 13자리를 모두 입력해주세요.');
            setIsModalOpen(true);
            return;
        }

        setIsConsentModalOpen(true);
    };

    const handleSubmitToServer = async () => {
        if (!isAgreed) {
            setModalMessage('개인정보 수집 및 이용에 동의하셔야 진행이 가능합니다.');
            setIsModalOpen(true);
            return;
        }

        setIsConsentModalOpen(false);
        const fullSsn = localData.ssnFront + localData.ssnBack;

        try {
            setIsSubmitting(true);

            // 1. 비회원 회원가입 (semi-register)
            const registerResponse = await fetch('/api/user/semi-register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: localData.name,
                    residentNumber: fullSsn,
                    isTermsAgreed: 1,
                }),
            });

            if (registerResponse.ok) {
                const registerData = await registerResponse.json();
                
                // 성공이거나, 이미 가입된 회원이면 로그인을 시도함
                if (registerData.result === 'SUCCESS' || registerData.result === 'FAILURE_EXISTING_RESIDENT_NUMBER' || registerData.result === 'FAILURE') {
                    // 2. 키오스크 로그인 API 호출하여 세션 생성
                    const loginResponse = await fetch('/api/user/kiosk/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ residentNumber: fullSsn })
                    });

                    if (loginResponse.ok) {
                        const loginData = await loginResponse.json();
                        switch (loginData.result) {
                            case 'SUCCESS': {
                                // 키오스크는 세션리스로 동작하므로 로그인 응답의 userId를 직접 사용한다.
                                setFormData(prev => ({
                                    ...prev,
                                    ssn: fullSsn,
                                    userName: localData.name,
                                    userId: loginData.userId ?? null,
                                }));

                                // 성공 모달 띄우기
                                if (registerData.result === 'SUCCESS') {
                                    setModalMessage('비회원등록이 완료되었습니다.\n접수 화면으로 넘어갑니다.');
                                } else {
                                    setModalMessage('이미 가입된 고객정보가 있습니다.\n접수 화면으로 넘어갑니다.');
                                }
                                setIsModalOpen(true);
                                break;
                            }
                            case 'FAILURE_NOT_ALLOWED':
                                setModalMessage('로그인 처리에 실패했습니다.\n창구에 문의해주세요.');
                                setIsModalOpen(true);
                                break;
                            case 'FAILURE':
                            default:
                                setModalMessage('일치하는 고객 정보가 없습니다.\n다시 확인해주세요.');
                                setIsModalOpen(true);
                                break;
                        }
                    } else {
                        setModalMessage('로그인 서버 통신 오류가 발생했습니다.');
                        setIsModalOpen(true);
                    }
                } else {
                    setModalMessage('가입 처리에 실패했습니다.');
                    setIsModalOpen(true);
                }
            } else {
                setModalMessage('서버 오류가 발생했습니다.');
                setIsModalOpen(true);
            }
        } catch (error) {
            console.error('비회원 가입/로그인 에러:', error);
            setModalMessage('서버와 통신 중 오류가 발생했습니다.');
            setIsModalOpen(true);
        } finally {
            setIsSubmitting(false);
        }
    };

    // 모달 확인 버튼 핸들러
    const handleModalConfirm = () => {
        setIsModalOpen(false);
        // 에러 메시지인 경우에는 다음으로 넘어가지 않음
        if (modalMessage.includes('넘어갑니다')) {
            onNext();
        }
    };

    return (
        <div className={styles.loginArea}>
            <div className={styles.progressIndicator}>
                <div className={`${styles.step} ${styles.active}`}></div>
                <div className={styles.step}></div>
                <div className={styles.step}></div>
                <div className={styles.step}></div>
                <div className={styles.step}></div>
            </div>

            <div className={styles.loginHeader}>
                <h2 className={styles.loginTitle}>비회원 접수</h2>
                <p className={styles.loginSubtitle}>이름과 주민등록번호를 입력해주세요</p>
            </div>

            <div className={styles.formContainer}>
                <div className={styles.inputGroup} style={{ marginBottom: '20px' }}>
                    <label htmlFor="name" style={{marginTop: '2.5rem'}}>이름</label>
                    <input
                        type="text"
                        id="name"
                        name="name"
                        value={localData.name}
                        onChange={handleChange}
                        placeholder="이름을 입력 해주세요"
                        className={styles.inputField}
                    />
                </div>

                <div className={styles.inputGroup}>
                    <label>주민등록번호</label>
                    <div className={styles.ssnWrapper} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input
                            type="text"
                            name="ssnFront"
                            value={localData.ssnFront}
                            onChange={handleChange}
                            placeholder="앞 6자리"
                            maxLength="6"
                            className={styles.inputField}
                            style={{ flex: 1, textAlign: 'center', letterSpacing: '2px' }}
                            ref={ssnFrontRef}
                        />
                        <span className={styles.separator} style={{ fontWeight: 'bold', color: '#666' }}>-</span>
                        <input
                            type="password"
                            name="ssnBack"
                            value={localData.ssnBack}
                            onChange={handleChange}
                            placeholder="뒷 7자리"
                            maxLength="7"
                            className={styles.inputField}
                            style={{ flex: 1, textAlign: 'center', letterSpacing: '4px' }}
                            ref={ssnBackRef}
                        />
                    </div>
                </div>
                <button
                    className={styles.confirmButton}
                    onClick={handleFirstConfirm}
                    disabled={isSubmitting}
                    style={{ marginTop: '40px' }}
                >
                    확인
                </button>

            </div>

            <button className={styles.prevButton} onClick={onPrev} disabled={isSubmitting}>
                ← 이전으로
            </button>

            <CustomModal 
                isOpen={isConsentModalOpen} 
                onClose={() => setIsConsentModalOpen(false)} 
                title="[필수] 개인정보 및 고유식별정보 수집·이용 동의서"
                onConfirm={handleSubmitToServer}
                confirmText="동의하고 진행"
            >
                <div style={{ padding: '10px 20px', textAlign: 'left', color: '#333' }}>
                    <div style={{ 
                        height: '250px', overflowY: 'auto', padding: '15px', 
                        border: '1px solid #ddd', borderRadius: '8px', 
                        fontSize: '13px', lineHeight: '1.6', marginBottom: '15px', backgroundColor: '#f9f9f9', color: '#222' 
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

{/*                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}>
                        <input
                            type="checkbox"
                            checked={isAgreed}
                            onChange={(e) => setIsAgreed(e.target.checked)}
                            style={{ width: '22px', height: '22px', cursor: 'pointer' }}
                        />
                        위 개인정보 수집 및 이용에 동의합니다.
                    </label>*/}
                    <div style={{ display: 'flex', alignItems: 'center', marginTop: '5px', marginBottom: '10px' }}>
                        <input
                            type="checkbox"
                            id="generalAgreeCheckbox"
                            checked={isAgreed}
                            onChange={(e) => setIsAgreed(e.target.checked)}
                            style={{
                                width: '18px',
                                height: '18px',
                                marginRight: '10px',
                                accentColor: '#009A83', /* 체크박스 초록색 적용 */
                                cursor: 'pointer'
                            }}
                        />
                        <label
                            htmlFor="generalAgreeCheckbox"
                            style={{ color: '#333', fontSize: '1rem', cursor: 'pointer', margin: 0, fontWeight: 'bold' }}
                        >
                            [필수] 일반 개인정보 수집 및 이용에 동의합니다.
                        </label>
                    </div>
                </div>
            </CustomModal>

            {/* CustomModal 추가 */}
            <CustomModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                title="안내"
                onConfirm={handleModalConfirm}
                confirmText="확인"
            >
                <div style={{ padding: '20px', textAlign: 'center', fontSize: '1.2rem', color: '#333', whiteSpace: 'pre-line', lineHeight: '1.5' }}>
                    {modalMessage}
                </div>
            </CustomModal>
        </div>
    );
};

export default KioskNonMember;
