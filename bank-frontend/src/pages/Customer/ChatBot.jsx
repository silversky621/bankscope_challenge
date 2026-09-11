import React, { useState, useRef, useEffect } from 'react';
import styles from './ChatBot.module.css';
import chatbotImg from '../../images/Home/chatbot.png';

const ChatBot = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState([
        { sender: "banker", text: "안녕하세요! 무엇을 도와드릴까요?" }
    ]);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const chatEndRef = useRef(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isOpen]);

    useEffect(() => {
        fetch('/api/user/session')
            .then(res => res.json())
            .then(data => {
                if (data.result === 'SUCCESS' && data.type === 'user') {
                    setIsLoggedIn(true);
                }
            })
            .catch(() => {});
    }, []);

    const onSend = async () => {
        if (!input.trim() || isLoading || !isLoggedIn) return;

        const userMessage = input.trim();
        setMessages(prev => [...prev, { sender: "customer", text: userMessage }]);
        setInput("");
        setIsLoading(true);

        try {
            const response = await fetch('/py/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMessage }),
            });
            const data = await response.json();

            if (data.result === 'SUCCESS') {
                setMessages(prev => [...prev, { sender: "banker", text: data.content }]);
            } else {
                setMessages(prev => [...prev, { sender: "banker", text: "죄송합니다. 일시적인 오류가 발생했습니다." }]);
            }
        } catch {
            setMessages(prev => [...prev, { sender: "banker", text: "서버와 연결할 수 없습니다." }]);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleChat = () => setIsOpen(!isOpen);

    return (
        <div className={styles.chatbotContainer}>
            {isOpen && (
                <div className={styles.chatWindow}>
                    <div className={styles.chatHeader}>
                        <span>💬 은행원 상담 채팅</span>
                        <button className={styles.chatCloseBtn} onClick={toggleChat}><span>✕</span></button>
                    </div>

                    {isLoggedIn ? (
                        <>
                            <div className={styles.chatBody}>
                                {messages.map((msg, index) => (
                                    <div
                                        key={index}
                                        className={
                                            msg.sender === "customer"
                                                ? styles.customerMsg
                                                : styles.bankerMsg
                                        }
                                    >
                                        {msg.text}
                                    </div>
                                ))}
                                {isLoading && (
                                    <div className={styles.bankerMsg}>답변을 생성 중입니다...</div>
                                )}
                                <div ref={chatEndRef}></div>
                            </div>

                            <div className={styles.chatInput}>
                                <input
                                    value={input}
                                    placeholder="메시지를 입력하세요..."
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                                            e.preventDefault();
                                            onSend();
                                        }
                                    }}
                                />
                                <button className={styles.sendBtn} onClick={onSend}><span>➤</span></button>
                            </div>
                        </>
                    ) : (
                        <div className={styles.loginRequired}>
                            <p>챗봇 서비스는 로그인 후 이용 가능합니다.</p>
                        </div>
                    )}
                </div>
            )}

            <button className={styles.floatingButton} onClick={toggleChat}>
                <img src={chatbotImg} alt="챗봇 버튼" />
            </button>
        </div>
    );
};

export default ChatBot;