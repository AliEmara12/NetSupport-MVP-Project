import React, { useState, useEffect, useRef } from 'react';
import { TutorService } from '../services/api';
import signalRService from '../services/signalr';

const TutorDashboard = () => {
    const examStateRef = useRef({ isStarted: false, id: null, duration: 30, endTime: null });

    const [students, setStudents] = useState([]);
    
    const [hours, setHours] = useState(0);
    const [minutes, setMinutes] = useState(30);
    const [seconds, setSeconds] = useState(0);
    
    const [examId, setExamId] = useState(null);
    const [csvFile, setCsvFile] = useState(null);
    const [examStarted, setExamStarted] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [liveScores, setLiveScores] = useState({});
    const [timeLeft, setTimeLeft] = useState(null);

    const [inputMode, setInputMode] = useState('csv');
    const [manualQuestions, setManualQuestions] = useState([]);
    const [newQuestion, setNewQuestion] = useState({ text: '', correct: '', w1: '', w2: '', w3: '' });

    useEffect(() => {
        const savedSession = sessionStorage.getItem('tutorSession');
        if (savedSession) {
            const parsed = JSON.parse(savedSession);
            setExamId(parsed.examId);
            setExamStarted(parsed.examStarted);
            setLiveScores(parsed.liveScores || {});
            if (parsed.examStateRef) {
                examStateRef.current = parsed.examStateRef;
            }
        }
    }, []);

    useEffect(() => {
        if (examId || examStarted) {
            sessionStorage.setItem('tutorSession', JSON.stringify({
                examId, examStarted, liveScores, examStateRef: examStateRef.current
            }));
        }
    }, [examId, examStarted, liveScores]);

    useEffect(() => {
        const fetchStudents = async () => {
            try {
                const response = await TutorService.getStudents();
                const actualStudents = response.data.filter(s => s.id !== 0 && s.name !== 'Tutor');
                setStudents(actualStudents);
            } catch (error) {
                console.error(error);
            }
        };

        fetchStudents();
        signalRService.startConnection(0, 'Tutor', 'eval');

        const handleStudentConnected = (data) => {
            if (data.studentId === 0 || data.studentName === 'Tutor') return;
            
            setStudents(prev => {
                const exists = prev.find(s => s.id === data.studentId);
                if (!exists) return [...prev, { id: data.studentId, name: data.studentName, status: 1 }];
                return prev.map(s => s.id === data.studentId ? { ...s, status: 1 } : s);
            });

            const exam = examStateRef.current;
            if (exam.isStarted && exam.id && exam.endTime) {
                if (exam.endTime > Date.now()) {
                    signalRService.connection.invoke('SyncLateStudent', data.studentId, exam.id, exam.endTime)
                        .catch(console.error);
                }
            }
        };

        const handleStudentDisconnected = (data) => {
            setStudents(prev => prev.filter(s => s.id !== data.studentId));
        };

        const handleLiveUpdate = (studentId, currentScore) => {
            setLiveScores(prev => ({ ...prev, [studentId]: currentScore }));
        };

        signalRService.on('StudentConnected', handleStudentConnected);
        signalRService.on('StudentDisconnected', handleStudentDisconnected);
        signalRService.on('ReceiveLiveUpdate', handleLiveUpdate);

        return () => {
            signalRService.off('StudentConnected', handleStudentConnected);
            signalRService.off('StudentDisconnected', handleStudentDisconnected);
            signalRService.off('ReceiveLiveUpdate', handleLiveUpdate);
        };
    }, []);

    useEffect(() => {
        if (!examStarted || !examStateRef.current.endTime) return;

        const timerId = setInterval(() => {
            const remaining = Math.max(0, Math.floor((examStateRef.current.endTime - Date.now()) / 1000));
            setTimeLeft(remaining);

            if (remaining === 0) {
                clearInterval(timerId);
                handleStopExam();
            }
        }, 1000);

        return () => clearInterval(timerId);
    }, [examStarted]);

    const formatTime = (totalSeconds) => {
        if (totalSeconds === null) return "00:00:00";
        const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
        const s = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    };

    const updateStatus = async (studentId, statusEnum) => {
        try {
            await TutorService.updateStatus(studentId, statusEnum);
            setStudents(prev => prev.map(s => s.id === studentId ? { ...s, status: statusEnum } : s));
        } catch (error) {
            console.error(error);
        }
    };

    const handleLockAll = async () => {
        for (const student of students) {
            if (student.status !== 0) await updateStatus(student.id, 0);
        }
    };

    const handleUnlockAll = async () => {
        for (const student of students) {
            if (student.status !== 1) await updateStatus(student.id, 1);
        }
    };

    const handleTimeChange = (setter, maxLimit = null) => (e) => {
        let val = parseInt(e.target.value) || 0;
        val = Math.max(0, val);
        if (maxLimit !== null) val = Math.min(val, maxLimit);
        setter(val);
    };

    const handleCreateExam = async () => {
        const totalMinutes = hours * 60 + minutes + (seconds / 60);
        if (totalMinutes <= 0) {
            alert("Please set a valid duration.");
            return;
        }

        try {
            const response = await TutorService.createExam(totalMinutes);
            setExamId(response.data.examId);
        } catch (error) {
            console.error(error);
        }
    };

    const processUpload = async (fileToUpload) => {
        setIsUploading(true);
        const totalMinutes = hours * 60 + minutes + (seconds / 60);
        
        try {
            await TutorService.uploadQuestions(examId, fileToUpload, totalMinutes);
            
            const calculatedEndTime = Date.now() + (totalMinutes * 60000);
            
            examStateRef.current = { 
                isStarted: true, 
                id: examId, 
                duration: totalMinutes, 
                endTime: calculatedEndTime 
            };
            
            setExamStarted(true);
            setTimeLeft(Math.floor(totalMinutes * 60));

        } catch (error) {
            alert('Failed to upload questions.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleUploadCSV = () => {
        if (!examId || !csvFile) return;
        processUpload(csvFile);
    };

    const handleAddManualQuestion = () => {
        if (!newQuestion.text || !newQuestion.correct || !newQuestion.w1 || !newQuestion.w2 || !newQuestion.w3) {
            alert('Please fill all fields.');
            return;
        }
        setManualQuestions([...manualQuestions, newQuestion]);
        setNewQuestion({ text: '', correct: '', w1: '', w2: '', w3: '' });
    };

    const handleSubmitManualQuestions = () => {
        if (manualQuestions.length === 0) return;
        let csvContent = "Text,CorrectAnswer,WrongAnswer1,WrongAnswer2,WrongAnswer3\n";
        const escape = (str) => `"${str.replace(/"/g, '""')}"`;
        manualQuestions.forEach(q => {
            csvContent += `${escape(q.text)},${escape(q.correct)},${escape(q.w1)},${escape(q.w2)},${escape(q.w3)}\n`;
        });
        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
        processUpload(new File([blob], "manual.csv", { type: "text/csv" }));
    };

    const handleStopExam = async () => {
        if (!examId) return;
        try {
            if (signalRService.connection) {
                await signalRService.connection.invoke('ForceStopExam').catch(console.error);
            }

            const response = await TutorService.getExamReport(examId);
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `ExamReport_${examId}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            
            setExamStarted(false);
            setExamId(null);
            setLiveScores({});
            setManualQuestions([]);
            setTimeLeft(null);
            examStateRef.current = { isStarted: false, id: null, duration: 30, endTime: null };
            sessionStorage.removeItem('tutorSession');

        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 p-6">
            <header className="mb-8 bg-slate-800 text-white p-4 rounded-lg shadow-md flex justify-between items-center border-b-4 border-emerald-500">
                <div className="flex items-center space-x-4">
                    <h1 className="text-2xl font-bold tracking-wide">NetSupport MVP</h1>
                    {examStarted && (
                        <div className="bg-slate-700 px-4 py-1 rounded-full border border-slate-600 flex items-center space-x-2">
                            <span className="text-slate-400 text-sm">Timer:</span>
                            <span className={`font-mono text-xl ${timeLeft < 60 ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`}>
                                {formatTime(timeLeft)}
                            </span>
                        </div>
                    )}
                </div>
                <span className="bg-emerald-500 px-3 py-1 rounded-full text-sm font-semibold shadow-lg">● Tutor Online</span>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg shadow-md border border-slate-200">
                    <div className="flex justify-between items-center border-b pb-3 mb-4">
                        <h2 className="text-xl font-bold text-slate-700">Classroom Status</h2>
                        {students.length > 0 && (
                            <div className="flex space-x-2">
                                <button onClick={handleLockAll} className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded text-sm font-bold transition">Lock All</button>
                                <button onClick={handleUnlockAll} className="bg-emerald-100 hover:bg-emerald-200 text-emerald-700 px-3 py-1 rounded text-sm font-bold transition">Unlock All</button>
                            </div>
                        )}
                    </div>
                    
                    {students.length === 0 ? (
                        <div className="py-10 text-center text-slate-400 italic font-medium">No students connected yet...</div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {students.map(student => (
                                <div key={student.id} className={`p-4 rounded-lg border-2 transition-all shadow-sm ${student.status === 0 ? 'border-red-400 bg-red-50' : 'border-emerald-400 bg-emerald-50'}`}>
                                    <div className="flex justify-between items-center mb-4">
                                        {/* التعديل: إظهار ID الطالب للتمييز بين المتشابهين */}
                                        <h3 className="font-bold text-slate-800 truncate pr-2">
                                            {student.name} <span className="text-slate-400 text-xs ml-1">#{student.id}</span>
                                        </h3>
                                        <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full ${student.status === 0 ? 'bg-red-200 text-red-800' : 'bg-emerald-200 text-emerald-800'}`}>
                                            {student.status === 0 ? 'Locked' : 'Ready'}
                                        </span>
                                    </div>
                                    <div className="flex space-x-2">
                                        <button onClick={() => updateStatus(student.id, 0)} className={`flex-1 py-1.5 rounded text-xs font-bold transition ${student.status === 0 ? 'bg-red-300' : 'bg-red-500 hover:bg-red-600 text-white'}`} disabled={student.status === 0}>Lock</button>
                                        <button onClick={() => updateStatus(student.id, 1)} className={`flex-1 py-1.5 rounded text-xs font-bold transition ${student.status !== 0 ? 'bg-emerald-300' : 'bg-emerald-500 hover:bg-emerald-600 text-white'}`} disabled={student.status !== 0}>Unlock</button>
                                    </div>
                                    {examStarted && (
                                        <div className="mt-4 pt-3 border-t text-sm font-bold text-slate-700 flex justify-between items-center">
                                            <span className="text-xs text-slate-500 uppercase">Live Score:</span>
                                            <span className="bg-slate-800 text-white px-3 py-0.5 rounded-full text-xs shadow-inner">{liveScores[student.id] || 0}</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="bg-white p-6 rounded-lg shadow-md border border-slate-200 flex flex-col space-y-6">
                    <div className={examId ? 'opacity-50 pointer-events-none' : ''}>
                        <h2 className="text-lg font-bold mb-3 text-slate-700 border-b pb-1 flex items-center">
                            <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] mr-2 font-black shadow-sm">1</span>
                            Set Duration
                        </h2>
                        
                        <div className="flex space-x-2 mb-4">
                            <div className="flex-1">
                                <label className="block text-xs font-bold text-slate-500 mb-1">Hours</label>
                                <input type="number" min="0" value={hours} onChange={handleTimeChange(setHours)} className="w-full border-2 border-slate-200 rounded p-2 text-center font-bold focus:border-blue-500 focus:outline-none" />
                            </div>
                            <div className="flex flex-col justify-center font-bold text-slate-400 mt-4">:</div>
                            <div className="flex-1">
                                <label className="block text-xs font-bold text-slate-500 mb-1">Mins</label>
                                <input type="number" min="0" max="59" value={minutes} onChange={handleTimeChange(setMinutes, 59)} className="w-full border-2 border-slate-200 rounded p-2 text-center font-bold focus:border-blue-500 focus:outline-none" />
                            </div>
                            <div className="flex flex-col justify-center font-bold text-slate-400 mt-4">:</div>
                            <div className="flex-1">
                                <label className="block text-xs font-bold text-slate-500 mb-1">Secs</label>
                                <input type="number" min="0" max="59" value={seconds} onChange={handleTimeChange(setSeconds, 59)} className="w-full border-2 border-slate-200 rounded p-2 text-center font-bold focus:border-blue-500 focus:outline-none" />
                            </div>
                        </div>

                        <button onClick={handleCreateExam} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold shadow-md active:scale-95 transition-transform">Initialize ExamSession</button>
                    </div>

                    {examId && !examStarted && (
                        <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                            <h2 className="text-lg font-bold mb-3 text-slate-700 border-b pb-1 flex items-center">
                                <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] mr-2 font-black shadow-sm">2</span>
                                Finalize & Launch
                            </h2>
                            <div className="flex mb-4 bg-slate-100 rounded-lg p-1">
                                <button onClick={() => setInputMode('manual')} className={`flex-1 py-2 text-xs font-bold rounded-md transition ${inputMode === 'manual' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>Manual Entry</button>
                                <button onClick={() => setInputMode('csv')} className={`flex-1 py-2 text-xs font-bold rounded-md transition ${inputMode === 'csv' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>Bulk CSV</button>
                            </div>

                            {inputMode === 'csv' ? (
                                <div className="p-5 bg-slate-50 rounded-xl border-2 border-dashed border-blue-200 text-center">
                                    <input type="file" accept=".csv" onChange={(e) => setCsvFile(e.target.files[0])} className="text-[10px] mb-4 w-full cursor-pointer file:bg-blue-50 file:border-none file:px-3 file:py-1 file:rounded-full file:text-blue-700 file:font-bold" />
                                    <button onClick={handleUploadCSV} disabled={isUploading || !csvFile} className={`w-full py-3 rounded-lg font-black text-sm uppercase tracking-wider shadow-lg transition ${isUploading || !csvFile ? 'bg-slate-300' : 'bg-slate-800 hover:bg-black text-white'}`}>
                                        {isUploading ? 'Syncing...' : 'Launch Exam'}
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-inner">
                                    <input type="text" dir="auto" placeholder="Question Title" value={newQuestion.text} onChange={e => setNewQuestion({...newQuestion, text: e.target.value})} className="w-full border rounded-lg p-2 text-sm shadow-sm" />
                                    <input type="text" dir="auto" placeholder="Correct Solution" value={newQuestion.correct} onChange={e => setNewQuestion({...newQuestion, correct: e.target.value})} className="w-full border border-emerald-300 rounded-lg p-2 text-sm bg-emerald-50 text-emerald-800 font-medium" />
                                    <div className="grid grid-cols-1 gap-1.5">
                                        <input type="text" dir="auto" placeholder="Distractor 1" value={newQuestion.w1} onChange={e => setNewQuestion({...newQuestion, w1: e.target.value})} className="w-full border rounded-lg p-2 text-xs" />
                                        <input type="text" dir="auto" placeholder="Distractor 2" value={newQuestion.w2} onChange={e => setNewQuestion({...newQuestion, w2: e.target.value})} className="w-full border rounded-lg p-2 text-xs" />
                                        <input type="text" dir="auto" placeholder="Distractor 3" value={newQuestion.w3} onChange={e => setNewQuestion({...newQuestion, w3: e.target.value})} className="w-full border rounded-lg p-2 text-xs" />
                                    </div>
                                    <button onClick={handleAddManualQuestion} className="w-full bg-emerald-600 text-white py-2 rounded-lg font-bold text-xs shadow-md">Queue Question ({manualQuestions.length})</button>
                                    {manualQuestions.length > 0 && (
                                        <button onClick={handleSubmitManualQuestions} disabled={isUploading} className="w-full bg-slate-800 text-white py-3 rounded-lg font-black text-xs uppercase mt-4 shadow-xl">Launch Final Build</button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {examStarted && (
                        <div className="mt-auto space-y-4 animate-in slide-in-from-bottom-4 duration-500">
                            <div className={`p-4 rounded-xl border-2 text-center transition-colors ${timeLeft < 60 ? 'bg-red-50 border-red-200 text-red-600' : 'bg-blue-50 border-blue-100 text-blue-600'}`}>
                                <p className="text-[10px] uppercase font-black mb-1">Time Remaining</p>
                                <p className="text-3xl font-black font-mono">{formatTime(timeLeft)}</p>
                            </div>
                            <button onClick={handleStopExam} className="w-full bg-red-600 text-white py-4 rounded-2xl font-black shadow-xl hover:bg-red-700 hover:-translate-y-1 transition active:translate-y-0">
                                FORCE STOP & REPORT
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TutorDashboard;