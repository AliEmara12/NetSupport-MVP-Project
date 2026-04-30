import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import StudentView from './pages/StudentView';
import TutorDashboard from './pages/TutorDashboard';

function App() {
    return (
        <Router>
            <div className="min-h-screen bg-gray-100 font-sans text-gray-800">
                <Routes>
                    {}
                    <Route path="/" element={<Navigate to="/student" />} />
                    <Route path="/student" element={<StudentView />} />
                    <Route path="/tutor" element={<TutorDashboard />} />
                </Routes>
            </div>
        </Router>
    );
}

export default App;