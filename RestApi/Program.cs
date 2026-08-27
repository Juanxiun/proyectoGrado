using RestApi.Hubs;
using RestApi.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();

// SignalR para WebSockets
builder.Services.AddSignalR();

// Servicios de Webhooks y Rastreo de Solicitudes Asíncronas
builder.Services.AddSingleton<PendingRequestTracker>();
builder.Services.AddHttpClient<WebhookDispatcherService>();

// OpenAPI / Swagger
builder.Services.AddOpenApi();

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy
            .WithOrigins("http://localhost:8081")
            .WithMethods("GET", "POST", "PUT", "DELETE")
            .WithHeaders(
                "Content-Type",       
                "Accept",             
                "Authorization",      //JWT
                "X-Requested-With"    //AJAX
            ));
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors();

app.MapControllers();
app.MapHub<AppHub>("/hub/app");

app.MapGet("/health", () => new
{
    status = "ok",
    service = "RestApi (WebSocket Gateway & Webhook Dispatcher)",
    timestamp = DateTime.UtcNow.ToString("O"),
    version = "2.0.0"
}).WithName("RestApiHealth");

app.Run();

