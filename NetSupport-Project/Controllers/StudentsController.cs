using Microsoft.AspNetCore.Mvc;
using NetSupport.Core.DTOs;
using NetSupport.Core.Interfaces;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace NetSupport_MVP_Project.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class StudentsController : ControllerBase
    {
        private readonly IStudentService _studentService;
        private readonly IExamService _examService;

        public StudentsController(IStudentService studentService, IExamService examService)
        {
            _studentService = studentService;
            _examService = examService;
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] StudentLoginDto studentLoginDto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            try
            {
                var result = await _studentService.LoginStudentAsync(studentLoginDto);
                return Ok(result);
            }
            catch (InvalidOperationException ex) when (ex.Message == "NameAlreadyExists")
            {
                return Conflict(new { message = "This name is already in the classroom. Please enter your full name." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An error occurred during login", error = ex.Message });
            }
        }

        [HttpGet("exam/{examId}")]
        public async Task<IActionResult> GetExamQuestions(int examId)
        {
            if (examId <= 0)
                return BadRequest(new { message = "Exam ID must be greater than zero" });

            try
            {
                var questions = await _examService.GetExamQuestionsAsync(examId);

                if (questions == null || !questions.Any())
                    return NotFound(new { message = "No questions found for this exam" });

                return Ok(questions);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An error occurred while retrieving exam questions", error = ex.Message });
            }
        }
    }
}