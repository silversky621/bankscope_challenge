/* eslint-disable react-hooks/set-state-in-effect */
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import styles from './LoginContent.module.css';
import { useAuth } from '../../context/AuthContext';
import LoginBackgroundImage from "../../images/Login/background.png";
import LeftContentImage from "../../images/Login/frame.png";
import { useModal } from '../../context/ModalContext';

const LoginContent = () => {
    const { openModal } = useModal();
    const showAlert = (message, callback = null) => {
        openModal({
            message: message,
            onConfirm: callback
        });
    }
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    const [rememberEmail, setRememberEmail] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const { login } = useAuth();

    const from = location.state?.from?.pathname || "/";

    useEffect(() => {
        const savedEmail = localStorage.getItem('savedEmail');
        if (savedEmail) {
            setFormData(prev => ({ ...prev, email: savedEmail }));
            setRememberEmail(true);
        }
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value
        });
    };

    const handleCheckboxChange = (e) => {
        setRememberEmail(e.target.checked);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch('/api/user/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: formData.email,
                    password: formData.password
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.result === 'SUCCESS') {
                    await login();

                    if (rememberEmail) {
                        localStorage.setItem('savedEmail', formData.email);
                    } else {
                        localStorage.removeItem('savedEmail');
                    }
                    navigate(from, { replace: true }); // 로그인 성공 시 즉시 이동 (모달 확인에 의존하지 않음)
                } else {

                    showAlert('로그인 실패 : 정보를 확인하세요')
                }
            } else {
                showAlert('서버 오류가 발생했습니다.')
            }
        } catch (error) {
            console.error('Error:', error);
            showAlert('오류가 발생했습니다.')
        }
    };

    return (
        <div className={styles.pageContainer}>

            <div className={styles.backgroundWrapper}>
                <img src={LoginBackgroundImage} alt="Background" />
            </div>

            <div className={styles.loginCard}>

                <div className={styles.leftPane}>
                    <img src={LeftContentImage} alt="Visual" />
                </div>


                <div className={styles.rightPane}>
                    <div className={styles.header}>
                        <h1>BankScope</h1>
                    </div>

                    <form onSubmit={handleSubmit} className={styles.form}>
                        <div className={styles.inputGroup}>
                            <label htmlFor="email">이메일</label>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                required
                                placeholder="이메일을 입력해주세요"
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label htmlFor="password">비밀번호</label>
                            <input
                                type="password"
                                id="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                placeholder="비밀번호를 입력해주세요"
                                required
                            />
                        </div>

                        <div className={styles.checkboxGroup}>
                            <input
                                type="checkbox"
                                id="rememberEmail"
                                checked={rememberEmail}
                                onChange={handleCheckboxChange}
                            />
                            <label htmlFor="rememberEmail">이메일 기억하기</label>
                        </div>

                        <button type="submit" className={styles.submitButton}>로그인</button>
                    </form>

                    <div className={styles.footerLinks}>
                        <div className={styles.linkItem}>
                            <span>아직 회원이 아니신가요?</span>
                            <Link to="/Register">회원가입 하기</Link>
                        </div>
                        <div className={styles.linkItem}>
                            <span>임직원이신가요?</span>
                            <Link to="/AdminLogin">임직원 로그인</Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginContent;
