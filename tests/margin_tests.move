#[test_only]
module perp_dex::margin_tests;

use sui::test_scenario::{Self as ts};

const ADMIN : address = @0xA;

#[test]
fun test_calculate_pnl(){
    let mut scenario = ts::begin(ADMIN);
    
}