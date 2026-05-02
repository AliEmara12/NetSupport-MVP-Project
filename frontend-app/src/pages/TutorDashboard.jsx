import React from 'react';

const TutorDashboard = () => {
    return (
        <div className="min-h-screen p-6">
            <header className="mb-6">
                <h1 className="text-2xl font-bold">Tutor Dashboard (scaffold)</h1>
                <p className="text-sm text-slate-500">Route: /tutor</p>
            </header>

            <main>
                <div className="bg-white p-6 rounded shadow-sm border border-slate-200">
                    <p className="text-slate-600">This is the scaffold for the Tutor Dashboard. Next commits will add layout, styles, and API/SignalR wiring.</p>
                </div>
            </main>
        </div>
    );
};

export default TutorDashboard;