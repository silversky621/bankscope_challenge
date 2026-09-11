import { Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import Layout from "./components/Layout";
import Home from "./pages/Customer/Home.jsx";
import Login from './pages/Customer/Login.jsx';
import Register from './pages/Customer/Register.jsx';
import MyPage from './pages/Customer/MyPage.jsx';
import PrivateRoute from './components/PrivateRoute.jsx';
import AdminLogin from './pages/Admin/AdminLogin.jsx';
import AdminMain from './pages/Admin/AdminMain.jsx';
import Kiosk from './pages/Kiosk/Kiosk.jsx';
import BankerWorkSpace from './pages/Banker/BankerWorkSpace.jsx';
import ModalTestPage from './components/common/ModalTestPage.jsx';
import LoadingTestPage from './components/common/LoadingTestPage.jsx';
import BoardList from './pages/Customer/BoardList';
import BoardDetail from './pages/Customer/BoardDetail';
import PinSetup from './pages/Customer/PinSetup.jsx';
import PinReset from "./pages/Customer/PinReset.jsx";
import OverdueIntro from './pages/Customer/OverdueIntro.jsx';
import OverdueRepay from './pages/Customer/OverdueRepay.jsx';
import CheckCard from './pages/Customer/CheckCard.jsx';
import Transfer from './pages/Customer/Transfer.jsx';
import AiRecommend from './pages/Customer/AiRecommend';
import CreditCard from './pages/Customer/CreditCard.jsx';

function App() {
  return (
    <Layout>
      <Routes>
        {/* /Main 등 잘못된 경로 접근 시 Home(/)으로 리다이렉트 */}
        <Route path="/Main" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />

        <Route path="/kiosk" element={<Kiosk/>} />
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* Customer 전용 페이지 */}
        <Route path="/my" element={<PrivateRoute allowedRoles={['customer','corporate']}><MyPage /></PrivateRoute>} />
        <Route path="/pinsetup" element={<PrivateRoute allowedRoles={['customer']}><PinSetup /></PrivateRoute>} />
        <Route path="/pinreset" element={<PrivateRoute allowedRoles={['customer']}><PinReset /></PrivateRoute>} />
        <Route path="/board/:boardType" element={<BoardList />} />
        <Route path="/board/detail/:id" element={<BoardDetail />} />
        <Route path="/overdue" element={<OverdueIntro />} />
        <Route path="/overdue/repay" element={<OverdueRepay />} />
        <Route path="/CheckCard" element={<CheckCard />} />
        <Route path="/Transfer" element={<PrivateRoute allowedRoles={['customer', 'corporate']}><Transfer /></PrivateRoute>} />
        <Route path="/AiRecommend" element={<AiRecommend />} />
        <Route path="/CreditCard" element={<PrivateRoute allowedRoles={['customer']}><CreditCard /></PrivateRoute>} />

        <Route path="/adminlogin" element={<AdminLogin />} />
        
        {/* Admin 전용 페이지 */}
        <Route path="/adminmain" element={<PrivateRoute allowedRoles={['admin']}><AdminMain /></PrivateRoute>} />

        
        {/* Member 전용 페이지 */}
        <Route path="/bankerworkspace" element={<PrivateRoute allowedRoles={['member']}><BankerWorkSpace /></PrivateRoute>} />


        {/* 테스트용 페이지 (개발용) */}
        <Route path="/test-modal" element={<ModalTestPage />} />
        <Route path="/test-loading" element={<LoadingTestPage />} />
      </Routes>
    </Layout>
  );
}

export default App;
