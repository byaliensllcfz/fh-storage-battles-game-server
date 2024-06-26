// 
// THIS FILE HAS BEEN GENERATED AUTOMATICALLY
// DO NOT CHANGE IT MANUALLY UNLESS YOU KNOW WHAT YOU'RE DOING
// 
// GENERATED USING @colyseus/schema 0.4.61
// 

using Colyseus.Schema;

public class AuctionState : Schema
{
    [Type(0, "string")] 
	public string status = "";

    [Type(1, "array", typeof(ArraySchema<LotState>))]
    public ArraySchema<LotState> lots = new ArraySchema<LotState>();

    [Type(2, "map", typeof(MapSchema<PlayerState>))]
    public MapSchema<PlayerState> players = new MapSchema<PlayerState>();

    [Type(3, "uint8")] 
	public uint currentLot = 0;
}