import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './BankerWorkSpace.module.css';
import { useModal } from '../../context/ModalContext';
import WorkSpaceBackground from '../../images/Banker/WorkSpaceBackground.png';
import { useAuth } from '../../context/AuthContext';
import AccountCreateForm from "../../components/Banker/AccountCreate.jsx";
import Accounts from "../../components/Banker/Accounts.jsx";
import ChatModal from "../../pages/Banker/ChatModal.jsx";
import CustomModal from '../../components/common/CustomModal';
import TossModal from '../../components/Banker/TossModal';
import Deposit from '../../components/Banker/Deposit';
import Withdraw from "../../components/Banker/Withdraw.jsx";
import TaskSelect from "../../components/Banker/TaskSelect.jsx";
import Card from "../../components/Banker/Card.jsx";
import Transfer from "../../components/Banker/Transfer.jsx";
import LoanPayment from "../../components/Banker/LoanPayment.jsx";
import FinancialProduct from "../../components/Banker/FinancialProduct.jsx";
import CorporateLoan from "../../components/Banker/CorporateLoan.jsx";
import CorporateAccount from "../../components/Banker/CorporateAccount.jsx";
import CorporateCard from "../../components/Banker/CorporateCard.jsx";
import CorporateBankrupt from "../../components/Banker/CorporateBankrupt.jsx";
import CorporateArrears from "../../components/Banker/CorporateArrears.jsx";
import ChangePassword from "../../components/Banker/ChangePassword.jsx";
import ProductModal from '../../components/Banker/ProductModal/ProductModal.jsx';
import { fetchAssignedTask, fetchTaskProcessingLogs } from '../../services/taskApi';
import UpdateCorporate from "../../components/Banker/UpdateCorporate.jsx";

const BankerWorkSpace = () => {
    const { openModal } = useModal();
    const [isWorking, setIsWorking] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);

    // 비밀번호 변경 모달 상태
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');

    const handleProductClick = (product) => {
        setSelectedProduct(product);
        setIsModalOpen(true);
    };

    const [tasks, setTasks] = useState([]);
    const [selectedTask, setSelectedTask] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // 💡 업무 처리 로그 상태 추가
    const [logList, setLogList] = useState([]);
    const [isLogLoading, setIsLogLoading] = useState(false);
    const [logError, setLogError] = useState(null);

    // 💡 AI 상품 추천 상태 추가
    const [recommendProducts, setRecommendProducts] = useState([]);
    const [isRecommendLoading, setIsRecommendLoading] = useState(false);

    // AI 업무 예측 설명 요약 상태
    const [aiInsight, setAiInsight] = useState(null);
    const [isAiInsightLoading, setIsAiInsightLoading] = useState(false);
    const [aiInsightError, setAiInsightError] = useState(null);
    const [selectedAiReason, setSelectedAiReason] = useState(null);

    // 💡 고객 정보 상태 추가
    const [customerInfo, setCustomerInfo] = useState(null);

    const [isChatOpen, setIsChatOpen] = useState(false);
    const [messages, setMessages] = useState([
        { sender: "customer", text: "안녕하세요 상담 요청드립니다." },
        { sender: "banker", text: "네 고객님 무엇을 도와드릴까요?" }
    ]);
    const [isTossModalOpen, setIsTossModalOpen] = useState(false);
    const [taskToToss, setTaskToToss] = useState(null); // 어떤 업무를 이관할지 저장

    const [selectedWorkType, setSelectedWorkType] = useState(null);
    const [lastTaskPage, setLastTaskPage] = useState(1);
    const [note, setNote] = useState("");

    // 계좌 유형의 초기값을 "CHECKING"으로 설정
    const [, setAccountType] = useState("CHECKING");
    const [accountAlias, setAccountAlias] = useState("");
    const [accountPassword, setAccountPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [productId, setProductId] = useState(""); // 추가: 선택된 상품 ID
    const [amount, setAmount] = useState(""); // 초기입금액 상태 추가

    const [input, setInput] = useState("");
    const chatEndRef = useRef(null);

    const { user, logout, loading } = useAuth();
    const navigate = useNavigate();

    // 💡 공통 모달 상태 추가
    const [modalConfig, setModalConfig] = useState({
        isOpen: false,
        message: '',
        onConfirm: null
    });
    const modalActionHandled = useRef(false);

    const showAlert = (message, onConfirm = null) => {
        modalActionHandled.current = false;
        setModalConfig({ isOpen: true, message, onConfirm });
    };

    const handleModalClose = () => {
        if (modalActionHandled.current) return;
        modalActionHandled.current = true;
        setModalConfig(prev => ({ ...prev, isOpen: false }));
        if (modalConfig.onConfirm) {
            modalConfig.onConfirm();
        }
    };

    const handleAiReasonClick = (reason, index) => {
        setSelectedAiReason({
            ...reason,
            rank: index + 1,
        });
    };

    const handleChangePassword = async () => {
        if (newPassword !== confirmNewPassword) {
            showAlert("새 비밀번호가 일치하지 않습니다.");
            return;
        }
        if (newPassword.length < 4) { // 예시: 최소 4자
            showAlert("비밀번호는 최소 4자 이상이어야 합니다.");
            return;
        }

        try {
            const response = await fetch('/api/member/password', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: newPassword }),
            });

            if (response.ok) {
                const data = await response.json();
                if (data.result === 'SUCCESS') {
                    showAlert("비밀번호가 성공적으로 변경되었습니다.");
                    setIsPasswordModalOpen(false);
                    setNewPassword('');
                    setConfirmNewPassword('');
                } else {
                    showAlert("비밀번호 변경에 실패했습니다.");
                }
            } else {
                showAlert("서버 오류로 비밀번호 변경에 실패했습니다.");
            }
        } catch (error) {
            console.error("Error changing password:", error);
            showAlert("네트워크 오류로 비밀번호 변경에 실패했습니다.");
        }
    };

    const handleTaskMenuSelect = (taskTitle, pageNumber) => {
        // TaskSelect에서 넘어온 제목에 따라 mapping

        setLastTaskPage(pageNumber);
        switch (taskTitle) {
            case "입출금 계좌 개설":
                setSelectedWorkType("ACCOUNT_CREATE");
                break;
            case "법인등록":
                setSelectedWorkType("CORPORATE_REGISTER");
                break;
            case "입금":
                setSelectedWorkType("DEPOSIT");
                break;
            case "출금":
                setSelectedWorkType("WITHDRAW");
                break;
            case "예금":
                setSelectedWorkType("ACCOUNTS");
                break;
            case "적금":
                setSelectedWorkType("ACCOUNTS");
                break;
            case "이체" :
                setSelectedWorkType("TRANSFER")
                break;
            case "카드수령":
                setSelectedWorkType("CARD");
                break;
            case "체크카드 발급":
                setSelectedWorkType("CARD");
                break;
            case "신용카드 발급":
                setSelectedWorkType("CARD");
                break;
            /*case "법인카드 발급":
                setSelectedWorkType("CARD");
                break;*/
            case "대출 상환" :
                setSelectedWorkType("LOAN-PAYMENT");
                break;
            case "금융상품가입":
                setSelectedWorkType("FINANCIAL-PRODUCT");
                break;
            case "기업대출":
                setSelectedWorkType("CORPORATE-LOAN");
                break;
            case "법인계좌 개설":
                setSelectedWorkType("CORPORATE-ACCOUNT");
                break;
            case "법인카드 발급":
                setSelectedWorkType("CORPORATE-CARD");
                break;
            case "부도관리":
                setSelectedWorkType("BANKRUPT-MANAGEMENT");
                break;
            case "연체관리":
                setSelectedWorkType("CORPORATE-ARREARS");
                break;
            case "통장비밀번호 변경":
                setSelectedWorkType("CHANGE-PASSWORD");
                break;
            default:
                setSelectedWorkType(null);
                break;
        }
    };

    useEffect(() => {
        if (!loading && !user) {
            showAlert("로그인이 필요한 서비스입니다.", () => {
                navigate("/Adminlogin");
            });
        } else if (user) {
            const savedStatus = localStorage.getItem(`bankerStatus_${user.email}`);

            if (user.status !== undefined && user.status !== null) {
                setIsWorking(user.status === 1);
                localStorage.setItem(`bankerStatus_${user.email}`, user.status === 1 ? '1' : '0');
            } else if (savedStatus !== null) {
                setIsWorking(savedStatus === '1');
            } else {
                setIsWorking(true);
            }
        }
    }, [user, loading, navigate]);

    // 💡 업무 목록 조회 API 호출 (services 모듈 사용)
    const fetchTasks = async () => {
        try {
            const data = await fetchAssignedTask();
            setTasks(data);
        } catch (error) {
            console.error('Error fetching tasks:', error);
            setTasks([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchTasks();
            const interval = setInterval(fetchTasks, 10000);
            return () => clearInterval(interval);
        }
    }, [user]);

    const loadUserLogs = async (userId) => {
        if (!userId) {
            setLogList([]);
            return;
        }
        setIsLogLoading(true);
        setLogError(null);
        try {
            const logs = await fetchTaskProcessingLogs(userId);
            setLogList(logs);
            // eslint-disable-next-line no-unused-vars
        } catch (error) {
            setLogError("업무 이력을 불러오는데 실패했습니다.");
        } finally {
            setIsLogLoading(false);
        }
    };

    const loadRecommendProducts = async (userId) => {
        if (!userId) {
            setRecommendProducts([]);
            return;
        }
        setIsRecommendLoading(true);
        try {
            const response = await fetch(`/py/recommend/${userId}`);
            if (response.ok) {
                const data = await response.json();
                if (data.result === 'SUCCESS' && data.products) {
                    setRecommendProducts(data.products.slice(0, 3));
                } else {
                    setRecommendProducts([]);
                }
            } else {
                setRecommendProducts([]);
            }
        } catch (error) {
            console.error("Error fetching recommend products:", error);
            showAlert("AI 추천상품을 불러오지 못했습니다.", () => {
                setRecommendProducts([]);
            })
        } finally {
            setIsRecommendLoading(false);
        }
    };

    const loadAiInsight = async (userId) => {
        if (!userId) {
            setAiInsight(null);
            setAiInsightError(null);
            return;
        }
        setIsAiInsightLoading(true);
        setAiInsightError(null);
        try {
            const response = await fetch(`/py/explain/${userId}/summary`);
            if (response.ok) {
                const data = await response.json();
                if (data.result === 'SUCCESS') {
                    setAiInsight(data);
                } else {
                    setAiInsight(null);
                    setAiInsightError('AI 참고 요인을 불러오지 못했습니다.');
                }
            } else {
                setAiInsight(null);
                setAiInsightError('AI 참고 요인을 불러오지 못했습니다.');
            }
        } catch (error) {
            console.error("Error fetching AI insight:", error);
            setAiInsight(null);
            setAiInsightError('AI 참고 요인을 불러오지 못했습니다.');
        } finally {
            setIsAiInsightLoading(false);
        }
    };

    const loadCustomerInfo = async (userId) => {
        if (!userId) {
            setCustomerInfo(null);
            return;
        }
        try {
            const response = await fetch(`/api/user/info?userId=${userId}`);
            if (response.ok) {
                const data = await response.json();
                if (data.result === 'SUCCESS' && data.user) {
                    setCustomerInfo(data.user);
                } else {
                    setCustomerInfo(null);
                }
            } else {
                setCustomerInfo(null);
            }
        } catch (error) {
            console.error("Error fetching customer info:", error);
            setCustomerInfo(null);
        }
    };

    useEffect(() => {
        setSelectedAiReason(null);

        if (selectedTask?.userId) {
            loadUserLogs(selectedTask.userId);
            loadRecommendProducts(selectedTask.userId);
            loadAiInsight(selectedTask.userId);
            loadCustomerInfo(selectedTask.userId);
        } else {
            setLogList([]);
            setLogError(null);
            setRecommendProducts([]);
            setAiInsight(null);
            setAiInsightError(null);
            setCustomerInfo(null);
        }
    }, [selectedTask?.userId]);

    // 자동 스크롤
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
        setSelectedWorkType(null);

        if (selectedTask) {
            setMessages([
                { sender: "customer", text: "안녕하세요 상담 요청드립니다." },
                { sender: "banker", text: "네 고객님 무엇을 도와드릴까요?" }
            ]);

            if (selectedTask.status === 'IN_PROGRESS' &&
                (selectedTask.taskDetailType === "입출금 계좌개설" || selectedTask.taskDetailType === "계좌개설" || selectedTask.taskDetailType === "입출금 계좌 개설")) {
                setSelectedWorkType("ACCOUNT_CREATE");
            }
            if (selectedTask.status === 'IN_PROGRESS' &&
                ( selectedTask.taskDetailType === "예금" || selectedTask.taskDetailType === "적금" || selectedTask.taskDetailType === "법인계좌 개설")) {
                setSelectedWorkType("ACCOUNTS");
            }
            if (selectedTask.status === 'IN_PROGRESS' &&
                ( selectedTask.taskDetailType ==="입금")) {
                setSelectedWorkType("DEPOSIT");
            }
            if (selectedTask.status === 'IN_PROGRESS' &&
                ( selectedTask.taskDetailType ==="출금")) {
                setSelectedWorkType("WITHDRAW");
            }
            if (selectedTask.status === 'IN_PROGRESS' &&
                ( selectedTask.taskDetailType ==="이체")) {
                setSelectedWorkType("TRANSFER");
            }
            if (selectedTask.status === 'IN_PROGRESS' &&
                ( selectedTask.taskDetailType.includes('카드'))) {
                setSelectedWorkType("CARD");
            }
            if (selectedTask.status === 'IN_PROGRESS' &&
                ( selectedTask.taskDetailType.endsWith("상환"))) {
                setSelectedWorkType("LOAN-PAYMENT");
            }

            if (selectedTask.status === 'IN_PROGRESS' &&
                ( selectedTask.taskDetailType.includes("금융상품") || selectedTask.taskDetailType.endsWith("대출"))) {
                setSelectedWorkType("FINANCIAL-PRODUCT");
            }
            if (selectedTask.status === 'IN_PROGRESS' &&
                ( selectedTask.taskDetailType ==="통장비밀번호 변경")) {
                setSelectedWorkType("CHANGE-PASSWORD");
            }
            if (selectedTask.status === 'IN_PROGRESS' &&
                ( selectedTask.taskDetailType ==="기업대출")) {
                setSelectedWorkType("CORPORATE-LOAN");
            }
            if (selectedTask.status === 'IN_PROGRESS' &&
                ( selectedTask.taskDetailType ==="법인계좌")) {
                setSelectedWorkType("CORPORATE-ACCOUNT");
            }

            if (selectedTask.status === 'IN_PROGRESS' &&
                ( selectedTask.taskDetailType ==="부도관리")) {
                setSelectedWorkType("BANKRUPT-MANAGEMENT");
            }
            if (selectedTask.status === 'IN_PROGRESS' &&
                ( selectedTask.taskDetailType ==="연체관리")) {
                setSelectedWorkType("DELINQUENT-MANAGEMENT");
            }

            if (selectedTask.status === 'IN_PROGRESS' &&
                selectedTask.taskDetailType === "기업대출") {
                setSelectedWorkType("CORPORATE-LOAN");
            }

            if (selectedTask.status === 'IN_PROGRESS' &&
                selectedTask.taskDetailType === "법인계좌 개설") {
                setSelectedWorkType("CORPORATE-ACCOUNT");
            }

            if (selectedTask.status === 'IN_PROGRESS' &&
                selectedTask.taskDetailType === "법인카드 발급") {
                setSelectedWorkType("CORPORATE-CARD");
            }

            if (selectedTask.status === 'IN_PROGRESS' &&
                selectedTask.taskDetailType === "부도관리") {
                setSelectedWorkType("BANKRUPT-MANAGEMENT");
            }

            if (selectedTask.status === 'IN_PROGRESS' &&
                selectedTask.taskDetailType === "연체관리") {
                setSelectedWorkType("CORPORATE-ARREARS");
            }

            if (selectedTask.status === 'IN_PROGRESS' &&
            (selectedTask.taskDetailType === "통장 비밀번호 변경")) {
            setSelectedWorkType("CHANGE-PASSWORD");
            }
        }
    }, [selectedTask]);

    useEffect(() => {
        if (selectedTask) {
            const currentTaskInList = tasks.find(t => t.taskId === selectedTask.taskId);

            if (!currentTaskInList || currentTaskInList.status === 'COMPLETED') {
                setSelectedTask(null);
                setSelectedWorkType(null);
            } else {
                if(currentTaskInList.status !== selectedTask.status) {
                    setSelectedTask(currentTaskInList);
                }
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tasks]);

    if (loading) return <div>Loading...</div>;
    if (!user) return null;

    const handleLogout = async () => {
        await logout();
        navigate('/adminlogin');
    };

    /*채팅 전송 함수*/
    const handleSend = () => {
        if (!input.trim()) return;

        setMessages(prev => [
            ...prev,
            { sender: "banker", text: input }
        ]);

        setInput("");
    };

    /* 계좌 생성 함수 */
    const handleCreateAccount = async () => {
        if (!selectedTask) return;

        if (!productId) {
            showAlert("상품을 선택해주세요.");
            return;
        }

        if (accountPassword !== confirmPassword) {
            showAlert("비밀번호가 일치하지 않습니다.");
            return;
        }

        try {
            const payload = {
                taskId: selectedTask.taskId,
                productId: parseInt(productId, 10),
                amount: amount ? Number(amount) : 0, // amount 상태값 전달
                durationMonths: null,
                accountPassword: accountPassword,
                accountAlias: accountAlias,
                userId: selectedTask.userId
            };

            const response = await fetch(`/api/account/register`, {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                showAlert("서버 응답 오류로 계좌 생성에 실패하였습니다.");
                return;
            }

            const data = await response.json();

            switch (data.result) {
                case 'SUCCESS':
                    // 여기서 업무 종료(COMPLETED) 처리 부분을 삭제하고 폼 리셋만 수행
                    showAlert(`계좌가 생성되었습니다.\n계좌번호: ${data.account?.accountNumber}`, async () => {
                        setSelectedWorkType("TASK_SELECT"); // 화면을 처음 메뉴 선택화면으로
                        setAccountType("CHECKING");
                        setAccountAlias("");
                        setAccountPassword("");
                        setConfirmPassword("");
                        setProductId("");
                        setAmount("");
                    });
                    break;
                case 'FAILURE_TASK_IN_PROGRESS':
                    showAlert("해당 업무가 현재 처리 가능한 상태가 아닙니다.");
                    break;
                case 'FAILURE_SESSION':
                    openModal({
                        title: '알림',
                        message: `세션이 만료되었습니다. 다시 로그인해주세요.`,
                        confirmText: '확인',
                        onConfirm: () =>  navigate("adminlogin")
                    });
                    break;
                case 'FAILURE':
                    showAlert("계좌 생성에 실패하였습니다.");
                    break;
                default:
                    showAlert("알수없는 이유로 계좌 생성에 실패하였습니다.");
                    break;
            }
        } catch (error) {
            console.error("계좌 생성 프로세스 오류:", error);
            showAlert("처리 중 예기치 못한 오류가 발생했습니다.");
        }
    };

    // 업무 수락 취소 (IN_PROGRESS -> WAITING)
    const performCancelAcceptTask = async (task) => {
        try {
            const response = await fetch(`/api/member/task/${task.taskId}/status?status=WAITING`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
            });

            if (!response.ok) {
                showAlert('서버 오류 발생');
                return;
            }

            const data = await response.json();

            switch (data.result) {
                case 'SUCCESS':
                { const updatedTask = { ...task, status: 'WAITING' };
                    setSelectedTask(updatedTask);
                    setTasks(prevTasks => prevTasks.map(t => t.taskId === task.taskId ? updatedTask : t));
                    setSelectedWorkType(null);
                    await fetchTasks();
                    break; }

                case 'FAILURE_SESSION':
                    openModal({
                        title: '알림',
                        message: `세션이 만료되었습니다. 다시 로그인해주세요.`,
                        confirmText: '확인',
                        onConfirm: () =>  navigate("adminlogin")
                    });
                    break;

                case 'FAILURE':
                default:
                    showAlert(`업무 취소 실패: ${data.result}`);
                    break;
            }
        } catch (error) {
            console.error('Error canceling task:', error);
            showAlert('오류가 발생했습니다.');
        }
    };

    // 업무 기록 저장 함수
    const handleCancelAcceptTask = (task) => {
        if (!task?.taskId) return;
        openModal({
            title: '업무 취소',
            message: '이 업무를 취소하고 대기열로 되돌리시겠습니까?',
            confirmText: '업무 취소',
            cancelText: '계속 처리',
            onConfirm: () => performCancelAcceptTask(task)
        });
    };

    const handlePostLog = async (idValue) => {
        if (!note.trim()) {
            return;
        }

        if (!idValue) {
            return;
        }
        const logParams = new URLSearchParams({
            note: note,
            taskId: idValue
        }).toString();

        try {
            const response = await fetch(`/api/task-processing-log/?${logParams}`, {
                method: 'POST'

            });

            if (response.ok) {
                console.log("✅ DB 저장 성공! 테이블을 확인해보세요.");
                setNote("");
                // 작성 후 로그 리스트 즉시 리프레시
                if (selectedTask?.userId) loadUserLogs(selectedTask.userId);
            } else {
                console.error("❌ 서버 응답 에러:", response.status);
            }
        } catch (error) {
            console.error("❌ 네트워크 에러:", error);
        }
    };

    // 멤버 상태 변경 API 연결 함수
    const handleStatusChange = async (e) => {
        const selectedValue = e.target.value;
        const nextStatus = selectedValue === 'working';

        const hasInProgressTask = tasks.some(task => task.status === 'IN_PROGRESS');

        if (!nextStatus && hasInProgressTask) {
            showAlert('현재 처리 중인 업무가 있습니다. 업무를 종료한 후 자리 비움 상태로 변경해주세요.');
            return;
        }

        let apiStatus = nextStatus;
        setIsWorking(nextStatus);

        try {
            const response = await fetch(`/api/member/status?status=${apiStatus}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await response.json();

            if (response.ok && data.result === "SUCCESS") {
                if (user) {
                    user.status = nextStatus ? 1 : 0;
                    localStorage.setItem(`bankerStatus_${user.email}`, nextStatus ? '1' : '0');
                }

                openModal({
                    title: '상태 변경 완료',
                    message: `현재 업무 상태가 [${nextStatus ? '업무 중' : '자리 비움'}]으로 변경되었습니다.`,
                    confirmText: '확인',
                    onConfirm: () => console.log("변경 확인 완료")
                });
            } else {
                setIsWorking(!nextStatus);
                openModal({
                    title: '변경 실패',
                    message: '상태 변경에 실패했습니다. 다시 시도해 주세요.',
                    confirmText: '확인'
                });
            }
        } catch (error) {
            console.error("Error changing status:", error);
            setIsWorking(!nextStatus);
            openModal({
                title: '오류',
                message: '서버와 통신할 수문을 수 없습니다.',
                confirmText: '확인'
            });
        }
    };

    // 업무 수락 (WAITING -> IN_PROGRESS)
    const handleAcceptTask = async (task) => {
        try {
            const response = await fetch(`/api/member/task/${task.taskId}/status?status=IN_PROGRESS`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
            });

            if (!response.ok) {
                showAlert('서버 오류 발생');
                return;
            }

            const data = await response.json();

            switch (data.result) {
                case 'SUCCESS':
                {
                    const updatedTask = { ...task, status: 'IN_PROGRESS' };
                    setSelectedTask(updatedTask);
                    setTasks(prevTasks => prevTasks.map(t => t.taskId === task.taskId ? updatedTask : t));
                    await fetchTasks();

                    if (!isWorking) {
                        await handleStatusChange({ target: { value: 'working' } });
                    }

                    break;
                }

                case 'FAILURE_TASK_IN_PROGRESS':
                    showAlert('이미 다른 담당자가 처리 중인 업무입니다.');
                    await fetchTasks();
                    break;

                case 'FAILURE_SESSION':

                    openModal({
                        title: '알림',
                        message: `세션이 만료되었습니다. 다시 로그인해주세요.`,
                        confirmText: '확인',
                        onConfirm: () =>  navigate("adminlogin")
                    });
                    break;

                case 'FAILURE':
                default:
                    showAlert('업무 수락에 실패했습니다.');
                    break;
            }
        } catch (error) {
            console.error('Error accepting task:', error);
            showAlert('오류가 발생했습니다.');
        }
    };

    // 업무 종료 (IN_PROGRESS -> COMPLETED)
    const handleCompleteTask = async (taskToComplete) => {
        const targetTask = taskToComplete || selectedTask;
        if (!targetTask) return;

        try {
            const response = await fetch(`/api/member/task/${targetTask.taskId}/status?status=COMPLETED`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
            });

            if (!response.ok) {
                showAlert('서버 오류 발생');
                return;
            }

            const data = await response.json();

            switch (data.result) {
                case 'SUCCESS':
                    showAlert('업무가 종료되었습니다.', async () => {
                        setTasks(prevTasks => prevTasks.map(t =>
                            t.taskId === targetTask.taskId ? { ...t, status: 'COMPLETED' } : t
                        ));
                        if (selectedTask?.taskId === targetTask.taskId) {
                            setSelectedTask(null);
                            setSelectedWorkType(null);
                        }
                        await fetchTasks();
                    });
                    break;

                case 'FAILURE_SESSION':
                    showAlert('로그인 정보가 유효하지 않습니다.');
                    break;

                default:
                    showAlert('업무 종료 처리에 실패했습니다.');
                    break;
            }
        } catch (error) {
            console.error('Error completing task:', error);
            showAlert('오류가 발생했습니다.');
        }
    };

    // 대기 중인 업무와 처리 중인 업무 모두 표시
    const visibleTasks = tasks.filter(task => task.status === 'WAITING' || task.status === 'IN_PROGRESS');

    // 연령대 계산 로직 추가
    const determineAgeGroup = (age) => {
        if (!age) return null;
        const numAge = Number(age);
        if (isNaN(numAge)) return null;

        if (numAge < 20) return "10대";
        if (numAge < 30) return "20대";
        if (numAge < 40) return "30대";
        if (numAge < 50) return "40대";
        if (numAge < 60) return "50대";
        return "60대";
    };

    return (
        <div className={styles.container}>
            <img src={WorkSpaceBackground} alt="WorkSpace Background" className={styles.backgroundImage} />

            <div className={styles.glassWrapper}>
                <div className={styles.topControls}>
                    <div className={styles.themeToggle}>
                        <span className={styles.sunIcon}>☀️</span>
                        <div className={styles.toggleKnob}></div>
                    </div>
                    <div className={styles.windowBtns}>
                        <button className={`${styles.winBtn} ${styles.btnMaximize}`}>{'<>'}</button>
                        <button className={`${styles.winBtn} ${styles.btnMinimize}`}>—</button>
                        <button className={`${styles.winBtn} ${styles.btnClose}`}>X</button>
                    </div>
                </div>

                <div className={styles.workspaceWrapper}>
                    <header className={styles.header}>
                        <h1 className={styles.logo}>BankScope</h1>

                        <div className={styles.headerRightContainer}>
                            <div className={styles.headerRight}>
                                <select className={styles.statusSelect}
                                value={isWorking ? 'working' : 'away'}
                                onChange={handleStatusChange}>
                                    <option value="working">업무 중</option>
                                    <option value="away">자리 비움</option>
                                </select>
                                <div className={styles.userInfo}>
                                    <span className={styles.userIcon}>👤</span>
                                    <span className={styles.userName}>{user?.name || '김행원'} {user?.level ? `Lv.${user.level}` : ''}</span>
                                </div>
                                <button className={styles.headerBtn} onClick={handleLogout}>로그아웃</button>
                                <button className={styles.headerBtn} onClick={() => setIsPasswordModalOpen(true)}>비밀번호 변경</button>
                            </div>
                        </div>
                    </header>

                    <div className={styles.contentBody}>
                        <aside className={styles.leftSidebar}>
                            <div className={styles.sidebarHeader}>
                                <span>접수고객</span>
                                <span className={styles.waitingCount}>••• {visibleTasks.length}명 대기/처리중</span>
                            </div>
                            <div className={styles.customerList}>
                                {isLoading ? (
                                    <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>로딩 중...</div>
                                ) : visibleTasks.length === 0 ? (
                                    <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>대기 중인 고객이 없습니다.</div>
                                ) : (
                                    visibleTasks.map((task) => (
                                        <div
                                            key={task.taskId}
                                            className={`${styles.customerCard} ${selectedTask?.taskId === task.taskId ? styles.activeCard : ''}`}
                                            onClick={() => setSelectedTask(task)}
                                        >
                                            <div className={styles.cardHeader}>
                                                <span className={styles.customerName}>
                                                    {task.userName} <small>{task.ticketNumber}</small>
                                                    {task.isAi && (
                                                        <span style={{
                                                            marginLeft: '6px',
                                                            padding: '1px 6px',
                                                            backgroundColor: '#6c63ff',
                                                            color: '#fff',
                                                            borderRadius: '4px',
                                                            fontSize: '0.65rem',
                                                            fontWeight: 'bold',
                                                            verticalAlign: 'middle'
                                                        }}>AI</span>
                                                    )}
                                                </span>
                                                <span className={`${styles.tierBadge} ${styles.일반}`}>{task.grade || '일반'}</span>
                                            </div>
                                            <div className={styles.cardInfo}>
                                                <span className={styles.time}>🕗 {task.createdAt ? new Date(task.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</span>
                                                <span className={styles.taskLine}></span>
                                                <span className={styles.task}>{task.taskDetailType}</span>
                                            </div>
                                            <div className={styles.riskBarContainer}>
                                                <div className={styles.riskBar} style={{ width: '0%' }}>0%</div>
                                                <span className={styles.riskText}>연체 / 리스크 지수</span>
                                            </div>
                                            <div className={styles.cardActions}>
                                                {task.status === 'IN_PROGRESS' ? (
                                                    <>
                                                        <button
                                                            className={styles.btnCancelTask}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleCancelAcceptTask(task);
                                                            }}
                                                        >
                                                            업무 취소
                                                        </button>
                                                        <button
                                                            className={styles.btnAccept}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleCompleteTask(task);
                                                            }}
                                                        >
                                                            업무 종료
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                    <button
                                                        className={styles.btnAccept}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleAcceptTask(task);
                                                        }}
                                                    >
                                                        업무 수락
                                                    </button>
                                                        <button
                                                            className={styles.btnToss}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setTaskToToss(task); // 이관할 태스크 저장
                                                                setIsTossModalOpen(true); // 모달 열기
                                                            }}
                                                        >
                                                            창구이관
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </aside>

                        <main className={styles.mainContent}>
                            {!selectedTask ? (
                                <div className={styles.welcomeScreen}>
                                    <h2>업무를 시작해주세요</h2>
                                    <h1 className={styles.bigLogo}>BankScope</h1>
                                </div>
                            ) : (
                                <div className={styles.detailScreen}>
                                    <div className={styles.detailMain}>
                                        <div className={styles.detailHeader}>
                                            <div className={styles.detailCustomerInfo}>
                                                <span className={`${styles.tierBadge} ${styles.일반}`}>{selectedTask.grade || '일반'}</span>
                                                {selectedTask.isAi && (
                                                    <span style={{
                                                        padding: '2px 8px',
                                                        backgroundColor: '#6c63ff',
                                                        color: '#fff',
                                                        borderRadius: '6px',
                                                        fontSize: '0.7rem',
                                                        fontWeight: 'bold',
                                                        marginLeft: '6px'
                                                    }}>AI 자동접수</span>
                                                )}
                                                <h2>{selectedTask.userName} <small>{selectedTask.ticketNumber}</small></h2>
                                            </div>
                                            <div className={styles.detailRisk}>
                                                예상 대기 시간 <strong>{selectedTask.expectedWaitingTime}분</strong>
                                            </div>
                                        </div>
                                        <div className={styles.accountList}>
                                            <div className={styles.accountCard}>
                                                {selectedWorkType === "TASK_SELECT" ? (
                                                    <TaskSelect
                                                        initialPage={lastTaskPage}
                                                        onSelectTask={(taskTitle, pageNumber) => handleTaskMenuSelect(taskTitle, pageNumber)}
                                                        selectedTask={selectedTask}
                                                    />
                                                ) : (
                                                    <>
                                                        <div className={styles.accountHeader}>
                                                            <h3>요청 업무</h3>
                                                            <span className={styles.tagBlue}>{selectedTask.taskType}</span>
                                                        </div>

                                                        {selectedTask.status !== 'IN_PROGRESS' && (
                                                            <>
                                                                <p>상세 내용: {selectedTask.taskDetailType}</p>
                                                                <p>접수 시간: {selectedTask.createdAt}</p>
                                                                <p>주민등록번호(신원확인용): {customerInfo?.residentNumber || '로딩 중...'}</p>
                                                            </>
                                                        )}

                                                        {!selectedWorkType && (
                                                            selectedTask.status === 'WAITING' ? (
                                                                <button
                                                                    className={styles.btnStart}
                                                                    style={{ marginTop: "10px" }}
                                                                    onClick={() => handleAcceptTask(selectedTask)}
                                                                >
                                                                    업무 수락
                                                                </button>
                                                            ) : (
                                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '20px' }}>
                                                                    <div style={{ display: 'flex', width: '100%', gap: '10px' }}>
                                                                        <button
                                                                            className={styles.btnAccept}
                                                                            onClick={() => handleCompleteTask(selectedTask)}
                                                                        >
                                                                            업무 종료
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            )
                                                        )}

                                                        {/*입출금 (일반 예금) 계좌개설*/}
                                                        {selectedWorkType === "ACCOUNT_CREATE" && (
                                                            <AccountCreateForm
                                                                accountAlias={accountAlias}
                                                                setAccountAlias={setAccountAlias}
                                                                accountPassword={accountPassword}
                                                                setAccountPassword={setAccountPassword}
                                                                confirmPassword={confirmPassword}
                                                                setConfirmPassword={setConfirmPassword}
                                                                productId={productId}
                                                                setProductId={setProductId}
                                                                amount={amount}
                                                                setAmount={setAmount}
                                                                onCreate={handleCreateAccount}
                                                            />
                                                        )}
                                                        {/*법인등록*/}
                                                        {selectedWorkType === "CORPORATE_REGISTER" && (
                                                            <UpdateCorporate
                                                                selectedTask={selectedTask}
                                                                onComplete={() => {
                                                                    const finalId = selectedTask?.id || selectedTask?.taskId || selectedTask;
                                                                    handlePostLog(finalId);
                                                                    setSelectedWorkType("TASK_SELECT");
                                                                }}
                                                            />                                                        )}

                                                        {/*입금*/}
                                                        {selectedWorkType === "DEPOSIT" && (
                                                            <Deposit
                                                                taskId={selectedTask?.id || selectedTask?.taskId || 0}
                                                                selectedTask={selectedTask}
                                                                onSuccess={() => {
                                                                    const finalId = selectedTask?.id || selectedTask?.taskId || selectedTask?.task_id;
                                                                    handlePostLog(finalId);
                                                                    setSelectedWorkType("TASK_SELECT"); // 화면을 처음 메뉴 선택화면으로
                                                                }}
                                                            />
                                                        )}

                                                        {/*출금*/}
                                                        {selectedWorkType === "WITHDRAW" && (
                                                            <Withdraw
                                                                taskId={selectedTask?.id}
                                                                selectedTask={selectedTask}
                                                                onSuccess={() => {
                                                                    const finalId = selectedTask?.id || selectedTask?.taskId || selectedTask;
                                                                    handlePostLog(finalId);
                                                                    setSelectedWorkType("TASK_SELECT"); // 화면을 처음 메뉴 선택화면으로
                                                                }}
                                                            />
                                                        )}

                                                        {/*이체*/}
                                                        {selectedWorkType === "TRANSFER" && (
                                                            <Transfer
                                                                taskId={selectedTask?.id}
                                                                selectedTask={selectedTask}
                                                                onSuccess={() => {
                                                                    const finalId = selectedTask?.id || selectedTask?.taskId || selectedTask;
                                                                    handlePostLog(finalId);
                                                                    setSelectedWorkType("TASK_SELECT");

                                                                }}
                                                            />
                                                        )}

                                                        {/*카드수령*/}
                                                        {selectedWorkType === "CARD" && (
                                                            <Card
                                                                selectedTask={selectedTask}
                                                                onSuccess={() => {
                                                                    const finalId = selectedTask?.id || selectedTask?.taskId || selectedTask;
                                                                    handlePostLog(finalId);
                                                                    setSelectedWorkType("TASK_SELECT"); // 화면을 처음 메뉴 선택화면으로

                                                                }}
                                                            />
                                                        )}

                                                        {/*통장비번변경*/}
                                                        {selectedWorkType === "CHANGE-PASSWORD" && (
                                                            <ChangePassword
                                                                onComplete={() => {
                                                                    const finalId = selectedTask?.id || selectedTask?.taskId || selectedTask;
                                                                    handlePostLog(finalId);
                                                                    setSelectedWorkType("TASK_SELECT"); // 화면을 처음 메뉴 선택화면으로

                                                                }}
                                                                selectedTask={selectedTask}
                                                            />
                                                        )}

                                                        {/*상담업무 / 예적금계좌개설*/}
                                                        {selectedWorkType === "ACCOUNTS" && (
                                                            <Accounts
                                                                selectedTask={selectedTask}
                                                                onCreate={() => {
                                                                    const finalId = selectedTask?.id || selectedTask?.taskId || selectedTask;
                                                                    handlePostLog(finalId);
                                                                    setSelectedWorkType("TASK_SELECT"); // 화면을 처음 메뉴 선택화면으로

                                                                }}
                                                            />
                                                        )}

                                                        {/*대출상환*/}
                                                        {selectedWorkType === "LOAN-PAYMENT" && (
                                                            <LoanPayment
                                                                selectedTask={selectedTask}
                                                                onCreate={() => {
                                                                    const finalId = selectedTask?.id || selectedTask?.taskId || selectedTask;
                                                                    handlePostLog(finalId);
                                                                    setSelectedWorkType("TASK_SELECT"); // 화면을 처음 메뉴 선택화면으로

                                                                }}
                                                            />
                                                        )}

                                                        {/*금융상품가입*/}
                                                        {selectedWorkType === "FINANCIAL-PRODUCT" && (
                                                            <FinancialProduct
                                                                selectedTask={selectedTask}
                                                                onSubmit={() => {
                                                                    const finalId = selectedTask?.id || selectedTask?.taskId || selectedTask;
                                                                    handlePostLog(finalId);
                                                                    setSelectedWorkType("TASK_SELECT"); // 화면을 처음 메뉴 선택화면으로

                                                                }}
                                                            />
                                                        )}

                                                        {/*기업대출*/}
                                                        {selectedWorkType === "CORPORATE-LOAN" && (
                                                            <CorporateLoan
                                                                selectedTask={selectedTask}
                                                                onReturnToTaskSelect={() => setSelectedWorkType("TASK_SELECT")}
                                                                onComplete={() => {
                                                                    const finalId = selectedTask?.id || selectedTask?.taskId || selectedTask;
                                                                    handlePostLog(finalId);
                                                                    setSelectedWorkType("TASK_SELECT");
                                                                }}
                                                            />
                                                        )}

                                                        {/*법인계좌개설*/}
                                                        {selectedWorkType === "CORPORATE-ACCOUNT" && (
                                                            <CorporateAccount
                                                                selectedTask={selectedTask}
                                                                onComplete={() => {
                                                                    const finalId = selectedTask?.id || selectedTask?.taskId || selectedTask;
                                                                    handlePostLog(finalId);
                                                                    setSelectedWorkType("TASK_SELECT");
                                                                }}
                                                            />
                                                        )}
                                                        {/*법인카드*/}
                                                        {selectedWorkType === "CORPORATE-CARD" && (
                                                            <CorporateCard
                                                                selectedTask={selectedTask}
                                                                onReturnToTaskSelect={() => setSelectedWorkType("TASK_SELECT")}
                                                                onSuccess={() => {
                                                                    const finalId = selectedTask?.id || selectedTask?.taskId || selectedTask;
                                                                    handlePostLog(finalId);
                                                                    setSelectedWorkType("TASK_SELECT");
                                                                }}
                                                            />
                                                        )}
                                                        {/*부도관리*/}
                                                        {selectedWorkType === "BANKRUPT-MANAGEMENT" && (
                                                            <CorporateBankrupt
                                                                selectedTask={selectedTask}
                                                                onReturnToTaskSelect={() => setSelectedWorkType("TASK_SELECT")}
                                                                onComplete={() => {
                                                                    const finalId = selectedTask?.id || selectedTask?.taskId || selectedTask;
                                                                    handlePostLog(finalId);
                                                                    setSelectedWorkType("TASK_SELECT");
                                                                }}
                                                            />
                                                        )}
                                                        {/*연체관리*/}
                                                        {selectedWorkType === "CORPORATE-ARREARS" && (
                                                            <CorporateArrears
                                                                selectedTask={selectedTask}
                                                                onReturnToTaskSelect={() => setSelectedWorkType("TASK_SELECT")}
                                                                onComplete={() => {
                                                                    const finalId = selectedTask?.id || selectedTask?.taskId || selectedTask;
                                                                    handlePostLog(finalId);
                                                                    setSelectedWorkType("TASK_SELECT");                                                                }}
                                                            />
                                                        )}

                                                        {selectedTask.status !== 'WAITING' && (
                                                            <>
                                                                <div className={styles.backCard}>
                                                                    <button
                                                                        className={styles.backButton}
                                                                        onClick={() => {
                                                                            setSelectedWorkType("TASK_SELECT");
                                                                        }}
                                                                    >
                                                                        ← 이전으로
                                                                    </button>
                                                                </div>
                                                                <div className={styles.taskLog}>
                                                                    <textarea placeholder="업무기록을 작성해주세요" className={styles.textArea}
                                                                    value={note}
                                                                    onChange={(e) => setNote(e.target.value)} />
                                                                </div>
                                                            </>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <aside className={styles.rightSidebar}>
                                      <div className={styles.infoBox}>
                                        <h4 className={styles.infoTitle}>고객 특이사항</h4>
                                        {/* 💡 실 데이터 연동 */}
                                        <div className={styles.logList}>
                                            {(() => {
                                                return null;
                                            })()}
                                            {!selectedTask?.userId ? (
                                                <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
                                                    배정된 업무가 없습니다
                                                </div>
                                            ) : isLogLoading ? (
                                                <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
                                                    불러오는 중...
                                                </div>
                                            ) : logError ? (
                                                <div style={{ padding: '20px', textAlign: 'center', color: '#e74c3c' }}>
                                                    {logError}
                                                    <br/>
                                                    <button
                                                        onClick={() => loadUserLogs(selectedTask.userId)}
                                                        style={{ marginTop: '10px', padding: '5px 10px', cursor: 'pointer' }}
                                                    >
                                                        재시도
                                                    </button>
                                                </div>
                                            ) : logList.length === 0 ? (
                                                <div className={styles.none}>
                                                    업무 이력이 없습니다.
                                                </div>
                                            ) : (
                                                logList.map((log, index) => {
                                                    return (
                                                        <div key={log.logId || index} className={styles.logItem}>
                                                                 <span className={styles.logDate}>
                                                                         {/* 자바의 createdAt과 매칭 */}
                                                                      {log.createdAt ? new Date(log.createdAt).toLocaleDateString() : '날짜 없음'}
                                                                 </span>
                                                            <p className={styles.logContent}>{log.processingNote || '내용 없음'}</p>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>

                                        <div className={styles.aiInsightBox}>
                                            <h4 className={styles.aiInsightTitle}>AI 상담 참고 요인</h4>
                                            {!selectedTask?.userId ? (
                                                <div className={styles.aiInsightEmpty}>선택된 고객이 없습니다</div>
                                            ) : isAiInsightLoading ? (
                                                <div className={styles.aiInsightEmpty}>분석 중...</div>
                                            ) : aiInsightError ? (
                                                <div className={styles.aiInsightEmpty}>{aiInsightError}</div>
                                            ) : !aiInsight?.reasons?.length ? (
                                                <div className={styles.aiInsightEmpty}>참고 요인이 없습니다</div>
                                            ) : (
                                                <>
                                                    <div className={styles.aiPredictionRow}>
                                                        <span>모델 예측</span>
                                                        <strong>{aiInsight.predictedTaskDetailType}</strong>
                                                    </div>
                                                    <div className={styles.aiReasonList}>
                                                        {aiInsight.reasons.slice(0, 3).map((reason, index) => (
                                                            <button
                                                                type="button"
                                                                key={reason.feature}
                                                                className={`${styles.aiReasonItem} ${index === 0 ? styles.aiReasonPrimary : ''}`}
                                                                onClick={() => handleAiReasonClick(reason, index)}
                                                            >
                                                                <span className={styles.aiReasonRank}>{index + 1}</span>
                                                                <div className={styles.aiReasonText}>
                                                                    <strong>{reason.label}</strong>
                                                                    <em>{reason.value}</em>
                                                                </div>
                                                                <span className={styles.aiReasonOpen}>상세</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        {/*  AI 추천 상품/서비스 영역 */}
                                        <div className={styles.rightSidebar_infoBox_recommend}>
                                            <h4 className={styles.rightSidebar_infoBox_recommend_title}>AI 추천 상품/서비스</h4>
                                            <div className={styles.recommendList}>
                                                {isRecommendLoading ? (
                                                    <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
                                                        추천 상품을 불러오는 중...
                                                    </div>
                                                ) : recommendProducts.length === 0 ? (
                                                    <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
                                                        추천 금융상품이 없습니다
                                                    </div>
                                                ) : (
                                                    [0, 1, 2].map((index) => {
                                                        const product = recommendProducts[index];
                                                        if (product) {
                                                            return (
                                                                <div
                                                                    key={product.productId}
                                                                    className={styles.recommendItem}
                                                                    onClick={() => handleProductClick({
                                                                        id: product.productId,
                                                                        name: product.productName,
                                                                        description: product.description,
                                                                        detail: product.description,
                                                                        baseInterestRate: product.baseInterestRate,
                                                                        maxInterestRate: product.maxInterestRate,
                                                                        minAmount: product.minAmount,
                                                                        targetType: product.targetType,
                                                                        minDurationMonths : product.minDurationMonths,
                                                                        maxDurationMonths: product.maxDurationMonths,
                                                                        maxAmount: product.maxAmount,
                                                                        productCategory: product.productCategory,
                                                                    })}
                                                                >
                                                                    <span className={styles.recommendIcon}>{index + 1}</span>
                                                                    {product.productName}
                                                                </div>
                                                            );
                                                        } else {
                                                            return (
                                                                <div
                                                                    key={`empty-${index}`}
                                                                    className={styles.recommendItem}
                                                                    style={{ cursor: 'default' }}
                                                                >
                                                                    <span className={styles.recommendIcon}>{index + 1}</span>
                                                                    준비중입니다
                                                                </div>
                                                            );
                                                        }
                                                    })
                                                )}
                                            </div>
                                        </div>

                                        <h4>연령대 분석</h4>
                                        <div className={styles.ageGrid}>
                                            {['10대', '20대', '30대', '40대', '50대', '60대'].map((ageGroup) => (
                                                <div
                                                    key={ageGroup}
                                                    className={`${styles.ageItem} ${determineAgeGroup(selectedTask.age) === ageGroup ? styles.ageActive : ''}`}
                                                >
                                                    {ageGroup}
                                                </div>
                                            ))}
                                        </div>
                                        <div className={styles.ageDescription}>
                                            <strong>{determineAgeGroup(selectedTask.age) || '연령 미상'}+ 고객 주요 관심사</strong><br />
                                            : 노후자산관리, 역모기지, 시니어 우대상품
                                        </div>
                                    </aside>
                                </div>
                            )}
                        </main>
                    </div>
                </div>

                <div className={styles.zoomSidebar}>
                    <div className={styles.zoomTrack}>
                        <div className={styles.zoomHandle}>
                            <div className={styles.zoomPlus}>+</div>
                            <div className={styles.zoomText}>돋<br/>보<br/>기</div>
                        </div>
                    </div>
                </div>

            </div>

            {isChatOpen && (
                <ChatModal
                    messages={messages}
                    input={input}
                    setInput={setInput}
                    onSend={handleSend}
                    onClose={() => setIsChatOpen(false)}
                    chatEndRef={chatEndRef}
                />
            )}

            {isTossModalOpen && (
                <TossModal
                    task={taskToToss}
                    onClose={() => {
                        setIsTossModalOpen(false);
                        setTaskToToss(null);
                    }}
                />
            )}

            {/* 금융상품 가입 모달 추가 */}
            <ProductModal
                isOpen={isModalOpen}
                product={selectedProduct}
                onClose={() => setIsModalOpen(false)}
                selectedTask={selectedTask}
            />

            <CustomModal
                isOpen={!!selectedAiReason}
                onClose={() => setSelectedAiReason(null)}
                title="AI 상담 참고 요인"
                onConfirm={() => setSelectedAiReason(null)}
                confirmText="확인"
            >
                {selectedAiReason && (
                    <div className={styles.aiReasonModal}>
                        <div className={styles.aiReasonModalHeader}>
                            <span className={styles.aiReasonModalRank}>{selectedAiReason.rank}</span>
                            <div>
                                <span className={styles.aiReasonModalEyebrow}>상위 참고 요인</span>
                                <h3>{selectedAiReason.label}</h3>
                            </div>
                        </div>

                        <dl className={styles.aiReasonModalMeta}>
                            <div>
                                <dt>모델 예측</dt>
                                <dd>{aiInsight?.predictedTaskDetailType || '-'}</dd>
                            </div>
                            <div>
                                <dt>고객 값</dt>
                                <dd>{selectedAiReason.value || '-'}</dd>
                            </div>
                        </dl>

                        <div className={styles.aiReasonModalSection}>
                            <h4>상담 참고 해석</h4>
                            <p>{selectedAiReason.message}</p>
                        </div>

                        <p className={styles.aiReasonModalNotice}>
                            AI 분석 결과는 상담 참고 정보이며 최종 판단은 상담원이 수행합니다.
                        </p>
                    </div>
                )}
            </CustomModal>

            <CustomModal
                isOpen={modalConfig.isOpen}
                onClose={handleModalClose}
                title="안내"
                onConfirm={handleModalClose}
                confirmText="확인"
            >
                <div style={{ padding: '20px', textAlign: 'center', fontSize: '1.2rem', color: '#333', whiteSpace: 'pre-line', lineHeight: '1.5' }}>
                    {modalConfig.message}
                </div>
            </CustomModal>

            {/* 비밀번호 변경 모달 */}
            <CustomModal
                isOpen={isPasswordModalOpen}
                onClose={() => setIsPasswordModalOpen(false)}
                onConfirm={handleChangePassword}
                title="비밀번호 변경"
                confirmText="변경"
                cancelText="취소"
            >
                <div className={styles.passwordModalContainer}>
                    <div className={styles.passwordModalHeader}>
                        <h3>직원 비밀번호 재설정</h3>
                        <p>새로운 비밀번호를 입력해주세요.</p>
                    </div>
                    <div className={styles.passwordInputGroup}>
                        <label>새 비밀번호</label>
                        <div className={styles.passwordInputWrapper}>
                            <span className={styles.passwordIcon}>🔒</span>
                            <input
                                type="password"
                                placeholder="4자리 이상 입력"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className={`${styles.passwordInput} ${newPassword.length > 0 && newPassword.length < 4 ? styles.error : ''}`}
                            />
                        </div>
                        {newPassword.length > 0 && newPassword.length < 4 && (
                            <span className={styles.errorMessage}>비밀번호는 최소 4자 이상이어야 합니다.</span>
                        )}
                    </div>
                    <div className={styles.passwordInputGroup}>
                        <label>비밀번호 확인</label>
                        <div className={styles.passwordInputWrapper}>
                            <span className={styles.passwordIcon}>🔒</span>
                            <input
                                type="password"
                                placeholder="비밀번호 재입력"
                                value={confirmNewPassword}
                                onChange={(e) => setConfirmNewPassword(e.target.value)}
                                className={`${styles.passwordInput} ${confirmNewPassword.length > 0 && newPassword !== confirmNewPassword ? styles.error : ''}`}
                            />
                        </div>
                        {confirmNewPassword.length > 0 && newPassword !== confirmNewPassword && (
                            <span className={styles.errorMessage}>비밀번호가 일치하지 않습니다.</span>
                        )}
                    </div>
                </div>
            </CustomModal>
        </div>
    );
};

export default BankerWorkSpace;
