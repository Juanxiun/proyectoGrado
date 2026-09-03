using RestApi.Services;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();

builder.Services.AddOpenApi();

builder.Services.AddHttpClient<UserServiceClient>();
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy
            .AllowAnyOrigin()
            .AllowAnyMethod()
            .AllowAnyHeader());
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors();

app.MapControllers();

app.MapGet("/health", () => new
{
    status = "ok",
    service = "RestApi",
    timestamp = DateTime.UtcNow.ToString("O"),
    version = "1.0.0"
}).WithName("RestApiHealth");

app.Run();
