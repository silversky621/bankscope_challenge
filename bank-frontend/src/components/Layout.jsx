import Navbar from './NavBar.jsx'
import Footer from './Footer.jsx'
import styles from './Layout.module.css'
import { useLocation } from 'react-router-dom';

const Layout = ({ children }) => {
    const location = useLocation();
    const path = location.pathname.toLowerCase();
    const isSpecialPage = path === '/adminlogin' || path === '/adminmain' || path === '/kiosk' || path === '/bankerworkspace';

    if (isSpecialPage) {
        return (
            <div className={styles.container}>
                <main className={styles.main}>
                    {children}
                </main>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <Navbar />
            <main className={styles.main}>
                {children}
            </main>
            <Footer />
        </div>
    )
}

export default Layout