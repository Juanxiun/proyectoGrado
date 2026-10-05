using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.SignalR;
using RestApi.Hubs;
using RestApi.Services;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();
builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = true;
});
builder.Services.AddSingleton<PendingRequestTracker>();

builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 167_772_160; // limite -> 160 megabytes
});
builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 167_772_160; // limite -> 160 megabytes
});

builder.Services.AddOpenApi();

builder.Services.AddHttpClient<UserServiceClient>();
builder.Services.AddHttpClient<AcademicServiceClient>();
builder.Services.AddHttpClient<EnrollmentServiceClient>();
builder.Services.AddHttpClient<HomeworkServiceClient>();
builder.Services.AddHttpClient<NotificationServiceClient>();
builder.Services.AddHttpClient<DashboardServiceClient>();
builder.Services.AddHttpClient<WebhookDispatcherService>();
builder.Services.AddSingleton<JwtTokenValidator>();
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy
            .SetIsOriginAllowed(_ => true)
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials());
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors();
app.UseWebSockets();

app.Use(async (context, next) =>
{
    context.Request.EnableBuffering();
    await next();

    // gateway -> unico notificar clientes signalr
    var isApiWrite = !HttpMethods.IsGet(context.Request.Method)
        && !HttpMethods.IsHead(context.Request.Method)
        && context.Request.Path.StartsWithSegments("/api")
        && !context.Request.Path.StartsWithSegments("/api/webhooks")
        && !context.Request.Path.StartsWithSegments("/api/internal")
        && context.Response.StatusCode is >= 200 and < 300;
    if (isApiWrite)
    {
        var resource = context.Request.Path.Value?
            .Trim('/')
            .Split('/', StringSplitOptions.RemoveEmptyEntries)
            .ElementAtOrDefault(1) ?? "unknown";
        if (context.Request.Path.Value?.Contains("/horarios/", StringComparison.OrdinalIgnoreCase) == true)
        {
            resource = "horarios";
        }
        var hub = context.RequestServices.GetRequiredService<Microsoft.AspNetCore.SignalR.IHubContext<AppHub>>();
        await hub.Clients.All.SendAsync("DataChanged", new
        {
            resource,
            method = context.Request.Method,
            timestamp = DateTime.UtcNow.ToString("O")
        });
    }
});

app.MapControllers();
app.MapHub<AppHub>("/hub");

app.MapGet("/health", () => new
{
    status = "ok",
    service = "RestApi",
    timestamp = DateTime.UtcNow.ToString("O"),
    version = "1.1.0"
}).WithName("RestApiHealth");

app.Run();
