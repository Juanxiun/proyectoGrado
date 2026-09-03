using System.Collections.Concurrent;

namespace RestApi.Services;

public sealed class PendingRequestTracker
{
    private readonly ConcurrentDictionary<string, string> _pendingRequests = new();

    public void Register(string requestId, string connectionId)
    {
        _pendingRequests[requestId] = connectionId;
    }

    public bool TryGetAndRemove(string requestId, out string? connectionId)
    {
        return _pendingRequests.TryRemove(requestId, out connectionId);
    }

    public void RemoveByConnectionId(string connectionId)
    {
        var keysToRemove = _pendingRequests
            .Where(kvp => kvp.Value == connectionId)
            .Select(kvp => kvp.Key)
            .ToList();

        foreach (var key in keysToRemove)
        {
            _pendingRequests.TryRemove(key, out _);
        }
    }
}
