using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.DependencyInjection;
using NetSupport.Core.Interfaces;
using NetSupport.Infrastructure.Data;
using System;
using System.Collections.Concurrent;
using System.Linq;
using System.Threading.Tasks;

namespace NetSupport_MVP_Project.Hubs
{
    public class ClassroomHub : Hub
    {
        private static readonly ConcurrentDictionary<int, string> StudentConnectionMap = new();
        private static readonly ConcurrentDictionary<string, (int StudentId, string RoomName)> ConnectionMetaMap = new();

        private readonly IServiceScopeFactory _serviceScopeFactory;

        public ClassroomHub(IServiceScopeFactory serviceScopeFactory)
        {
            _serviceScopeFactory = serviceScopeFactory;
        }

        public override async Task OnConnectedAsync()
        {
            try
            {
                var httpContext = Context.GetHttpContext();
                var query = httpContext?.Request.Query;

                if (query == null || !int.TryParse(query["studentId"], out int studentId) || studentId < 0)
                {
                    Context.Abort();
                    return;
                }

                string studentName = query["studentName"].ToString();
                if (string.IsNullOrWhiteSpace(studentName)) studentName = "Unknown";

                string roomName = query["roomName"].ToString();
                if (string.IsNullOrWhiteSpace(roomName)) roomName = "eval";

                StudentConnectionMap.AddOrUpdate(studentId, Context.ConnectionId, (_, __) => Context.ConnectionId);
                ConnectionMetaMap[Context.ConnectionId] = (studentId, roomName);

                await Groups.AddToGroupAsync(Context.ConnectionId, roomName);

                await Clients.Group(roomName).SendAsync("StudentConnected", new
                {
                    StudentId = studentId,
                    StudentName = studentName,
                    Timestamp = DateTime.UtcNow
                });

                await base.OnConnectedAsync();
            }
            catch (Exception)
            {
                Context.Abort();
            }
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            try
            {
                string oldConnectionId = Context.ConnectionId;

                if (ConnectionMetaMap.TryRemove(oldConnectionId, out var meta))
                {
                    _ = Task.Run(async () =>
                    {
                        try
                        {
                            await Task.Delay(2000);

                            if (!StudentConnectionMap.TryGetValue(meta.StudentId, out var currentConnId) || currentConnId == oldConnectionId)
                            {
                                StudentConnectionMap.TryRemove(meta.StudentId, out _);

                                using (var scope = _serviceScopeFactory.CreateScope())
                                {
                                    var dbContext = scope.ServiceProvider.GetRequiredService<NetSupportDBContext>();
                                    var student = await dbContext.Students.FindAsync(meta.StudentId);
                                    if (student != null)
                                    {
                                        dbContext.Students.Remove(student);
                                        var oldResults = dbContext.ExamResults.Where(er => er.StudentId == meta.StudentId);
                                        dbContext.ExamResults.RemoveRange(oldResults);
                                        await dbContext.SaveChangesAsync();
                                    }

                                    var hubContext = scope.ServiceProvider.GetRequiredService<IHubContext<ClassroomHub>>();
                                    await hubContext.Clients.Group(meta.RoomName).SendAsync("StudentDisconnected", new
                                    {
                                        StudentId = meta.StudentId,
                                        RoomName = meta.RoomName,
                                        Timestamp = DateTime.UtcNow
                                    });
                                }
                            }
                        }
                        catch (Exception ex)
                        {
                            System.Diagnostics.Debug.WriteLine($"Background Task Error: {ex.Message}");
                        }
                    });
                }

                await base.OnDisconnectedAsync(exception);
            }
            catch (Exception)
            {
                await base.OnDisconnectedAsync(exception);
            }
        }

        public static string GetConnectionId(int studentId)
        {
            StudentConnectionMap.TryGetValue(studentId, out var connectionId);
            return connectionId ?? string.Empty;
        }

        public async Task SubmitAnswer(int studentId, int examId, int questionId, string answer)
        {
            try
            {
                using (var scope = _serviceScopeFactory.CreateScope())
                {
                    var examService = scope.ServiceProvider.GetRequiredService<IExamService>();
                    int currentScore = await examService.CheckAndSaveAnswerAsync(studentId, examId, questionId, answer);

                    string roomName = "eval";
                    if (ConnectionMetaMap.TryGetValue(Context.ConnectionId, out var meta))
                    {
                        roomName = meta.RoomName;
                    }

                    await Clients.Group(roomName).SendAsync("ReceiveLiveUpdate", studentId, currentScore);
                }
            }
            catch (Exception)
            {
                await Clients.Caller.SendAsync("AnswerSubmissionError", "Failed to submit answer");
            }
        }

        public async Task SyncLateStudent(int studentId, int examId, long endTimeTimestamp)
        {
            string connectionId = GetConnectionId(studentId);
            if (!string.IsNullOrEmpty(connectionId))
            {
                await Clients.Client(connectionId).SendAsync("SyncExamTime", examId, endTimeTimestamp);
            }
        }

        public async Task ForceStopExam()
        {
            await Clients.Group("eval").SendAsync("ReceiveForceStop");
        }
    }
}