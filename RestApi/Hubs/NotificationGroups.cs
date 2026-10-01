namespace RestApi.Hubs;

/// <summary>
/// Grupos de SignalR por usuario. El cliente entra a su propio grupo al
/// conectarse para que las notificaciones se entreguen sólo a quien corresponde.
/// </summary>
public static class NotificationGroups
{
    public static string ForUser(string usuarioId) => $"usuario:{usuarioId}";
}
