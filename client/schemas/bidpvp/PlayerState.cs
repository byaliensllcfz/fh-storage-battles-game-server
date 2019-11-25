// 
// THIS FILE HAS BEEN GENERATED AUTOMATICALLY
// DO NOT CHANGE IT MANUALLY UNLESS YOU KNOW WHAT YOU'RE DOING
// 
// GENERATED USING @colyseus/schema 0.4.61
// 

using Colyseus.Schema;

public class PlayerState : Schema {
	[Type(0, "string")]
	public string id = "";

	[Type(1, "string")]
	public string name = "";

	[Type(2, "string")]
	public string photoUrl = "";

	[Type(3, "int32")]
	public int money = 0;

	[Type(4, "int32")] 
	public int lastBid = 0;
	
	[Type(5, "string")]
	public string character = "";

	[Type(6, "boolean")]
	public bool connected;

	[Type(7, "int32")] 
	public int trophiesEarned = 0;

	[Type(8, "int32")] 
	public int trophies = 0;

	[Type(9, "int8")] 
	public int rank = 0;

}
