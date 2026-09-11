/* eslint-disable react-hooks/set-state-in-effect */
import React, { useState, useEffect } from 'react';
import styles from './AdminModal.module.css';

const AdminModal = ({ isOpen, onClose, onSave, user }) => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        level: 1, // Integer: 1~5
        auth: '일반',
        team: '',
        counterNumber: 0, // 추가된 필드: 창구 번호
        status: 1 // Integer: 1(활성), 0(비활성)
    });

    useEffect(() => {
        if (user) {
            setFormData({
                name: user.name,
                email: user.email,
                password: '',
                level: user.level,
                auth: user.auth || '일반',
                team: user.team,
                counterNumber: user.counterNumber || 0,
                status: user.status
            });
        } else {
            setFormData({
                name: '',
                email: '',
                password: '',
                level: 1,
                auth: '일반',
                team: '',
                counterNumber: 0,
                status: 1
            });
        }
    }, [user, isOpen]);

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        
        if (name === 'level' || name === 'status' || name === 'counterNumber') {
             setFormData({
                ...formData,
                [name]: parseInt(value, 10)
            });
        } else {
            setFormData({
                ...formData,
                [name]: value
            });
        }
    };

    const handleSave = () => {
        onSave(formData);
    };

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContainer}>
                <header className={styles.modalHeader}>
                    <h2>{user ? '직원 정보 수정' : '직원 등록'}</h2>
                </header>

                <div className={styles.modalContent}>
                    <table className={styles.formTable}>
                        <tbody>
                        <tr>
                            <th>이름</th>
                            <td>
                                <input 
                                    type="text" 
                                    name="name"
                                    className={styles.fullInput} 
                                    value={formData.name}
                                    onChange={handleChange}
                                />
                            </td>
                        </tr>
                        <tr>
                            <th>이메일</th>
                            <td>
                                <input 
                                    type="email" 
                                    name="email"
                                    className={styles.fullInput} 
                                    value={formData.email}
                                    onChange={handleChange}
                                />
                            </td>
                        </tr>
                        <tr>
                            <th>비밀번호</th>
                            <td>
                                <input 
                                    type="password" 
                                    name="password"
                                    className={styles.fullInput} 
                                    value={formData.password}
                                    onChange={handleChange}
                                    placeholder={user ? "변경 시에만 입력하세요" : "비밀번호를 입력하세요"}
                                />
                            </td>
                        </tr>
                        <tr>
                            <th>직급 (Level)</th>
                            <td>
                                <select 
                                    name="level"
                                    className={styles.fullSelect} 
                                    value={formData.level}
                                    onChange={handleChange}
                                >
                                    <option value={1}>Lv.1 (신입/서포터)</option>
                                    <option value={2}>Lv.2 (일반 행원)</option>
                                    <option value={3}>Lv.3 (대리/과장)</option>
                                    <option value={4}>Lv.4 (차장/팀장)</option>
                                    <option value={5}>Lv.5 (지점장급)</option>
                                </select>
                            </td>
                        </tr>
                        <tr>
                            <th>권한 (Auth)</th>
                            <td>
                                <select 
                                    name="auth"
                                    className={styles.fullSelect} 
                                    value={formData.auth}
                                    onChange={handleChange}
                                >
                                    <option value="전체">전체</option>
                                    <option value="일반">일반</option>
                                </select>
                            </td>
                        </tr>
                        <tr>
                            <th>소속 (Team)</th>
                            <td>
                                <input 
                                    type="text" 
                                    name="team"
                                    className={styles.fullInput} 
                                    value={formData.team}
                                    onChange={handleChange}
                                />
                            </td>
                        </tr>
                        <tr>
                            <th>창구 번호</th>
                            <td>
                                <input 
                                    type="number" 
                                    name="counterNumber"
                                    className={styles.fullInput} 
                                    value={formData.counterNumber}
                                    onChange={handleChange}
                                    placeholder="0"
                                />
                            </td>
                        </tr>
                        <tr>
                            <th>상태</th>
                            <td className={styles.radioGroup}>
                                <label>
                                    <input 
                                        type="radio" 
                                        name="status" 
                                        value={1}
                                        checked={formData.status === 1}
                                        onChange={handleChange}
                                    /> 활성
                                </label>
                                <label>
                                    <input 
                                        type="radio" 
                                        name="status" 
                                        value={0}
                                        checked={formData.status === 0}
                                        onChange={handleChange}
                                    /> 비활성
                                </label>
                            </td>
                        </tr>
                        </tbody>
                    </table>
                </div>

                <footer className={styles.modalFooter}>
                    <button className={styles.saveBtn} onClick={handleSave}>
                        <span className={styles.icon}>✔</span> 저장
                    </button>
                    <button className={styles.cancelBtn} onClick={onClose}>
                        <span className={styles.icon}>✖</span> 취소
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default AdminModal;
