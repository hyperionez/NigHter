module perp_dex::position;

public struct Position has key {
    id: UID,
    owner: address,
    market_id: ID,
    is_long:bool,
    size: u64,
    collateral: u64,
    entry_price: u64,
    entry_funding_index : u128
}

public(package) fun new(
    owner: address,
    market_id: ID,
    is_long: bool,
    size:u64,
    collateral:u64,
    entry_price: u64,
    entry_funding_index : u128,
    ctx: &mut TxContext
) : Position {
    Position {
        id: object::new(ctx),
        owner,
        market_id,
        is_long,
        size,
        collateral,
        entry_price,
        entry_funding_index
    }
}

public(package) fun destroy(position :Position) : (address, ID, bool, u64, u64, u64, u128) {
    let Position { id,
     owner,
     market_id,
     is_long,
     size,
     collateral,
     entry_price,
     entry_funding_index
    } = position;
    object::delete(id);
    (owner, market_id, is_long, size, collateral, entry_price, entry_funding_index)
}

public fun owner(position : &Position): address {
    position.owner
}

public fun market_id(position: &Position): ID {
    position.market_id
}

public fun is_long(position : &Position) : bool{
    position.is_long
}

public fun size(position : &Position) : u64{
    position.size
}

public fun collateral(position: &Position): u64{
    position.collateral
}

public fun entry_price(position: &Position) : u64{
    position.entry_price
}

public fun entry_funding_index(position : &Position) : u128{
    position.entry_funding_index
}

public(package) fun share(position : Position){
    transfer::share_object(position);
}