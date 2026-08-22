using RestApi.Services;

var builder = WebApplication.CreateBuilder(args);

// ── Servicios ─────────────────────────────────────────────────────────────────

// Controllers (escanea automáticamente Controllers/)
builder.Services.AddControllers();

// OpenAPI / Swagger
builder.Services.AddOpenApi();

// HttpClient tipado para el webhook hacia ServiceUser (Deno)
// El BaseAddress se configura dentro de UserServiceClient
builder.Services.AddHttpClient<UserServiceClient>();

// CORS (abierto para desarrollo; restringir en producción)
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy
            .AllowAnyOrigin()
            .AllowAnyMethod()
            .AllowAnyHeader());
});

// ── Pipeline ──────────────────────────────────────────────────────────────────

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors();

// Deshabilitar redirección HTTPS para que el RestApi pueda comunicarse
// con el ServiceUser en HTTP de forma interna
// app.UseHttpsRedirection();

app.MapControllers();

// Health check propio del RestApi
app.MapGet("/health", () => new
{
    status = "ok",
    service = "RestApi",
    timestamp = DateTime.UtcNow.ToString("O"),
    version = "1.0.0"
}).WithName("RestApiHealth");

app.Run();
