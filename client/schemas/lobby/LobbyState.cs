using Plugins.Colyseus.Serializer.Schema;

public class LobbyState : Schema {
	[Type(0, "string")]
	public string message = "";
}