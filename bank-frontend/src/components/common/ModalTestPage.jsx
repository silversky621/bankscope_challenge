import React, { useState } from 'react';
import CustomModal from './CustomModal.jsx';

const ModalTestPage = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const openModal = () => setIsModalOpen(true);
    const closeModal = () => setIsModalOpen(false);

    const handleConfirm = () => {
        closeModal();
    };

    const handleCancel = () => {
        closeModal();
    };

    return (
        <div style={{ padding: '50px', textAlign: 'center' }}>
            <h2>공통 모달 테스트 페이지</h2>
            
            <button 
                onClick={openModal} 
                style={{ 
                    padding: '15px 30px', 
                    fontSize: '18px', 
                    backgroundColor: '#009A83', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '8px',
                    cursor: 'pointer'
                }}
            >
                모달 열기
            </button>

            {/* 모달 컴포넌트 사용 */}
            <CustomModal
                isOpen={isModalOpen}
                onClose={closeModal}
                title="알림"
                onConfirm={handleConfirm}
                onCancel={handleCancel}
                confirmText="네, 확인했습니다"
                cancelText="아니요"
            >
                <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>공통 모달 컴포넌트입니다.</p>
                    <p style={{ color: '#666' }}>원하는 내용을 자유롭게 넣을 수 있습니다.</p>
                    <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '5px' }}>
                        <strong>HTML 요소도 포함 가능합니다!</strong>
                    </div>
                </div>
            </CustomModal>
        </div>
    );
};

export default ModalTestPage;
