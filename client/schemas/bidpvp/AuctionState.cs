// 
// THIS FILE HAS BEEN GENERATED AUTOMATICALLY
// DO NOT CHANGE IT MANUALLY UNLESS YOU KNOW WHAT YOU'RE DOING
// 
// GENERATED USING @colyseus/schema 0.4.61
// 

using Colyseus.Schema;

public class AuctionState : Schema {
	[Type(0, "int32")]
	public int bidValue = 0;

	[Type(1, "string")]
	public string bidOwner = "";

	[Type(2, "int8")]
	public int dole = 0;

	[Type(3, "map", "string")]
	public MapSchema<string> items = new MapSchema<string>();

	[Type(4, "int32")]
	public int randomSeed = 0;

	[Type(5, "string")]
	public string status = "";
}

