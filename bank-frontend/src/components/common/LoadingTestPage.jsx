import React, { useState } from 'react';
import Loading from './Loading.jsx';

const LoadingTestPage = () => {
    const [isLoading, setIsLoading] = useState(false);

    const handleLoading = () => {
        setIsLoading(true);
        // 3초 뒤에 로딩 종료
        setTimeout(() => {
            setIsLoading(false);
        }, 3000);
    };

    return (
        <div style={{ padding: '50px', textAlign: 'center' }}>
            <h2>로딩 컴포넌트 테스트 페이지</h2>
            <p>아래 버튼을 누르면 3초간 로딩 화면이 표시됩니다.</p>
            
            <button 
                onClick={handleLoading} 
                style={{ 
                    padding: '15px 30px', 
                    fontSize: '18px', 
                    backgroundColor: '#009A83', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '8px',
                    cursor: 'pointer',
                    marginTop: '20px'
                }}
            >
                로딩 시작
            </button>

            {isLoading && <Loading message="데이터를 불러오는 중입니다..." />}
        </div>
    );
};

export default LoadingTestPage;
