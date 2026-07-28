#[test_only]
module perp_dex::margin_tests;

use perp_dex::margin;

#[test]
fun test_calculate_pnl(){
    let (is_profit, pnl) = margin::calculate_pnl(
        50_000,
         55_000,
          10_000*10,
           true);
    assert!(is_profit == true, 0);
    assert!(pnl == 10_000, 1);
}

#[test]
fun test_calculate_margin_pnl(){
    let (_, pnl) = margin::calculate_pnl(
        50_000,
        55_000,
        100_000, true );
    let (is_solvent, margin_ratio_bps) = margin::calculate_margin_ratio(
        10_000,
        true,
        pnl,
        100_000
    );
    assert!(is_solvent == true, 0);
    assert!(margin_ratio_bps == 2000, 1);
}

#[test]
fun test_is_liquidatable(){
    let (is_profit, pnl) = margin::calculate_pnl(
        50_000,
        45_000,
        100_000,
        true
    );
    assert!(!is_profit, 0);
    let is_liquidatable = margin::is_liquidatable(
        10_000,
        false,
        pnl,
        100_000,
        500
    );
    assert!(is_liquidatable, 1);
}

#[test]
fun test_calculate_liquidation_price(){
    let liq_price = margin::calculate_liquidation_price(
        10_000,
        50_000,
        100_000,
        true,
        100
    );
    assert!(liq_price == 45_500, 0);
}