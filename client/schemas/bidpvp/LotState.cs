//
// THIS FILE HAS BEEN GENERATED AUTOMATICALLY
// DO NOT CHANGE IT MANUALLY UNLESS YOU KNOW WHAT YOU'RE DOING
//
// GENERATED USING @colyseus/schema 0.4.61
//

using Colyseus.Schema;

public class LotState : Schema
{
    [Type(0, "int32")]
	public int bidValue = 0;

    [Type(1, "int32")]
	public int nextBidValue = 0;

    [Type(2, "string")]
	public string bidOwner = "";

    [Type(3, "int8")]
	public int dole = 0;

    [Type(4, "map", typeof(MapSchema<ItemState>))]
	public MapSchema<ItemState> items = new MapSchema<ItemState>();

    [Type(5, "map", typeof(MapSchema<BoxState>))]
	public MapSchema<BoxState> boxes = new MapSchema<BoxState>();

    [Type(6, "int32")]
	public int randomSeed = 0;

    [Type(7, "string")]
	public string status = "";

    [Type(8, "int32")]
	public int lotItemsPrice = 0;
}
