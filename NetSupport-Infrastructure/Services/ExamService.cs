using Microsoft.EntityFrameworkCore;
using NetSupport.Core.DTOs;
using NetSupport.Core.Interfaces;
using NetSupport.Infrastructure.Data;
using NetSupport_MVP_Project.Models;
using QuestPDF.Elements.Table;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace NetSupport.Infrastructure.Services
{
    public class ExamService : IExamService
    {
        private readonly NetSupportDBContext _context;

        public ExamService(NetSupportDBContext context)
        {
            _context = context;
        }

        public async Task<int> CreateExamAsync(CreateExamDto createExamDto)
        {
            if (createExamDto == null)
                throw new ArgumentNullException(nameof(createExamDto), "Create exam DTO cannot be null");

            var exam = new Exam
            {
                DurationInMinutes = createExamDto.DurationInMinutes,
                CreatedAt = DateTime.UtcNow,
                Title = $"Exam - {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss}"
            };

            _context.Exams.Add(exam);
            await _context.SaveChangesAsync();

            return exam.Id;
        }

        public async Task<bool> UpdateExamStatusAsync(int examId, string status)
        {
            if (string.IsNullOrWhiteSpace(status))
                throw new ArgumentException("Status cannot be null or empty", nameof(status));

            var exam = await _context.Exams.FirstOrDefaultAsync(e => e.Id == examId);

            if (exam == null)
                return false;

            exam.Title = $"{exam.Title} - {status}";
            _context.Exams.Update(exam);
            await _context.SaveChangesAsync();

            return true;
        }

        public async Task<bool> AddQuestionsAsync(List<Question> questions)
        {
            if (questions == null || questions.Count == 0)
                return false;

            _context.Questions.AddRange(questions);
            await _context.SaveChangesAsync();

            return true;
        }

        private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, bool> _studentAnswersCache = new();

        public async Task<int> CheckAndSaveAnswerAsync(int studentId, int examId, int questionId, string answer)
        {
            if (string.IsNullOrWhiteSpace(answer)) return 0;
            var trimmedAnswer = answer.Trim();

            var question = await _context.Questions
                .AsNoTracking()
                .FirstOrDefaultAsync(q => q.Id == questionId && q.ExamId == examId);

            if (question == null) return 0;

            bool isCorrect = string.Equals(question.CorrectAnswer.Trim(), trimmedAnswer, StringComparison.OrdinalIgnoreCase);

            var examResult = await _context.ExamResults
                .FirstOrDefaultAsync(er => er.StudentId == studentId && er.ExamId == examId);

            int totalQuestions = await _context.Questions.CountAsync(q => q.ExamId == examId);

            string cacheKey = $"{studentId}_{questionId}";
            _studentAnswersCache.TryGetValue(cacheKey, out bool previouslyCorrect);

            if (examResult == null)
            {
                examResult = new ExamResult
                {
                    StudentId = studentId,
                    ExamId = examId,
                    Score = isCorrect ? 1 : 0,
                    TotalQuestions = totalQuestions
                };
                _context.ExamResults.Add(examResult);
            }
            else
            {
                if (isCorrect && !previouslyCorrect)
                {
                    examResult.Score++;
                }
                else if (!isCorrect && previouslyCorrect)
                {
                    if (examResult.Score > 0) examResult.Score--;
                }

                examResult.TotalQuestions = totalQuestions;
                _context.ExamResults.Update(examResult);
            }

            _studentAnswersCache[cacheKey] = isCorrect;
            await _context.SaveChangesAsync();

            return examResult.Score;
        }

        public async Task<IEnumerable<StudentQuestionDto>> GetExamQuestionsAsync(int examId)
        {
            var questions = await _context.Questions
                .Where(q => q.ExamId == examId)
                .AsNoTracking()
                .ToListAsync();

            if (questions == null || questions.Count == 0)
                return Enumerable.Empty<StudentQuestionDto>();

            var studentQuestions = questions.Select(q =>
            {
                var answers = new List<string> { q.CorrectAnswer, q.WrongAswer1, q.WrongAswer2, q.WrongAswer3 };
                var shuffledAnswers = answers.OrderBy(_ => Guid.NewGuid()).ToList();

                return new StudentQuestionDto
                {
                    Id = q.Id,
                    Text = q.Text,
                    Answers = shuffledAnswers
                };
            });
            return studentQuestions;
        }

        public async Task<byte[]> GenerateExamReportPdfAsync(int examId)
        {
            var exam = await _context.Exams
                .AsNoTracking()
                .FirstOrDefaultAsync(e => e.Id == examId);

            if (exam == null)
                throw new KeyNotFoundException($"Exam with ID {examId} not found.");

            int totalQuestions = await _context.Questions.CountAsync(q => q.ExamId == examId);

            var allStudents = await _context.Students
                .AsNoTracking()
                .ToListAsync();

            var examResults = await _context.ExamResults
                .Where(er => er.ExamId == examId)
                .AsNoTracking()
                .ToListAsync();

            var document = Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(40);

                    page.Header()
                        .PaddingBottom(10)
                        .Column(col =>
                        {
                            col.Item().Text(exam.Title)
                                .FontSize(22)
                                .FontColor(Colors.Blue.Darken2)
                                .Bold();

                            col.Item().Text($"Duration: {exam.DurationInMinutes} minutes  |  Created: {exam.CreatedAt:yyyy-MM-dd HH:mm} UTC")
                                .FontSize(10)
                                .FontColor(Colors.Grey.Darken1);
                        });

                    page.Content().PaddingTop(20).Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.RelativeColumn(2);
                            columns.RelativeColumn(1);
                            columns.RelativeColumn(1);
                            columns.RelativeColumn(1);
                        });

                        void HeaderCell(ITableCellContainer cell, string text) =>
                            cell.Padding(8)
                                .Background(Colors.Blue.Darken2)
                                .AlignCenter()
                                .Text(text)
                                .FontSize(11)
                                .Bold()
                                .FontFamily("Segoe UI")
                                .FontColor(Colors.White);

                        table.Header(header =>
                        {
                            HeaderCell(header.Cell(), "Student Name");
                            HeaderCell(header.Cell(), "Correct");
                            HeaderCell(header.Cell(), "Total");
                            HeaderCell(header.Cell(), "Score %");
                        });

                        if (allStudents.Count == 0)
                        {
                            table.Cell().ColumnSpan(4)
                                .Padding(16)
                                .AlignCenter()
                                .Text("No results submitted yet.")
                                .FontSize(11)
                                .Italic()
                                .FontColor(Colors.Grey.Medium);
                        }
                        else
                        {
                            bool alternate = false;
                            foreach (var student in allStudents.OrderBy(s => s.Name))
                            {
                                var rowColor = alternate ? Colors.Grey.Lighten3 : Colors.White;
                                alternate = !alternate;

                                var result = examResults.FirstOrDefault(er => er.StudentId == student.Id);
                                int score = result != null ? result.Score : 0;
                                int pct = totalQuestions > 0 ? (int)Math.Round((double)score / totalQuestions * 100) : 0;

                                var scoreColor = pct >= 60 ? Colors.Green.Darken1 : Colors.Red.Darken1;

                                table.Cell().Background(rowColor).Padding(8)
                                    .Text(student.Name ?? "Unknown")
                                    .FontFamily("Segoe UI")
                                    .FontSize(11);

                                table.Cell().Background(rowColor).Padding(8).AlignCenter()
                                    .Text(score.ToString()).FontSize(11);

                                table.Cell().Background(rowColor).Padding(8).AlignCenter()
                                    .Text(totalQuestions.ToString()).FontSize(11);

                                table.Cell().Background(rowColor).Padding(8).AlignCenter()
                                    .Text($"{pct}%")
                                    .FontSize(11)
                                    .Bold()
                                    .FontColor(scoreColor);
                            }
                        }
                    });

                    page.Footer().AlignCenter().Text(text =>
                    {
                        text.Span("Generated: ").FontSize(9).FontColor(Colors.Grey.Medium);
                        text.Span(DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss UTC"))
                            .FontSize(9)
                            .Bold()
                            .FontColor(Colors.Grey.Medium);
                        text.Span("   |   Page ").FontSize(9).FontColor(Colors.Grey.Medium);
                        text.CurrentPageNumber().FontSize(9);
                        text.Span(" of ").FontSize(9).FontColor(Colors.Grey.Medium);
                        text.TotalPages().FontSize(9);
                    });
                });
            });

            return document.GeneratePdf();
        }
    }
}