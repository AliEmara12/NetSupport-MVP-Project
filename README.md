feat(fullstack): finalize real-time exam engine, session recovery, and exact scoring

- Frontend: Migrate to sessionStorage for multi-tab support and tab-refresh resilience.
- Frontend: Implement absolute timestamp sync and precise time input (HH:MM:SS) in Tutor Dashboard.
- Frontend: Display student IDs to differentiate duplicate names and add 'Leave Classroom' feature.
- Backend: Refactor CheckAndSaveAnswerAsync with caching to track answer changes and prevent duplicate scoring.
- Backend: Optimize SignalR graceful disconnect with a 2-second buffer in ClassroomHub.
- Backend: Update Exam Duration to double for second-level precision.
- Backend: Fix PDF report generation to explicitly include all joined students (even with 0 scores).
