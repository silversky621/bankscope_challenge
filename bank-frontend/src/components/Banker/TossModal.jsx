import { useEffect, useRef, useState } from 'react';
import styles from './TossModal.module.css';

const ERROR_MESSAGES = {
    FAILURE_SESSION: '로그인 정보가 만료되었습니다. 다시 로그인해주세요.',
    FAILURE_NOT_ALLOWED: '현재 담당한 업무만 처리할 수 있습니다. 대기열을 새로 확인해주세요.',
    FAILURE_INVALID_STATUS: '업무 상태가 변경되었습니다. 대기열을 새로 확인해주세요.',
    FAILURE_INVALID_TASK_TYPE: '실제 업무를 선택해주세요.',
    FAILURE_TARGET_UNAVAILABLE: '해당 직원이 현재 업무를 처리할 수 없습니다. 근무 상태와 업무 권한을 확인해주세요.',
};

export default function TossModal({ task, onClose, onSuccess, mode = 'transfer' }) {
    const isTransfer = mode === 'transfer';
    const taskId = task.taskId;
    const [taskTypes, setTaskTypes] = useState([]);
    const [typeError, setTypeError] = useState('');
    const [actualDetail, setActualDetail] = useState(task.confirmedTaskDetailType || task.taskDetailType || '');
    const [staffId, setStaffId] = useState('');
    const [reason, setReason] = useState('');
    const [candidates, setCandidates] = useState({ key: '', rows: [], error: '' });
    const [refresh, setRefresh] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const pending = useRef(false);
    const selectRef = useRef(null);
    const dialogRef = useRef(null);
    const requestKey = `${taskId}:${actualDetail}:${refresh}`;
    const isLoading = isTransfer && candidates.key !== requestKey;

    useEffect(() => {
        const controller = new AbortController();
        fetch('/api/kiosk/task-types', { signal: controller.signal })
            .then(async response => {
                if (!response.ok) throw new Error('업무 목록을 불러오지 못했습니다. 다시 열어주세요.');
                setTaskTypes(await response.json());
            })
            .catch(err => { if (err.name !== 'AbortError') setTypeError(err.message); });
        const previousFocus = document.activeElement;
        selectRef.current?.focus();
        return () => { controller.abort(); previousFocus?.focus(); };
    }, []);

    useEffect(() => {
        if (!isTransfer || !actualDetail) return;
        const controller = new AbortController();
        const query = new URLSearchParams({ taskId, actualTaskDetailType: actualDetail });
        fetch(`/api/kiosk/transfer-candidates?${query}`, { signal: controller.signal })
            .then(async response => {
                if (!response.ok) throw new Error('이관 가능한 직원을 불러오지 못했습니다. 업무 상태를 확인해주세요.');
                const rows = await response.json();
                setCandidates({ key: requestKey, rows, error: '' });
            })
            .catch(err => {
                if (err.name !== 'AbortError') setCandidates({ key: requestKey, rows: [], error: err.message });
            });
        return () => controller.abort();
    }, [isTransfer, actualDetail, taskId, requestKey]);

    const submit = async event => {
        event.preventDefault();
        if (pending.current) return;
        pending.current = true;
        setIsSubmitting(true);
        setError('');
        try {
            const query = new URLSearchParams({ status: 'COMPLETED', actualTaskDetailType: actualDetail });
            const response = await fetch(isTransfer ? '/api/kiosk/toss' : `/api/member/task/${taskId}/status?${query}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                ...(isTransfer ? { body: JSON.stringify({ taskId, targetMemberId: Number(staffId), actualTaskDetailType: actualDetail, reason: reason.trim() }) } : {}),
            });
            const data = await response.json();
            if (!response.ok || data.result !== 'SUCCESS') {
                if (data.result === 'FAILURE_TARGET_UNAVAILABLE' && isTransfer) {
                    setStaffId('');
                    setRefresh(value => value + 1);
                }
                throw new Error(ERROR_MESSAGES[data.result] || '처리하지 못했습니다. 업무 상태를 확인하고 다시 시도해주세요.');
            }
            await onSuccess?.(taskId, isTransfer ? '이관되었습니다.' : '종료되었습니다.');
            onClose();
        } catch (err) {
            setError(err.message || '서버에 연결할 수 없습니다. 다시 시도해주세요.');
        } finally {
            pending.current = false;
            setIsSubmitting(false);
        }
    };

    const handleDialogKeyDown = event => {
        if (event.key === 'Escape' && !isSubmitting) onClose();
        if (event.key !== 'Tab') return;
        const elements = dialogRef.current.querySelectorAll('button:not(:disabled), select:not(:disabled), textarea:not(:disabled)');
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };

    const ready = taskTypes.some(type => type.detailType === actualDetail)
        && (!isTransfer || (!isLoading && candidates.rows.some(staff => String(staff.id) === staffId) && reason.trim()));

    return (
        <div className={styles.modalOverlay}>
            <form ref={dialogRef} className={styles.modalContainer} role="dialog" aria-modal="true" aria-labelledby="task-outcome-title"
                onKeyDown={handleDialogKeyDown} onSubmit={submit}>
                <header className={styles.header}><h1 id="task-outcome-title">{isTransfer ? '업무 이관' : '업무 종료 확인'}</h1></header>
                <div className={styles.content}>
                    <div className={styles.customerCard}>
                        <strong>{task.userName || '고객'} · {task.ticketNumber}</strong>
                        <p>현재 접수 업무: {task.taskDetailType}</p>
                        {task.predictedTaskDetailType && <p>최초 AI 예상 업무: {task.predictedTaskDetailType}</p>}
                    </div>
                    <div className={styles.section}>
                        <label className={styles.label} htmlFor="actual-task">{isTransfer ? '확인된 실제 업무' : '실제로 처리한 업무'}</label>
                        <select ref={selectRef} id="actual-task" value={actualDetail} disabled={isSubmitting || !taskTypes.length} required
                            onChange={event => { setActualDetail(event.target.value); setStaffId(''); setError(''); }}>
                            <option value="">업무를 선택해주세요</option>
                            {taskTypes.map(type => <option key={type.detailType} value={type.detailType}>{type.detailType}</option>)}
                        </select>
                    </div>
                    {isTransfer ? <>
                        <div className={styles.section}>
                            <label className={styles.label} htmlFor="target-staff">이관받을 직원</label>
                            <select id="target-staff" value={staffId} onChange={event => setStaffId(event.target.value)}
                                required disabled={isSubmitting || isLoading || !candidates.rows.length}>
                                <option value="">{isLoading ? '직원 조회 중…' : '직원을 선택해주세요'}</option>
                                {!isLoading && candidates.rows.map(staff => <option key={staff.id} value={staff.id}>
                                    {staff.counterNumber}번 창구 · {staff.name} · 대기 {staff.waitingCount}건
                                </option>)}
                            </select>
                            {!isLoading && !candidates.error && candidates.rows.length === 0 && <p className={styles.help}>현재 이 업무를 처리할 수 있는 다른 직원이 없습니다. 관리자에게 문의해주세요.</p>}
                            {candidates.error && <><p role="alert" className={styles.error}>{candidates.error}</p><button type="button" onClick={() => { setStaffId(''); setRefresh(value => value + 1); }}>다시 조회</button></>}
                        </div>
                        <div className={styles.section}>
                            <label className={styles.label} htmlFor="transfer-reason">이관 사유 및 전달 사항</label>
                            <textarea id="transfer-reason" value={reason} onChange={event => setReason(event.target.value)}
                                maxLength={1000} required rows={3} disabled={isSubmitting} placeholder="방문 목적과 다음 담당자가 알아야 할 내용을 적어주세요." />
                        </div>
                        <p className={styles.help}>기존 번호표와 최초 접수 시간을 유지하며, 이관된 창구의 대기열로 이동합니다.</p>
                    </> : <p className={styles.help}>고객과 확인한 실제 업무를 선택한 뒤 종료해주세요. 추가 상담이나 이관이 필요하면 닫기를 눌러 계속 진행하세요.</p>}
                    {(error || typeError) && <p role="alert" className={styles.error}>{error || typeError}</p>}
                </div>
                <footer className={styles.footer}>
                    <button type="button" className={styles.btnClose} onClick={onClose} disabled={isSubmitting}>닫기</button>
                    <button type="submit" className={styles.btnSubmit} disabled={isSubmitting || !ready}>
                        {isSubmitting ? '처리 중…' : isTransfer ? '업무 이관' : '확인하고 종료'}
                    </button>
                </footer>
            </form>
        </div>
    );
}