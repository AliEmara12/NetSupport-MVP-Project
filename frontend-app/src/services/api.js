import axios from 'axios';

const API_BASE_URL = 'http://localhost:5159/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const StudentService = {
    login: (name) => api.post('/students/login', { name }),
    getExam: (examId) => api.get(`/students/exam/${examId}`),
};

export const TutorService = {
    getStudents: (roomName = 'eval') => api.get(`/tutor/students?roomName=${roomName}`),
    updateStatus: (studentId, newStatus) => api.put('/tutor/students/status', { studentId, newStatus }),
    createExam: (durationInMinutes) => api.post('/tutor/exam', { durationInMinutes }),
    uploadQuestions: (examId, file, duration) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const validDuration = duration || 30; 
    
    return api.post(`/tutor/upload-questions/${examId}?durationInMinutes=${validDuration}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
},
    
    getExamReport: (examId) => api.get(`/tutor/exam/${examId}/report`, { responseType: 'blob' }),
};

export default api;