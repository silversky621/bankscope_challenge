/* eslint-disable react-hooks/set-state-in-effect */
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './CustomModal.module.css';

const CustomModal = ({
                         isOpen,
                         onClose,
                         onDismiss, // × 버튼으로 닫을 때의 동작(미지정 시 onClose)
                         title,
                         children,
                         onConfirm,
                         onCancel,
                         confirmText = '확인',
                         cancelText, // 기본값을 없애고, prop 존재 여부로 판단
                         duration = 0,
                         noAutoClose = false, // true 이면 onConfirm 후 자동 닫힘 안 함
                     }) => {
    const [isRendered, setIsRendered] = useState(false);
    const [isAnimate, setIsAnimate] = useState(false);
    // × 버튼으로 닫을 때의 동작. 미지정 시 단순 닫기.
    const dismiss = onDismiss || onClose;

    useEffect(() => {
        let firstFrame;
        let secondFrame;
        let autoCloseTimer;

        if (isOpen) {
            setIsRendered(true);
            // 브라우저 렌더링 사이클을 고려한 짧은 지연
            firstFrame = requestAnimationFrame(() => {
                secondFrame = requestAnimationFrame(() => setIsAnimate(true));
            });

            if (duration > 0) {
                autoCloseTimer = setTimeout(onClose, duration);
            }
        } else {
            setIsAnimate(false);
        }

        return () => {
            if (firstFrame) cancelAnimationFrame(firstFrame);
            if (secondFrame) cancelAnimationFrame(secondFrame);
            if (autoCloseTimer) clearTimeout(autoCloseTimer);
        };
    }, [isOpen, duration, onClose]);

    const handleTransitionEnd = (e) => {
        // opacity 트랜지션이 끝나고, 닫히는 중(isAnimate가 false)일 때만 DOM 제거
        if (e.target === e.currentTarget && e.propertyName === 'opacity' && !isAnimate) {
            setIsRendered(false);
        }
    };

    const handleCancelClick = () => {
        if (onCancel) {
            onCancel();
        }
        onClose();
    };

    const handleConfirmClick = () => {
        if (onConfirm) {
            onConfirm();
        }
        if (!noAutoClose) {
            onClose();
        }
    };

    if (!isRendered) return null;

    return createPortal(
        <div
            className={`${styles.overlay} ${isAnimate ? styles.isOpen : ''}`}
            onTransitionEnd={handleTransitionEnd}
        >
            <div className={styles.modalBox}>
                <div className={styles.header}>
                    <span>{title}</span>
                    <span className={styles.closeBtn} onClick={dismiss}>&times;</span>
                </div>

                <div className={styles.content}>
                    {children}
                </div>

                {(onConfirm || cancelText) && (
                    <div className={styles.footer}>
                        {cancelText && (
                            <button
                                className={`${styles.modalBtn} ${styles.cancel}`}
                                onClick={handleCancelClick}
                            >
                                {cancelText}
                            </button>
                        )}
                        {onConfirm && (
                            <button
                                className={`${styles.modalBtn} ${styles.confirm}`}
                                onClick={handleConfirmClick}
                            >
                                {confirmText}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};

export default CustomModal;
