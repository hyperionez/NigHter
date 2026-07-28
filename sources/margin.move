module perp_dex::margin;

use perp_dex::math;


public fun calculate_pnl(entry_price : u64,
current_price: u64,
size:u64,
is_long:bool) : (bool, u64){
    let is_profit = (is_long && current_price >= entry_price) || (!is_long && current_price <= entry_price);
    let price_diff = if (current_price >= entry_price) {
        current_price - entry_price
    } else {
        entry_price - current_price
    };
    let pnl = math::mul_div(size, price_diff, entry_price);
    (is_profit, pnl)
}

public fun calculate_margin_ratio(collateral : u64, is_profit : bool, pnl : u64, size: u64) : (bool, u64){
    if(!is_profit && pnl >= collateral){
        (false, 0)
    } else {
        let equity = if (is_profit) {
            collateral + pnl
        } else {
            collateral - pnl
        };
        (true, math::mul_div(equity, 10_000, size))
    }
}

public fun is_liquidatable(collateral : u64, is_profit : bool, pnl : u64, size : u64, maintenance_margin_bps : u64) : bool{
    let (is_solvent, margin_ratio_bps) = calculate_margin_ratio(collateral, is_profit, pnl, size);
    !is_solvent || margin_ratio_bps < maintenance_margin_bps
}

public fun calculate_liquidation_price(collateral : u64, entry_price : u64,size : u64, is_long : bool, maintenance_margin_bps : u64) : u64 {
    let term1 = math::mul_div(entry_price , collateral ,size);
    let term2 = math::mul_div(entry_price, maintenance_margin_bps, 10_000);
    let mut liq_price : u64 = 0;
    if (is_long) {
        liq_price = entry_price - term1;
        liq_price = liq_price + term2;
    } else {
        liq_price = entry_price + term1;
        liq_price = liq_price - term2;
    };
    liq_price
}