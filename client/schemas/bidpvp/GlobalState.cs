using Plugins.Colyseus.Serializer.Schema;

public class GlobalState : Schema {
	[Type(0, "string")]
	public string status = "";
}