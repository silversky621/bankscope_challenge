import React from 'react';
import styles from './AdminLogin.module.css';
import AdminLoginContent from '../../components/Login/AdminLoginContent.jsx';

const AdminLogin = () => {
    return (
        <div className={styles.login}>
            <AdminLoginContent/>
        </div>
    )
}
export default AdminLogin;
