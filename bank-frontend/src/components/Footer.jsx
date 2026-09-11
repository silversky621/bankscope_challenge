import React from 'react';
import styles from './Footer.module.css';

const Footer = () => {
    return (
        <footer className={styles.footer}>
            <div className={styles.container}>
                {/* 왼쪽: 회사 정보 */}
                <div className={styles.sectionLeft}>
                    <h3 className={styles.brandName}>BANKSCOPE (뱅크스코프)</h3>
                    <p>사업자등록번호: 123-45-67890</p>
                    <p>대표자: 김갑수</p>
                    <p>주소: 서울특별시 강남구 테헤란로 000, 00층</p>
                </div>

                {/* 중간: 고객센터 정보 */}
                <div className={styles.sectionCenter}>
                    <p>고객센터: 1588-0000</p>
                    <p>이메일: support@bankscope.kr</p>
                    <p>운영시간: 평일 09:00 ~ 18:00 (주말·공휴일 제외)</p>
                </div>

                {/* 오른쪽: 공지 및 카피라이트 */}
                <div className={styles.sectionRight}>
                    <p className={styles.notice}>
                        본 서비스는 금융상품을 직접 판매하지 않으며 상품 정보 제공을 목적으로 합니다.<br />
                        금리 및 조건은 금융사 정책에 따라 변동될 수 있습니다.
                    </p>
                    <p className={styles.copyright}>
                        COPYRIGHT © 2026 BANKSCOPE. ALL RIGHTS RESERVED.
                    </p>
                </div>

                {/* <p>&copy; 2026 Bank Scope. All rights reserved.</p> */}
            </div>
        </footer>
    );
};

export default Footer;
