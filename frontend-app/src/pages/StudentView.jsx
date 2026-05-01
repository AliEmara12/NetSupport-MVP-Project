import React, { useState, useEffect } from 'react';
import { StudentService } from '../services/api';
import signalRService from '../services/signalr';

const StudentView = () => {
    const [name, setName] = useState('');
    const [student, setStudent] = useState(null);
    const [isLocked, setIsLocked] = useState(false);
    const [examId, setExamId] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedAnswers, setSelectedAnswers] = useState({});
    const [loginError, setLoginError] = useState('');
    const [endTime, setEndTime] = useState(null);
    const [timeLeft, setTimeLeft] = useState(null);
    const [isFinished, setIsFinished] = useState(false);

    // Restore session on mount
    useEffect(() => {
        const savedSession = sessionStorage.getItem('studentSession');
        if (savedSession) {
            const parsed = JSON.parse(savedSession);
            setStudent(parsed.student);
            setExamId(parsed.examId);
            setQuestions(parsed.questions || []);
            setSelectedAnswers(parsed.selectedAnswers || {});
            setEndTime(parsed.endTime);
            setIsFinished(parsed.isFinished || false);
            setIsLocked(parsed.isLocked || false);

            if (parsed.student) {
                signalRService.startConnection(parsed.student.id, parsed.student.name, 'eval');
            }
        }
    }, []);

    // Persist session on every relevant state change
    useEffect(() => {
        if (student) {
            sessionStorage.setItem('studentSession', JSON.stringify({
                student, examId, questions, selectedAnswers, endTime, isFinished, isLocked
            }));
        }
    }, [student, examId, questions, selectedAnswers, endTime, isFinished, isLocked]);

    // SignalR: listen to real-time exam control events
    useEffect(() => {
        if (!student) return;

        const handleLockCommand = (locked) => setIsLocked(locked);

        const handleTestStarted = async (eId, durationInMinutes) => {
            setExamId(eId);
            const calculatedEndTime = Date.now() + (durationInMinutes * 60000);
            setEndTime(calculatedEndTime);
            setIsFinished(false);
            setSelectedAnswers({});
            setCurrentQuestionIndex(0);
            fetchQuestions(eId);
        };

        const handleSyncTime = async (eId, syncEndTime) => {
            setExamId(eId);
            setEndTime(syncEndTime);
            setIsFinished(false);
            setSelectedAnswers({});
            setCurrentQuestionIndex(0);
            fetchQuestions(eId);
        };

        const handleForceStop = () => {
            setIsFinished(true);
        };

        signalRService.on('ReceiveLockCommand', handleLockCommand);
        signalRService.on('TestStarted', handleTestStarted);
        signalRService.on('SyncExamTime', handleSyncTime);
        signalRService.on('ReceiveForceStop', handleForceStop);

        return () => {
            signalRService.off('ReceiveLockCommand', handleLockCommand);
            signalRService.off('TestStarted', handleTestStarted);
            signalRService.off('SyncExamTime', handleSyncTime);
            signalRService.off('ReceiveForceStop', handleForceStop);
        };
    }, [student]);

    // Fetch questions from API and shuffle answers
    const fetchQuestions = async (eId) => {
        try {
            const response = await StudentService.getExam(eId);
            const shuffledQuestions = response.data.map(q => ({
                ...q,
                answers: [...q.answers].sort(() => Math.random() - 0.5)
            }));
            setQuestions(shuffledQuestions);
        } catch (error) {
            console.error(error);
        }
    };

    // Countdown timer — auto-submits when time runs out
    useEffect(() => {
        if (!endTime || isFinished) return;

        const timerId = setInterval(() => {
            const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
            setTimeLeft(remaining);

            if (remaining === 0) {
                setIsFinished(true);
                clearInterval(timerId);
            }
        }, 1000);

        return () => clearInterval(timerId);
    }, [endTime, isFinished]);

    // Format seconds → MM:SS display
    const formatTime = (seconds) => {
        if (seconds === null) return "--:--";
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = Math.floor(seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setLoginError('');
        try {
            const response = await StudentService.login(name);
            setStudent(response.data);
            signalRService.startConnection(response.data.id, response.data.name, 'eval');
        } catch (error) {
            if (error.response && error.response.status === 409) {
                setLoginError(error.response.data.message);
            } else {
                setLoginError("Failed to connect to the classroom. Please try again.");
            }
        }
    };

    // ✅ Select answer and submit in real-time via SignalR
    const handleSelectAnswer = (answer) => {
        if (isFinished) return;
        const questionId = questions[currentQuestionIndex].id;
        setSelectedAnswers(prev => ({ ...prev, [questionId]: answer }));
        signalRService.submitAnswer(student.id, examId, questionId, answer);
    };

    const handleLeave = () => {
        sessionStorage.removeItem('studentSession');
        window.location.reload();
    };

    // ── Render states ────────────────────────────────────────────

    if (isLocked) {
        return (
            <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col items-center justify-center">
                <svg className="w-24 h-24 text-red-500 mb-6 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8V7z" />
                </svg>
                <h1 className="text-4xl font-bold text-white tracking-widest uppercase">Screen Locked</h1>
                <p className="text-slate-400 mt-4">Tutor has paused your session.</p>
            </div>
        );
    }

    if (!student) {
        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-md border-t-4 border-blue-600">
                    <h1 className="text-3xl font-black text-center text-slate-800 mb-6 tracking-tight">
                        NetSupport <span className="text-blue-600">MVP</span>
                    </h1>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full border-2 border-slate-200 rounded-lg p-3 text-lg font-medium focus:border-blue-500 focus:outline-none transition"
                            placeholder="Enter your full name"
                            required
                        />
                        {loginError && (
                            <p className="text-red-500 text-sm font-bold animate-bounce">{loginError}</p>
                        )}
                        <button
                            type="submit"
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-md transition transform active:scale-95 mt-2"
                        >
                            Join Classroom
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    if (isFinished) {
        return (
            <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
                <div className="bg-white p-10 rounded-2xl shadow-2xl text-center max-w-lg w-full border-t-8 border-emerald-500">
                    <div className="bg-emerald-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-12 h-12 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h2 className="text-3xl font-black text-slate-800 mb-2">Exam Submitted!</h2>
                    <p className="text-slate-500 text-lg font-medium mb-8">Your answers have been securely saved.</p>
                    <button onClick={handleLeave} className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 px-8 rounded-lg transition shadow-md">
                        Leave Classroom
                    </button>
                </div>
            </div>
        );
    }

    if (!examId || questions.length === 0) {
        return (
            <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
                <div className="bg-white p-10 rounded-xl shadow-lg text-center flex flex-col items-center">
                    <svg className="w-10 h-10 text-blue-500 animate-spin mb-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="text-slate-600 font-bold text-lg">
                        Connected as {student.name}{' '}
                        <span className="text-blue-500 text-sm">#{student.id}</span>
                    </p>
                    <p className="text-slate-400 mt-2">Waiting for the tutor to start the exam...</p>
                </div>
            </div>
        );
    }

    const currentQuestion = questions[currentQuestionIndex];

    return (
        <div className="min-h-screen bg-slate-100 p-4 md:p-8 select-none">
            <header className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm p-4 mb-6 flex justify-between items-center border-b-4 border-blue-500">
                <div>
                    <h1 className="text-xl font-bold text-slate-800">
                        {student.name}{' '}
                        <span className="text-sm text-slate-400 ml-1">#{student.id}</span>
                    </h1>
                </div>
                <div className={`text-2xl font-black px-4 py-1.5 rounded-lg border-2 ${timeLeft < 60 ? 'bg-red-50 border-red-200 text-red-600 animate-pulse' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                    ⏱ {formatTime(timeLeft)}
                </div>
                <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-lg font-bold">
                    Q {currentQuestionIndex + 1} / {questions.length}
                </div>
            </header>

            <main className="max-w-4xl mx-auto bg-white rounded-xl shadow-md overflow-hidden border border-slate-200">
                <div className="p-6 md:p-10 border-b border-slate-100 bg-white">
                    <h2 className="text-xl md:text-2xl font-bold text-slate-800 leading-relaxed" dir="auto">
                        {currentQuestion.text}
                    </h2>
                </div>
                <div className="p-6 md:p-10 bg-slate-50 space-y-4">
                    {currentQuestion.answers.map((answer, index) => (
                        <button
                            key={index}
                            onClick={() => handleSelectAnswer(answer)}
                            className={`w-full text-left p-4 rounded-xl border-2 transition-all text-lg font-medium shadow-sm ${
                                selectedAnswers[currentQuestion.id] === answer
                                    ? 'border-blue-500 bg-blue-50 text-blue-800 ring-2 ring-blue-200'
                                    : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50'
                            }`}
                            dir="auto"
                        >
                            <span className="inline-block w-8 h-8 text-center leading-8 rounded-full bg-slate-200 mr-3 text-sm font-bold text-slate-600">
                                {String.fromCharCode(65 + index)}
                            </span>
                            {answer}
                        </button>
                    ))}
                </div>
                <div className="p-6 bg-white border-t border-slate-100 flex justify-between">
                    <button
                        onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                        disabled={currentQuestionIndex === 0}
                        className={`px-8 py-3 rounded-lg font-bold transition ${
                            currentQuestionIndex === 0
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                : 'bg-slate-800 hover:bg-slate-900 text-white shadow-md'
                        }`}
                    >
                        Previous
                    </button>
                    <button
                        onClick={() => setCurrentQuestionIndex(prev => Math.min(questions.length - 1, prev + 1))}
                        disabled={currentQuestionIndex === questions.length - 1}
                        className={`px-8 py-3 rounded-lg font-bold transition ${
                            currentQuestionIndex === questions.length - 1
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md'
                        }`}
                    >
                        Next
                    </button>
                </div>
            </main>
        </div>
    );
};

export default StudentView;