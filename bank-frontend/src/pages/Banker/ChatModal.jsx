import React from "react";
import styles from "./BankerWorkSpace.module.css";

const ChatModal = ({
  messages,
  input,
  setInput,
  onSend,
  onClose,
  chatEndRef
}) => {
  return (
    <div className={styles.chatModalOverlay}>
      <div className={styles.chatWindow}>

        <div className={styles.chatHeader}>
          <span>💬 고객 상담 채팅</span>
          <button className={styles.chatCloseBtn} onClick={onClose}>✕</button>
        </div>

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
          <div ref={chatEndRef}></div>
        </div>

        <div className={styles.chatInput}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                onSend();
              }
            }}
          />
          <button className={styles.sendBtn} onClick={onSend}>➤</button>
        </div>

      </div>
    </div>
  );
};

export default ChatModal;