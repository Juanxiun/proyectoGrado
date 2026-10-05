namespace RestApi.Hubs;

// hub -> grupos signalr por usuario
public static class NotificationGroups
{
    public static string ForUser(string usuarioId) => $"usuario:{usuarioId}";
}
