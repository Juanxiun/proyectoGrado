using System.Net;
using Microsoft.AspNetCore.Http.Features;
using RestApi.Hubs;
using RestApi.Services;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();

// gateway -> signalr concurrente para multiples procesos simultaneos
builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = builder.Environment.IsDevelopment();
    options.MaximumParallelInvocationsPerClient = 16;
    options.KeepAliveInterval = TimeSpan.FromSeconds(15);
    options.ClientTimeoutInterval = TimeSpan.FromMinutes(2);
    options.MaximumReceiveMessageSize = 10 * 1024 * 1024;
});

builder.Services.AddSingleton<PendingRequestTracker>();
builder.Services.AddSingleton<DataChangedChannel>();
builder.Services.AddHostedService<DataChangedBroadcaster>();

builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 167_772_160;
});
builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 167_772_160;
});

builder.Services.AddOpenApi();

// gateway -> pool http optimizado para alta concurrencia entre servicios
static SocketsHttpHandler CreatePooledHandler() => new()
{
    MaxConnectionsPerServer = 128,
    PooledConnectionLifetime = TimeSpan.FromMinutes(5),
    PooledConnectionIdleTimeout = TimeSpan.FromMinutes(2),
    EnableMultipleHttp2Connections = true,
    AutomaticDecompression = DecompressionMethods.All,
};

builder.Services.AddHttpClient<UserServiceClient>().ConfigurePrimaryHttpMessageHandler(CreatePooledHandler);
builder.Services.AddHttpClient<AcademicServiceClient>().ConfigurePrimaryHttpMessageHandler(CreatePooledHandler);
builder.Services.AddHttpClient<EnrollmentServiceClient>().ConfigurePrimaryHttpMessageHandler(CreatePooledHandler);
builder.Services.AddHttpClient<HomeworkServiceClient>().ConfigurePrimaryHttpMessageHandler(CreatePooledHandler);
builder.Services.AddHttpClient<NotificationServiceClient>().ConfigurePrimaryHttpMessageHandler(CreatePooledHandler);
builder.Services.AddHttpClient<DashboardServiceClient>().ConfigurePrimaryHttpMessageHandler(CreatePooledHandler);
builder.Services.AddHttpClient<BillingServiceClient>().ConfigurePrimaryHttpMessageHandler(CreatePooledHandler);
builder.Services.AddHttpClient<GamificationServiceClient>().ConfigurePrimaryHttpMessageHandler(CreatePooledHandler);
builder.Services.AddHttpClient<ControlAcademicoServiceClient>().ConfigurePrimaryHttpMessageHandler(CreatePooledHandler);
builder.Services.AddHttpClient<WebhookDispatcherService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(10);
}).ConfigurePrimaryHttpMessageHandler(CreatePooledHandler);

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
app.UseWebSockets(new WebSocketOptions
{
    KeepAliveInterval = TimeSpan.FromSeconds(20),
});

app.Use(async (context, next) =>
{
    await next();

    // gateway -> difusion no bloqueante de cambios a clientes signalr
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
        var changes = context.RequestServices.GetRequiredService<DataChangedChannel>();
        changes.TryPublish(new DataChangedEvent(resource, context.Request.Method, DateTimeOffset.UtcNow));
    }
});

app.MapControllers();
app.MapHub<AppHub>("/hub");

app.MapGet("/health", () => new
{
    status = "ok",
    service = "RestApi",
    timestamp = DateTime.UtcNow.ToString("O"),
    version = "1.2.0",
}).WithName("RestApiHealth");

app.Run();
