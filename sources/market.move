module perp_dex::market;

use perp_dex::admin::{AdminCap, RiskCap};
use sui::clock::{Clock, Self};
use sui::ed25519;


const EInvalidMarginConfig : u64 = 1;
const EMarketPaused : u64 = 2;
const EOpenInterestExceeded : u64 = 3;
const EInvalidPenaltyReward : u64 = 4;
const ENotDemoMarket : u64 = 5;
const EWrongMarketForCap : u64 = 6;
const EStalePrice : u64 = 7;
const EInvalidPriceSignature : u64 = 8;
const ENotSignedPriceMarket : u64 = 9;
const ENotManualPriceMarket : u64 = 10;

public struct DemoPriceCap has key, store {
    id: UID,
    market_id: ID,
}

public struct Market has key{
    id : UID,
    symbol: vector<u8>,
    initial_margin_bps : u64,
    maintenance_margin_bps:u64,
    open_fee_bps:u64,
    close_fee_bps:u64,
    long_open_interest: u64,
    short_open_interest:u64,
    max_open_interest:u64,
    min_position_size:u64,
    demo_mode:bool,
    mock_price:u64,
    last_price_update_ms:u64,
    price_signer: vector<u8>,
    pyth_price_feed_id : vector<u8>,
    max_price_staleness_secs : u64,
    paused:bool,
    cumulative_funding_long_charge : u128,
    cumulative_funding_long_credit : u128,
    cumulative_funding_short_charge : u128,
    cumulative_funding_short_credit : u128,

    last_funding_time : u64,
    funding_rate_bps_per_hour : u64,
    liquidation_penalty_bps : u64,
    keeper_reward_bps : u64
}

public fun create_market(
    _admin: &AdminCap,
    symbol: vector<u8>,
    initial_margin_bps:u64,
    maintenance_margin_bps:u64,
    open_fee_bps:u64,
    close_fee_bps:u64,
    max_open_interest:u64,
    min_position_size:u64,
    demo_mode: bool,
    initial_mock_price: u64,
    price_signer: vector<u8>,
    pyth_price_feed_id : vector<u8>,
    max_price_staleness_secs : u64,
    funding_rate_bps_per_hour : u64,
    clock: &Clock,
    liquidation_penalty_bps : u64,
    keeper_reward_bps : u64,
    ctx: &mut TxContext
){
    assert!(initial_margin_bps > maintenance_margin_bps, EInvalidMarginConfig);
    assert!(keeper_reward_bps <= liquidation_penalty_bps, EInvalidPenaltyReward);
    assert!(close_fee_bps < maintenance_margin_bps, EInvalidMarginConfig);
    transfer::share_object(Market {
        id: object::new(ctx),
        symbol,
        initial_margin_bps,
        maintenance_margin_bps,
        open_fee_bps,
        close_fee_bps,
        long_open_interest: 0,
        short_open_interest: 0,
        max_open_interest,
        min_position_size,
        demo_mode,
        mock_price : initial_mock_price,
        last_price_update_ms : clock::timestamp_ms(clock),
        price_signer,
        pyth_price_feed_id : pyth_price_feed_id,
        max_price_staleness_secs : max_price_staleness_secs,
        paused: false,
        cumulative_funding_long_charge : 0,
        cumulative_funding_long_credit : 0,
        cumulative_funding_short_charge : 0,
        cumulative_funding_short_credit : 0,
        last_funding_time : clock::timestamp_ms(clock),
        funding_rate_bps_per_hour,
        liquidation_penalty_bps,
        keeper_reward_bps
    });
}

public fun set_paused(market: &mut Market, _risk : &RiskCap, paused: bool){
    market.paused = paused;
}

public fun set_mock_price(market: &mut Market, _risk :&RiskCap, new_price: u64, clock: &Clock){
    assert!(market.demo_mode, ENotDemoMarket);
    market.mock_price = new_price;
    market.last_price_update_ms = clock::timestamp_ms(clock);
}

public fun mint_demo_price_cap(
    market: &Market,
    _admin: &AdminCap,
    recipient: address,
    ctx: &mut TxContext
){
    assert!(market.demo_mode, ENotDemoMarket);
    transfer::public_transfer(
        DemoPriceCap { id: object::new(ctx), market_id: object::id(market) },
        recipient
    );
}

public fun set_demo_price(market: &mut Market, cap: &DemoPriceCap, new_price: u64, clock: &Clock){
    assert!(cap.market_id == object::id(market), EWrongMarketForCap);
    market.mock_price = new_price;
    market.last_price_update_ms = clock::timestamp_ms(clock);
}

public(package) fun add_long_open_interest(market: &mut Market, amount: u64){
    assert!(market.long_open_interest + amount <= market.max_open_interest, EOpenInterestExceeded);
    market.long_open_interest = market.long_open_interest + amount;
}
public(package) fun add_short_open_interest(market: &mut Market, amount: u64){
    assert!(market.short_open_interest + amount <= market.max_open_interest, EOpenInterestExceeded);
    market.short_open_interest = market.short_open_interest + amount;
}

public(package) fun add_long_close_interest(market: &mut Market, amount: u64){
    market.long_open_interest = market.long_open_interest - amount;
}

public(package) fun add_short_close_interest(market: &mut Market, amount: u64){
    market.short_open_interest = market.short_open_interest - amount;
}

public(package) fun set_last_funding_time(market: &mut Market, now: u64) {
    market.last_funding_time = now;
}

public(package) fun add_funding_index_long_charge(market: &mut Market, delta: u128) {
    market.cumulative_funding_long_charge = market.cumulative_funding_long_charge + delta;
}

public(package) fun add_funding_index_short_charge(market: &mut Market, delta: u128) {
    market.cumulative_funding_short_charge = market.cumulative_funding_short_charge + delta;
}

public(package) fun add_funding_index_long_credit(market: &mut Market, delta: u128) {
    market.cumulative_funding_long_credit = market.cumulative_funding_long_credit + delta;
}

public(package) fun add_funding_index_short_credit(market: &mut Market, delta: u128) {
    market.cumulative_funding_short_credit = market.cumulative_funding_short_credit + delta;
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

public fun last_price_update_ms(market: &Market): u64 {
    market.last_price_update_ms
}

public(package) fun assert_mock_price_fresh(market: &Market, clock: &Clock) {
    assert_manual_price_market(market);
    let now = clock::timestamp_ms(clock);
    assert!(now >= market.last_price_update_ms, EStalePrice);
    assert!(now - market.last_price_update_ms <= market.max_price_staleness_secs * 1000, EStalePrice);
}

public fun price_signer(market: &Market): vector<u8> {
    market.price_signer
}

public fun uses_signed_price(market: &Market): bool {
    !vector::is_empty(&market.price_signer)
}

public fun set_price_signer(market: &mut Market, _admin: &AdminCap, new_signer: vector<u8>) {
    market.price_signer = new_signer;
}

public(package) fun assert_manual_price_market(market: &Market) {
    assert!(vector::is_empty(&market.price_signer), ENotManualPriceMarket);
}

fun u64_be_bytes(value: u64): vector<u8> {
    let mut out = vector::empty<u8>();
    let mut shift = 64u8;
    while (shift > 0) {
        shift = shift - 8;
        vector::push_back(&mut out, ((value >> shift) & 0xFF) as u8);
    };
    out
}

public fun price_report_message(market: &Market, price: u64, timestamp_ms: u64): vector<u8> {
    let mut msg = object::id_to_bytes(&object::id(market));
    vector::append(&mut msg, u64_be_bytes(price));
    vector::append(&mut msg, u64_be_bytes(timestamp_ms));
    msg
}

public(package) fun verify_signed_price(
    market: &Market,
    price: u64,
    timestamp_ms: u64,
    signature: vector<u8>,
    clock: &Clock,
): u64 {
    assert!(uses_signed_price(market), ENotSignedPriceMarket);
    let now = clock::timestamp_ms(clock);
    assert!(timestamp_ms <= now, EStalePrice);
    assert!(now - timestamp_ms <= market.max_price_staleness_secs * 1000, EStalePrice);
    let msg = price_report_message(market, price, timestamp_ms);
    assert!(
        ed25519::ed25519_verify(&signature, &market.price_signer, &msg),
        EInvalidPriceSignature
    );
    price
}

public fun is_paused(market: &Market): bool {
    market.paused
}

public fun max_price_staleness_secs(market: &Market) : u64 {
    market.max_price_staleness_secs
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

public fun min_position_size(market : &Market) : u64 {
    market.min_position_size
}

public fun demo_mode(market : &Market) : bool {
    market.demo_mode
}

public fun cumulative_funding_long_credit(market : &Market) : u128 {
    market.cumulative_funding_long_credit
}

public fun cumulative_funding_short_credit(market : &Market) : u128{
    market.cumulative_funding_short_credit
}

public fun cumulative_funding_long_charge(market : &Market) : u128 {
    market.cumulative_funding_long_charge
}

public fun cumulative_funding_short_charge(market : &Market) : u128{
    market.cumulative_funding_short_charge
}

public fun last_funding_time(market : &Market) : u64 {
    market.last_funding_time
}

public fun funding_rate_bps_per_hour(market : &Market) : u64 {
    market.funding_rate_bps_per_hour
}

public fun liquidation_penalty_bps(market : &Market) : u64 {
    market.liquidation_penalty_bps
}

public fun keeper_reward_bps(market : &Market) : u64 {
    market.keeper_reward_bps
}