/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState } from 'react';
import CustomModal from '../components/common/CustomModal';

const ModalContext = createContext();

export const useModal = () => useContext(ModalContext);

export const ModalProvider = ({ children }) => {
    const [modalConfig, setModalConfig] = useState({
        isOpen: false,
        title: '안내',
        message: '',
        onConfirm: null,
        onCancel: null,
        confirmText: '확인',
        cancelText: null, // 단순 알림창에서는 기본적으로 취소 버튼을 숨김
    });

    // openModal이 모든 props를 받을 수 있도록 ...rest 사용
    const openModal = (props) => {
        setModalConfig({
            ...modalConfig, // 기본값 유지
            ...props,       // 전달된 props로 덮어쓰기
            isOpen: true,
        });
    };

    const closeModal = () => {
        // 상태를 초기 기본값으로 리셋
        setModalConfig({
            isOpen: false,
            title: '안내',
            message: '',
            onConfirm: null,
            onCancel: null,
            confirmText: '확인',
            cancelText: null,
        });
    };

    const handleConfirm = () => {
        if (modalConfig.onConfirm) {
            modalConfig.onConfirm();
        }
        closeModal(); // 작업 후 모달 닫기
    };

    const handleCancel = () => {
        if (modalConfig.onCancel) {
            modalConfig.onCancel();
        }
        closeModal(); // 작업 후 모달 닫기
    };

    return (
        <ModalContext.Provider value={{ openModal }}>
            {children}
            <CustomModal
                isOpen={modalConfig.isOpen}
                onClose={closeModal}
                // 배경 클릭/ESC/× 닫힘 표준: 취소 버튼이 있으면 '취소', 확인만 있는 알림이면 '확인'으로 처리.
                // (확인만 있는 알림은 닫음=수긍이므로 onConfirm 동작 누락으로 인한 미이동/흰 화면을 방지)
                onDismiss={(modalConfig.onCancel || modalConfig.cancelText) ? handleCancel : handleConfirm}
                title={modalConfig.title}
                // 특별한 onConfirm 함수가 없어도 확인 버튼으로 창을 닫을 수 있도록 항상 handleConfirm 전달
                onConfirm={handleConfirm}
                onCancel={modalConfig.onCancel || modalConfig.cancelText ? handleCancel : null}
                confirmText={modalConfig.confirmText || '확인'}
                cancelText={modalConfig.cancelText}
            >
                <div style={{ padding: '20px', textAlign: 'center', fontSize: '1.2rem', color: '#333', whiteSpace: 'pre-line', lineHeight: '1.5' }}>
                    {modalConfig.message}
                </div>
            </CustomModal>
        </ModalContext.Provider>
    );
};
