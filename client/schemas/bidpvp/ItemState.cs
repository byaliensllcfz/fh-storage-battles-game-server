using Colyseus.Schema;

public class ItemState : Schema
{
    [Type(0, "string")]
	public string itemId = "";

    [Type(1, "string")]
	public string state = "";
}