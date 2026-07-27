module perp_dex::oracle;

use perp_dex::market::{Market, Self};
use pyth::pyth;
use pyth::i64;
use pyth::price_info::PriceInfoObject;
use pyth::price_info;
use pyth::price_identifier;
use pyth::price;
use sui::math;
use std::u64;

const PRICE_DECIMALS :u8 = 9;

const EInvalidID : u64 = 1;
const ENegativePrice : u64 = 2;
const EUnexpectedExpoSign : u64 = 3;

public fun get_validated_price(
    market: &Market,
    price_info_object: &PriceInfoObject,
    clock: &sui::clock::Clock
) : u64 {
    let max_age = market::max_price_stanless_secs(market);
    let price_struct = pyth::get_price_no_older_than(price_info_object, clock, max_age);
    let price_info = price_info::get_price_info_from_price_info_object(price_info_object);
    let price_id = price_identifier::get_bytes(&price_info::get_price_identifier(&price_info));
    validate_and_scale(market, price_id, price_struct)
}

public fun validate_and_scale(market: &Market, price_id: vector<u8>, price_struct: price::Price): u64 {
    assert!(price_id == market::pyth_price_feed_id(market), EInvalidID);
    let price_i64 = price::get_price(&price_struct);
    assert!(!i64::get_is_negative(&price_i64), ENegativePrice);
    let magnitude = i64::get_magnitude_if_positive(&price_i64);
    let expo_i64 = price::get_expo(&price_struct);
    assert!(i64::get_is_negative(&expo_i64), EUnexpectedExpoSign);
    let expo_magnitude = i64::get_magnitude_if_negative(&expo_i64);
    if (expo_magnitude <= (PRICE_DECIMALS as u64)) {
        magnitude * math::pow(10, PRICE_DECIMALS - (expo_magnitude as u8))
    } else {
        magnitude / math::pow(10, (expo_magnitude as u8) - PRICE_DECIMALS)
    }
}