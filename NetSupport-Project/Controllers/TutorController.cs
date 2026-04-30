using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using NetSupport.Core.DTOs;
using NetSupport.Core.Entites;
using NetSupport.Core.Interfaces;
using NetSupport_MVP_Project.Hubs;
using NetSupport_MVP_Project.Models;
using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Threading.Tasks;

namespace NetSupport_MVP_Project.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TutorController : ControllerBase
    {
        private readonly IStudentService _studentService;
        private readonly IExamService _examService;
        private readonly IHubContext<ClassroomHub> _hubContext;

        public TutorController(
            IStudentService studentService,
            IExamService examService,
            IHubContext<ClassroomHub> hubContext)
        {
            _studentService = studentService;
            _examService = examService;
            _hubContext = hubContext;
        }

        [HttpGet("students")]
        public async Task<IActionResult> GetStudents([FromQuery] string roomName = "eval")
        {
            if (string.IsNullOrWhiteSpace(roomName))
                return BadRequest(new { message = "Room name is required" });

            try
            {
                var students = await _studentService.GetStudentsInRoomAsync(roomName);
                return Ok(students);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An error occurred while retrieving students", error = ex.Message });
            }
        }

        [HttpPut("students/status")]
        public async Task<IActionResult> UpdateStudentStatus([FromBody] UpdateStudentStatusDto updateStudentStatusDto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            try
            {
                var result = await _studentService.UpdateStudentStatusAsync(updateStudentStatusDto);
                if (!result)
                    return NotFound(new { message = "Student not found" });

                bool isLocked = updateStudentStatusDto.NewStatus == Status.Offline;
                string connectionId = ClassroomHub.GetConnectionId(updateStudentStatusDto.StudentId);

                if (!string.IsNullOrEmpty(connectionId))
                {
                    await _hubContext.Clients.Client(connectionId).SendAsync("ReceiveLockCommand", isLocked);
                }

                return Ok(new { message = "Student status updated successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An error occurred while updating student status", error = ex.Message });
            }
        }

        [HttpPost("exam")]
        public async Task<IActionResult> CreateExam([FromBody] CreateExamDto createExamDto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            try
            {
                var examId = await _examService.CreateExamAsync(createExamDto);
                return CreatedAtAction(nameof(CreateExam), new { examId }, new { examId, message = "Exam created successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An error occurred while creating the exam", error = ex.Message });
            }
        }

        [HttpPost("upload-questions/{examId}")]
        public async Task<IActionResult> UploadQuestionsFromCsv(int examId, IFormFile file, [FromQuery] double durationInMinutes)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { message = "File is required and cannot be empty" });

            if (!file.FileName.EndsWith(".csv", StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { message = "File must be a CSV file" });

            try
            {
                var questions = new List<Question>();
                var utf8 = new UTF8Encoding(true);

                using var reader = new StreamReader(file.OpenReadStream(), utf8);

                string? line;
                int lineNumber = 0;

                while ((line = await reader.ReadLineAsync()) != null)
                {
                    lineNumber++;

                    if (string.IsNullOrWhiteSpace(line))
                        continue;

                    if (lineNumber == 1 && line.StartsWith("Text", StringComparison.OrdinalIgnoreCase))
                        continue;

                    var parts = SplitCsvLine(line);

                    if (parts.Length < 5)
                        return BadRequest(new { message = $"Line {lineNumber}: Invalid format" });

                    var question = new Question
                    {
                        ExamId = examId,
                        Text = parts[0].Trim(),
                        CorrectAnswer = parts[1].Trim(),
                        WrongAswer1 = parts[2].Trim(),
                        WrongAswer2 = parts[3].Trim(),
                        WrongAswer3 = parts[4].Trim()
                    };

                    if (string.IsNullOrWhiteSpace(question.Text) ||
                        string.IsNullOrWhiteSpace(question.CorrectAnswer) ||
                        string.IsNullOrWhiteSpace(question.WrongAswer1) ||
                        string.IsNullOrWhiteSpace(question.WrongAswer2) ||
                        string.IsNullOrWhiteSpace(question.WrongAswer3))
                    {
                        return BadRequest(new { message = $"Line {lineNumber}: All fields must be non-empty" });
                    }

                    questions.Add(question);
                }

                if (questions.Count == 0)
                    return BadRequest(new { message = "CSV file contains no valid question rows" });

                var result = await _examService.AddQuestionsAsync(questions);

                if (!result)
                    return StatusCode(500, new { message = "Failed to insert questions into database" });

                try
                {
                    await _hubContext.Clients.Group("eval").SendAsync("TestStarted", examId, Math.Round(durationInMinutes, 2));
                }
                catch (Exception)
                {
                }

                return CreatedAtAction(nameof(UploadQuestionsFromCsv), new { examId }, new { message = "Success" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An error occurred while uploading questions", error = ex.Message });
            }
        }

        [HttpGet("exam/{examId}/report")]
        public async Task<IActionResult> GetExamReport(int examId)
        {
            if (examId <= 0)
                return BadRequest(new { message = "Exam ID must be greater than zero" });

            try
            {
                byte[] pdfBytes = await _examService.GenerateExamReportPdfAsync(examId);

                if (pdfBytes == null || pdfBytes.Length == 0)
                    return StatusCode(500, new { message = "Failed to generate PDF report" });

                return File(pdfBytes, "application/pdf", "ExamReport.pdf");
            }
            catch (KeyNotFoundException knfe)
            {
                return NotFound(new { message = knfe.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An error occurred while generating the exam report", error = ex.Message });
            }
        }

        private static string[] SplitCsvLine(string line)
        {
            var fields = new List<string>();
            bool inQuotes = false;
            var current = new StringBuilder();

            for (int i = 0; i < line.Length; i++)
            {
                char c = line[i];

                if (c == '"')
                {
                    if (inQuotes && i + 1 < line.Length && line[i + 1] == '"')
                    {
                        current.Append('"');
                        i++;
                    }
                    else
                    {
                        inQuotes = !inQuotes;
                    }
                }
                else if (c == ',' && !inQuotes)
                {
                    fields.Add(current.ToString());
                    current.Clear();
                }
                else
                {
                    current.Append(c);
                }
            }

            fields.Add(current.ToString());
            return fields.ToArray();
        }
    }
}