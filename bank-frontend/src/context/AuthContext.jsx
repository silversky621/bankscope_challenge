/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useState, useContext, useEffect } from 'react';
import { useModal } from './ModalContext.jsx';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const { openModal } = useModal();
    const [loading, setLoading] = useState(true);

    const showAlert = (message, callback = null) => {
        openModal({
            message: message,
            onConfirm: callback
        });
    };

    useEffect(() => {
        checkSession();
    }, []);

    const checkSession = async () => {
        try {
            const response = await fetch('/api/user/session');
            if (response.ok) {
                const data = await response.json();
                if (data.result === "SUCCESS") {
                    if (data.type === 'member') {
                        setUser({ 
                            type: 'member',
                            email: data.email, 
                            name: data.name, 
                            level: data.level,
                            auth: data.auth,
                            team: data.team,
                            status: data.status
                        });
                    } else if (data.type === 'user') {
                        setUser({
                            type: 'user',
                            id: data.id,
                            userType: data.userType,
                            email: data.email,
                            name: data.name,
                            residentNumber: data.residentNumber,
                            phone: data.phone,
                            age : data.age,
                            grade : data.grade
                        });
                    }
                } else {
                    setUser(null);
                }
            } else {
                setUser(null);
            }
        } catch (error) {
            console.error("Session check failed", error);
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    const login = async () => {
        // 로그인 성공 후 세션 정보를 다시 가져와서 상태 업데이트
        await checkSession();
    };

    const logout = async () => {
        try {
            await fetch('/api/user/logout', { method: 'POST' });
            
            // 로그아웃 시 로컬스토리지에 저장된 유저의 bankerStatus 캐시 제거
            if (user && user.email) {
                localStorage.removeItem(`bankerStatus_${user.email}`);
            }

            showAlert('로그아웃 되었습니다.', () => {
                setUser(null);
            });
        } catch (error) {
            console.error("Logout failed", error);
            showAlert('로그아웃에 실패했습니다.');
        }
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
