module perp_dex::funding;

use sui::clock::{Clock, Self};
use perp_dex::market::Market;
use perp_dex::market;
use perp_dex::math;

const FUNDING_INDEX_PRECISION : u128 = 1_000_000_000;
const MS_PER_HOUR : u128 = 3_600_000;

public(package) fun settle_funding(market : &mut Market, clock : &Clock){
    let now = clock::timestamp_ms(clock);
    let elapsed = now - market::last_funding_time(market);
    if (elapsed == 0){
        return
    };
    let long_oi = market::long_open_interest(market);
    let short_oi = market::short_open_interest(market);
    if(long_oi != short_oi){
        let rate_bps = market::funding_rate_bps_per_hour(market);
        
        let oi_diff = if(long_oi > short_oi) {
            long_oi - short_oi
        } else {
            short_oi - long_oi
        };
        let total_oi = long_oi + short_oi;
        let skew_bps = math::mul_div(oi_diff, 10_000, total_oi);
        let effective_rate_bps = rate_bps * skew_bps / 10_000;
        let index_delta = ((effective_rate_bps as u128) * (elapsed as u128)) * FUNDING_INDEX_PRECISION / (10_000 * MS_PER_HOUR);
        if(long_oi > short_oi) {
            market::add_funding_index_long(market, index_delta);
        } else {
            market::add_funding_index_short(market, index_delta);
        };
    };
    market::set_last_funding_time(market, now);
}

public(package) fun funding_owed(market : &Market,
    is_long : bool,
    entry_index : u128,
    size :u64
) : u64 {
    let current_index = if(is_long) {
        market::cumulative_funding_long(market)
    } else {
        market::cumulative_funding_short(market)
    };
    let index_delta = current_index - entry_index;
    math::mul_div_round_up(size, index_delta, FUNDING_INDEX_PRECISION)
}