// import EmptyNav from "../components/login/EmptyNav.jsx";
import styles from "./Login.module.css";
import LoginContent from "../../components/Login/LoginContent.jsx";
// import LoginImg from "../images/Login.png";

const Login = () => {
    return (
        <div className={styles.login}>
            <br/>
            <LoginContent/>
        </div>
    )
}
export default Login
