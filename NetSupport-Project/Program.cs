using Microsoft.EntityFrameworkCore;
using NetSupport.Core.Interfaces;
using NetSupport.Infrastructure.Data;
using NetSupport.Infrastructure.Services;
using NetSupport_MVP_Project.Hubs;
using QuestPDF.Infrastructure;

namespace NetSupport_MVP_Project
{
    public class Program
    {
        public static void Main(string[] args)
        {
            QuestPDF.Settings.License = LicenseType.Community;

            var builder = WebApplication.CreateBuilder(args);

            builder.Services.AddControllers();

            builder.Services.AddEndpointsApiExplorer();
            builder.Services.AddSwaggerGen(); 

            builder.Services.AddSignalR();

            builder.Services.AddCors(options =>
            {
                options.AddPolicy("AllowFrontend", policy =>
                {
                    policy.WithOrigins("http://localhost:3000", "http://localhost:5173")
                          .AllowAnyHeader()
                          .AllowAnyMethod()
                          .AllowCredentials(); 
                });
            });

            var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
                ?? "Server=.;Database=NetSupport;Integrated Security=true;TrustServerCertificate=true;Encrypt=False;";

            builder.Services.AddDbContext<NetSupportDBContext>(options =>
                options.UseSqlServer(connectionString));

            builder.Services.AddScoped<IStudentService, StudentService>();
            builder.Services.AddScoped<IExamService, ExamService>();

            var app = builder.Build();

            app.UseExceptionHandler(errorApp =>
            {
                errorApp.Run(async context =>
                {
                    context.Response.StatusCode = 500;
                    context.Response.ContentType = "application/json";
                    await context.Response.WriteAsJsonAsync(new
                    {
                        message = "An internal server error occurred.",
                        status = 500
                    });
                });
            });

            
            if (app.Environment.IsDevelopment())
            {
                app.UseSwagger();
                app.UseSwaggerUI(c =>
                {
                    c.SwaggerEndpoint("/swagger/v1/swagger.json", "NetSupport MVP V1");
                    c.RoutePrefix = string.Empty; 
                });
            }

           // app.UseHttpsRedirection();

            app.UseCors("AllowFrontend");

            app.UseAuthorization();

            app.MapControllers();

            app.MapHub<ClassroomHub>("/classroomHub");

            app.Run();
        }
    }
}