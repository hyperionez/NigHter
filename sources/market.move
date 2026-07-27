module perp_dex::market;

use perp_dex::admin::AdminCap;

const EInvalidLeverage : u64 = 0;
const EInvalidMarginConfig : u64 = 1;
const EMarketPaused : u64 = 2;
const EOpenInterestExceeded : u64 = 3;

public struct Market has key{
    id : UID,
    symbol: vector<u8>,
    max_leverage : u64,
    initial_margin_bps : u64,
    maintenance_margin_bps:u64,
    open_fee_bps:u64,
    close_fee_bps:u64,
    long_open_interest: u64,
    short_open_interest:u64,
    max_open_interest:u64,
    mock_price:u64,
    pyth_price_feed_id : vector<u8>,
    max_price_stanless_secs : u64,
    paused:bool,
}

public fun create_market(
    _admin: &AdminCap,
    symbol: vector<u8>,
    max_leverage: u64,
    initial_margin_bps:u64,
    maintenance_margin_bps:u64,
    open_fee_bps:u64,
    close_fee_bps:u64,
    max_open_interest:u64,
    initial_mock_price: u64,
    pyth_price_feed_id : vector<u8>,
    max_price_stanless_secs : u64,
    ctx: &mut TxContext
){
    assert!(max_leverage > 0, EInvalidLeverage);
    assert!(initial_margin_bps > maintenance_margin_bps, EInvalidMarginConfig);
    transfer::share_object(Market {
        id: object::new(ctx),
        symbol,
        max_leverage,
        initial_margin_bps,
        maintenance_margin_bps,
        open_fee_bps,
        close_fee_bps,
        long_open_interest: 0,
        short_open_interest: 0,
        max_open_interest,
        mock_price : initial_mock_price,
        pyth_price_feed_id : pyth_price_feed_id,
        max_price_stanless_secs : max_price_stanless_secs,
        paused: false,
    });
}

public fun set_paused(market: &mut Market, _admin : &AdminCap, paused: bool){
    market.paused = paused;
}

public fun set_mock_price(market: &mut Market, _admin :&AdminCap, new_price: u64){
    market.mock_price = new_price;
}

public(package) fun add_long_open_interest(market: &mut Market, amount: u64){
    assert!(market.long_open_interest + amount <= market.max_open_interest, EOpenInterestExceeded);
    market.long_open_interest = market.long_open_interest + amount;
}
public(package) fun add_short_open_interest(market: &mut Market, amount: u64){
    market.short_open_interest = market.short_open_interest + amount;
}

public(package) fun add_long_close_interest(market: &mut Market, amount: u64){
    market.long_open_interest = market.long_open_interest - amount;
}

public(package) fun add_short_close_interest(market: &mut Market, amount: u64){
    market.short_open_interest = market.short_open_interest - amount;
}


public fun max_leverage(market: &Market): u64 {
    market.max_leverage
}

public fun initial_margin_bps(market: &Market): u64 {
    market.initial_margin_bps
}

public fun maintenance_margin_bps(market: &Market): u64 {
    market.maintenance_margin_bps
}

public fun open_fee_bps(market: &Market): u64 {
    market.open_fee_bps
}

public fun close_fee_bps(market: &Market): u64 {
    market.close_fee_bps
}

public fun mock_price(market: &Market): u64 {
    market.mock_price
}

public fun is_paused(market: &Market): bool {
    market.paused
}

public fun max_price_stanless_secs(market: &Market) : u64 {
    market.max_price_stanless_secs
}

public fun pyth_price_feed_id(market : &Market) : vector<u8> {
    market.pyth_price_feed_id
}

public fun long_open_interest(market : &Market) : u64 {
    market.long_open_interest
}

public fun short_open_interest(market : &Market) : u64 {
    market.short_open_interest
}