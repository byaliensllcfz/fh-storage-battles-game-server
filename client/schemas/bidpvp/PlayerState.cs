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
}
