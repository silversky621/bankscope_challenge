import React from 'react';
import styles from './Loading.module.css';

const Loading = ({ message = '로딩 중입니다...' }) => {
    return (
        <div className={styles.loadingOverlay}>
            <div className={styles.loadingContainer}>
                <div className={styles.spinner}></div>
                <p className={styles.loadingMessage}>{message}</p>
            </div>
        </div>
    );
};

export default Loading;
