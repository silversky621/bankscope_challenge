// Navbar.jsx (구조 수정)

import { Link } from 'react-router-dom'
import styles from './NavBar.module.css'
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
    const { user, logout } = useAuth();

    return (
        <nav className={styles.navbar}>
            <div className={styles.leftGroup}>
                <div className={styles.brand}><Link to="/">BankScope</Link></div>
            </div>

            <ul className={styles.navLinks}>

                <li><Link to="/my">My</Link></li>
                {user ? (
                    <li><button onClick={logout} className={styles.logoutButton}>Logout</button></li>
                ) : (
                    <li><Link to="/login">Login</Link></li>
                )}
            </ul>
        </nav>
    )
}

export default Navbar
