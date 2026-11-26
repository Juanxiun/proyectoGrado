using System.Collections.Concurrent;

namespace RestApi.Services;

// gateway -> registro concurrente de peticiones websocket activas
public sealed class PendingRequestTracker
{
    private static readonly TimeSpan Ttl = TimeSpan.FromMinutes(20);
    private readonly ConcurrentDictionary<string, PendingEntry> _pendingRequests = new();

    private readonly record struct PendingEntry(string ConnectionId, DateTimeOffset RegisteredAt);

    public void Register(string requestId, string connectionId)
    {
        CleanupExpired();
        _pendingRequests[requestId] = new PendingEntry(connectionId, DateTimeOffset.UtcNow);
    }

    public bool TryGet(string requestId, out string? connectionId)
    {
        connectionId = null;
        if (!_pendingRequests.TryGetValue(requestId, out var entry)) return false;
        if (DateTimeOffset.UtcNow - entry.RegisteredAt > Ttl)
        {
            _pendingRequests.TryRemove(requestId, out _);
            return false;
        }
        connectionId = entry.ConnectionId;
        return true;
    }

    public bool TryGetAndRemove(string requestId, out string? connectionId)
    {
        connectionId = null;
        if (!_pendingRequests.TryRemove(requestId, out var entry)) return false;
        if (DateTimeOffset.UtcNow - entry.RegisteredAt > Ttl) return false;
        connectionId = entry.ConnectionId;
        return true;
    }

    public void RemoveByConnectionId(string connectionId)
    {
        foreach (var (requestId, entry) in _pendingRequests)
        {
            if (entry.ConnectionId == connectionId)
            {
                _pendingRequests.TryRemove(requestId, out _);
            }
        }
    }

    private void CleanupExpired()
    {
        var now = DateTimeOffset.UtcNow;
        foreach (var (requestId, entry) in _pendingRequests)
        {
            if (now - entry.RegisteredAt > Ttl)
            {
                _pendingRequests.TryRemove(requestId, out _);
            }
        }
    }
}
