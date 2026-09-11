import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PrivateRoute = ({ children, allowedRoles }) => {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return <div>Loading...</div>;
    }

    // 미인증: 모달 확인에 의존하지 않고 즉시 로그인 페이지로 리다이렉트한다.
    // (모달을 배경 클릭/ESC로 닫아도 이동이 보장되어 흰 화면이 남지 않음)
    if (!user) {
        const path = location.pathname.toLowerCase();
        const target = path.startsWith('/adminmain') || path.startsWith('/bankerworkspace')
            ? '/adminlogin'
            : '/login';
        return <Navigate to={target} replace state={{ from: location }} />;
    }

    // 권한 불일치: 역할별 기본 페이지로 리다이렉트한다.
    const userRole = user.type === 'member' ? 'member' : user.userType;
    if (allowedRoles && !allowedRoles.includes(userRole)) {
        const fallback = userRole === 'admin'
            ? '/adminmain'
            : (userRole === 'member' ? '/bankerworkspace' : '/');
        return <Navigate to={fallback} replace />;
    }

    return children;
};

export default PrivateRoute;
