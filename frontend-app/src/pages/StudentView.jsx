import React, { useState } from 'react';
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

    const handleLeave = () => {
        sessionStorage.removeItem('studentSession');
        window.location.reload();
    };

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

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
            <p className="text-slate-600 font-bold text-lg">
                Connected as {student.name}{' '}
                <span className="text-blue-500 text-sm">#{student.id}</span>
            </p>
            <button onClick={handleLeave} className="mt-4 bg-slate-800 text-white px-6 py-2 rounded-lg">
                Leave
            </button>
        </div>
    );
};

export default StudentView;