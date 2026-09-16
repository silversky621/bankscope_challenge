import { useEffect, useRef, useState } from 'react';
import styles from './QueueDisplay.module.css';

const COUNTER_NUMBERS = [1, 2, 3, 4, 5];
const STATUS_LABELS = { CALLED: '호출 중', IN_PROGRESS: '상담 중', WAITING: '호출 대기', OFFLINE: '미운영' };

export default function QueueDisplay() {
    const [counters, setCounters] = useState([]);
    const [connected, setConnected] = useState(false);
    const [soundEnabled, setSoundEnabled] = useState(false);
    const [soundError, setSoundError] = useState('');
    const audio = useRef(null);

    useEffect(() => {
        let stopped = false;
        let timer;
        let initialized = false;
        const seen = new Set();
        let nextSoundAt = 0;

        const chime = () => {
            const context = audio.current;
            if (!context || context.state !== 'running') return;
            const start = Math.max(context.currentTime, nextSoundAt);
            [880, 660].forEach((frequency, index) => {
                const oscillator = context.createOscillator();
                const gain = context.createGain();
                const at = start + index * 0.22;
                oscillator.frequency.value = frequency;
                gain.gain.setValueAtTime(0, at);
                gain.gain.linearRampToValueAtTime(0.18, at + 0.015);
                gain.gain.exponentialRampToValueAtTime(0.001, at + 0.4);
                oscillator.connect(gain);
                gain.connect(context.destination);
                oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
                oscillator.start(at);
                oscillator.stop(at + 0.42);
            });
            nextSoundAt = start + 0.8;
        };

        const poll = async () => {
            try {
                const response = await fetch('/api/queue/display', {
                    cache: 'no-store', signal: AbortSignal.timeout(5000),
                });
                if (!response.ok) throw new Error('Display unavailable');
                const rows = await response.json();
                if (!Array.isArray(rows)) throw new Error('Invalid display response');
                if (stopped) return;
                // Initial load shows the current board without replaying past calls.
                [...rows].sort((a, b) => Number(a.callId) - Number(b.callId)).forEach(row => {
                    if (!row.callId) return;
                    const id = String(row.callId);
                    if (initialized && !seen.has(id) && row.status === 'CALLED') chime();
                    seen.add(id);
                });
                initialized = true;
                setCounters(rows);
                setConnected(true);
            } catch {
                if (!stopped) setConnected(false);
            } finally {
                if (!stopped) timer = setTimeout(poll, 1000);
            }
        };
        poll();
        return () => {
            stopped = true;
            clearTimeout(timer);
            if (audio.current) {
                audio.current.onstatechange = null;
                audio.current.close();
            }
            audio.current = null;
        };
    }, []);

    const enableSound = async () => {
        try {
            if (!audio.current) {
                audio.current = new window.AudioContext();
                audio.current.onstatechange = () => setSoundEnabled(audio.current?.state === 'running');
            }
            await audio.current.resume();
            if (audio.current.state !== 'running') throw new Error('Audio unavailable');
            setSoundEnabled(true);
            setSoundError('');
        } catch {
            setSoundError('소리를 켜지 못했습니다. 다시 눌러주세요.');
        }
    };

    return (
        <div className={styles.display}>
            <header className={styles.header}>
                <strong>BankScope</strong>
                <span>고객 호출 안내</span>
                <button type="button" onClick={enableSound} disabled={soundEnabled}>
                    {soundEnabled ? '호출음 켜짐' : '호출음 켜기'}
                </button>
            </header>
            {soundError && <p role="alert" className={styles.notice}>{soundError}</p>}
            {!connected && <p role="status" className={styles.notice}>호출 정보를 확인하고 있습니다. 연결이 계속되지 않으면 직원에게 문의해주세요.</p>}
            <div className={styles.grid} aria-live="polite">
                {COUNTER_NUMBERS.map(counterNumber => {
                    const counter = connected ? counters.find(row => Number(row.counterNumber) === counterNumber) : null;
                    const status = counter?.status;
                    const called = status === 'CALLED';
                    const serving = status === 'IN_PROGRESS';
                    const hasTicket = (called || serving) && counter.ticketNumber;
                    const message = called ? '이 창구로 천천히 와 주세요.'
                        : serving ? '고객 상담이 진행 중입니다.'
                        : status === 'WAITING' ? '차례가 되면 호출해 드립니다.'
                        : status === 'OFFLINE' ? '현재 운영하지 않는 창구입니다.' : '잠시만 기다려 주세요.';
                    return (
                        <section key={counterNumber} aria-labelledby={`counter-${counterNumber}`}
                            className={`${styles.card} ${called ? styles.calling : ''} ${status === 'OFFLINE' ? styles.offline : ''}`}>
                            {called && <span key={counter.callId} className={styles.callHighlight} aria-hidden="true" />}
                            <h2 id={`counter-${counterNumber}`} className={styles.counterTitle}>{counterNumber}<span>번 창구</span></h2>
                            <div className={styles.ticket}>
                                <span className={styles.ticketLabel}>접수번호</span>
                                <strong>{hasTicket ? counter.ticketNumber : '—'}{hasTicket && <small>번</small>}</strong>
                            </div>
                            <span className={styles.status}>{STATUS_LABELS[status] || '확인 중'}</span>
                            <p>{message}</p>
                        </section>
                    );
                })}
            </div>
            <footer className={styles.footer}>창구별로 호출 순서가 다를 수 있습니다. 접수번호와 창구번호를 함께 확인해주세요.</footer>
        </div>
    );
}
