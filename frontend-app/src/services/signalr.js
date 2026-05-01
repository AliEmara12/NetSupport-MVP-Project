import * as signalR from '@microsoft/signalr';

class SignalRService {
    constructor() {
        this.connection = null;
    }

    async startConnection(studentId, studentName, roomName = 'eval') {
        if (this.connection) return;

        this.connection = new signalR.HubConnectionBuilder()
            .withUrl(`http://localhost:5159/classroomHub?studentId=${studentId}&studentName=${encodeURIComponent(studentName)}&roomName=${roomName}`)
            .withAutomaticReconnect()
            .configureLogging(signalR.LogLevel.Information)
            .build();

        try {
            await this.connection.start();
            console.log('SignalR Connected Successfully!');
        } catch (err) {
            console.error('SignalR Connection Error: ', err);
            setTimeout(() => this.startConnection(studentId, studentName, roomName), 5000);
        }
    }

    on(eventName, callback) {
        if (this.connection) {
            this.connection.on(eventName, callback);
        }
    }

    off(eventName, callback) {
        if (this.connection) {
            this.connection.off(eventName, callback);
        }
    }

    async submitAnswer(studentId, examId, questionId, answer) {
        if (this.connection && this.connection.state === signalR.HubConnectionState.Connected) {
            try {
                await this.connection.invoke('SubmitAnswer', studentId, examId, questionId, answer);
            } catch (err) {
                console.error('Error submitting answer: ', err);
            }
        }
    }
}

const signalRService = new SignalRService();
export default signalRService;