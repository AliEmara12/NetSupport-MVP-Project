import React, { useState } from 'react';

const TutorDashboard = () => {
    const [students, setStudents] = useState([
        { id: 1, name: 'Alice', status: 1 },
        { id: 2, name: 'Bob', status: 1 },
    ]);

    const [hours, setHours] = useState(0);
    const [minutes, setMinutes] = useState(30);
    const [seconds, setSeconds] = useState(0);

    return (
        <div className="min-h-screen bg-slate-100 p-6">
            <header className="mb-8 bg-slate-800 text-white p-4 rounded-lg shadow-md flex justify-between items-center">
                <h1 className="text-2xl font-bold">NetSupport MVP — Tutor</h1>
                <span className="bg-emerald-500 px-3 py-1 rounded-full text-sm font-semibold">● Tutor Online</span>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-md border border-slate-200">
                    <div className="flex justify-between items-center border-b pb-3 mb-4">
                        <h2 className="text-xl font-bold text-slate-700">Classroom Status</h2>
                    </div>

                    {students.length === 0 ? (
                        <div className="py-10 text-center text-slate-400 italic font-medium">No students connected yet...</div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {students.map(student => (
                                <div key={student.id} className={`p-4 rounded-lg border-2 ${student.status === 0 ? 'border-red-400 bg-red-50' : 'border-emerald-400 bg-emerald-50'}`}>
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="font-bold text-slate-800 truncate pr-2">{student.name} <span className="text-slate-400 text-xs ml-1">#{student.id}</span></h3>
                                        <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full ${student.status === 0 ? 'bg-red-200 text-red-800' : 'bg-emerald-200 text-emerald-800'}`}>{student.status === 0 ? 'Locked' : 'Ready'}</span>
                                    </div>
                                    <div className="flex space-x-2">
                                        <button className="flex-1 py-1.5 rounded text-xs font-bold bg-red-500 hover:bg-red-600 text-white">Lock</button>
                                        <button className="flex-1 py-1.5 rounded text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white">Unlock</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <aside className="bg-white p-6 rounded-lg shadow-md border border-slate-200 flex flex-col space-y-6">
                    <div>
                        <h2 className="text-lg font-bold mb-3 text-slate-700">Set Duration</h2>
                        <div className="flex space-x-2 mb-4">
                            <input type="number" min="0" value={hours} onChange={e => setHours(Number(e.target.value) || 0)} className="w-1/3 border-2 border-slate-200 rounded p-2 text-center" />
                            <input type="number" min="0" max="59" value={minutes} onChange={e => setMinutes(Number(e.target.value) || 0)} className="w-1/3 border-2 border-slate-200 rounded p-2 text-center" />
                            <input type="number" min="0" max="59" value={seconds} onChange={e => setSeconds(Number(e.target.value) || 0)} className="w-1/3 border-2 border-slate-200 rounded p-2 text-center" />
                        </div>
                        <button disabled className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold">Initialize ExamSession</button>
                    </div>

                    <div className="mt-auto">
                        <button disabled className="w-full bg-red-600 text-white py-4 rounded-2xl font-black">FORCE STOP & REPORT</button>
                    </div>
                </aside>
            </div>
        </div>
    );
};

export default TutorDashboard;