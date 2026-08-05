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
        let (majority_oi, minority_oi) = if (long_oi > short_oi) {
            (long_oi, short_oi)
        } else {
            (short_oi, long_oi)
        };

        if(long_oi > short_oi) {
            market::add_funding_index_long_charge(market, index_delta);
        } else {
            market::add_funding_index_short_charge(market, index_delta);
        };

        if(minority_oi > 0) {
            let credit_delta = index_delta * (majority_oi as u128) / (minority_oi as u128);
            if (long_oi > short_oi) {
                market::add_funding_index_short_credit(market, credit_delta);
            } else {
                market::add_funding_index_long_credit(market, credit_delta);
            };
        };
    };
    market::set_last_funding_time(market, now);
}

public(package) fun funding_settlement(
    market : &Market,
    is_long : bool,
    entry_charge_index : u128,
    entry_credit_index : u128,
    size :u64
) : (bool, u64) {
    let (current_charge, current_credit) = if (is_long) {
        (market::cumulative_funding_long_charge(market), market::cumulative_funding_long_credit(market))
    } else {
        (market::cumulative_funding_short_charge(market), market::cumulative_funding_short_credit(market))
    };
    let charge_delta = current_charge - entry_charge_index;
    let credit_delta = current_credit - entry_credit_index;

    let charge_amount = math::mul_div_round_up(size, charge_delta, FUNDING_INDEX_PRECISION);
    let credit_amount = (((size as u128) * credit_delta) / FUNDING_INDEX_PRECISION) as u64;

    if (charge_amount >= credit_amount) {
        (true, charge_amount - credit_amount)
    } else {
        (false, credit_amount - charge_amount)
    }

}