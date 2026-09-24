using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.SignalR;
using RestApi.Hubs;
using RestApi.Services;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();
builder.Services.AddSignalR();
builder.Services.AddSingleton<PendingRequestTracker>();

builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 167_772_160; // 160 MB
});
builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 167_772_160; // 160 MB
});

builder.Services.AddOpenApi();

builder.Services.AddHttpClient<UserServiceClient>();
builder.Services.AddHttpClient<AcademicServiceClient>();
builder.Services.AddHttpClient<EnrollmentServiceClient>();
builder.Services.AddHttpClient<HomeworkServiceClient>();
builder.Services.AddHttpClient<WebhookDispatcherService>();
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

app.Use(async (context, next) =>
{
    context.Request.EnableBuffering();
    await next();

    // Las modificaciones pasan por el gateway. Éste es, por tanto, el único
    // proceso que anuncia cambios a los clientes SignalR; los servicios sólo
    // responden al gateway por HTTP/webhook y no mantienen sockets públicos.
    var isApiWrite = !HttpMethods.IsGet(context.Request.Method)
        && !HttpMethods.IsHead(context.Request.Method)
        && context.Request.Path.StartsWithSegments("/api")
        && !context.Request.Path.StartsWithSegments("/api/webhooks")
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
