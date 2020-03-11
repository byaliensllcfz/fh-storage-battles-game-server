using Colyseus.Schema;

public class BoxState : Schema
{
    [Type(0, "string")]
	public string boxId = "";

    [Type(1, "string")]
	public string itemId = "";

    [Type(2, "string")]
	public string state = "";
}