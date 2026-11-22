using System.Threading.Channels;
using Microsoft.AspNetCore.SignalR;
using RestApi.Hubs;

namespace RestApi.Services;

public sealed record DataChangedEvent(string Resource, string Method, DateTimeOffset Timestamp);

/// <summary>Cola acotada para desacoplar las escrituras HTTP del fan-out SignalR.</summary>
public sealed class DataChangedChannel
{
    private readonly Channel<DataChangedEvent> _channel = Channel.CreateBounded<DataChangedEvent>(
        new BoundedChannelOptions(1024)
        {
            FullMode = BoundedChannelFullMode.DropOldest,
            SingleReader = true,
        });

    public bool TryPublish(DataChangedEvent value) => _channel.Writer.TryWrite(value);

    public IAsyncEnumerable<DataChangedEvent> ReadAll(CancellationToken cancellationToken)
        => _channel.Reader.ReadAllAsync(cancellationToken);
}

/// <summary>Consume la cola y notifica a los clientes sin bloquear la peticion original.</summary>
public sealed class DataChangedBroadcaster : BackgroundService
{
    private readonly DataChangedChannel _channel;
    private readonly IHubContext<AppHub> _hubContext;
    private readonly ILogger<DataChangedBroadcaster> _logger;

    public DataChangedBroadcaster(
        DataChangedChannel channel,
        IHubContext<AppHub> hubContext,
        ILogger<DataChangedBroadcaster> logger)
    {
        _channel = channel;
        _hubContext = hubContext;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var change in _channel.ReadAll(stoppingToken))
        {
            try
            {
                await _hubContext.Clients.All.SendAsync(
                    "DataChanged",
                    new
                    {
                        resource = change.Resource,
                        method = change.Method,
                        timestamp = change.Timestamp.UtcDateTime.ToString("O"),
                    },
                    stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogWarning(ex, "No se pudo emitir DataChanged para {Resource}", change.Resource);
            }
        }
    }
}
