#[test_only]
module perp_dex::oracle_tests;

use sui::test_scenario::{Self as ts};
use pyth::price;
use pyth::i64;
use perp_dex::oracle::validate_and_scale;
use perp_dex::market::{Market, Self};
use perp_dex::admin;
use sui::clock::{Self, Clock};

const ADMIN : address = @0xA;

#[test]
public fun successfull_get_validated_price(){
    let mut scenario = ts::begin(ADMIN);
    let admin_cap = admin::mint_for_testing(scenario.ctx());
    let mut clock = clock::create_for_testing(scenario.ctx());
    market::create_market(&admin_cap,
     b"BTC-PERP",
     20,    
     1000,
     500,
     10,
     10,
     1_000_000,
     50_000,
     b"BTC_PERP_FEED_ID",
     60,
     10,
     &clock,
     100,
     50,
     scenario.ctx());
     scenario.next_tx(ADMIN);
    {
        let mrkt = scenario.take_shared<Market>();
        assert!(market::max_leverage(&mrkt) == 20, 0);
        assert!(market::initial_margin_bps(&mrkt) == 1000, 1);
        assert!(market::maintenance_margin_bps(&mrkt) == 500, 2);
        assert!(market::mock_price(&mrkt) == 50_000, 3);
        assert!(market::is_paused(&mrkt) == false, 4);
        let fake_price = price::new(
            i64::new(350_000_000, false),  
            0,                              
            i64::new(8, true),               
        1000                              
        );
        let feed_id_bytes = b"BTC_PERP_FEED_ID";
        validate_and_scale(&mrkt, feed_id_bytes, fake_price);
        ts::return_shared(mrkt);
    };
    transfer::public_transfer(admin_cap, ADMIN);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test, expected_failure(abort_code=1)]
fun mismatch_feed_id(){
    let mut scenario = ts::begin(ADMIN);
    let admin_cap = admin::mint_for_testing(scenario.ctx());
    let mut clock = clock::create_for_testing(scenario.ctx());
    market::create_market(
    &admin_cap,
    b"BTC_PERP",
    20,
    1000,
    500,
    10,
    10,
    1_000_000,
    50_000,
    b"BTC_PERP_FEED_ID",
    60,
    10,
    &clock,
    100,
    50,
    scenario.ctx()
    );
     scenario.next_tx(ADMIN);
    {
        let mrkt = scenario.take_shared<Market>();
        assert!(market::max_leverage(&mrkt) == 20, 0);
        assert!(market::initial_margin_bps(&mrkt) == 1000, 1);
        assert!(market::maintenance_margin_bps(&mrkt) == 500, 2);
        assert!(market::mock_price(&mrkt) == 50_000, 3);
        assert!(market::is_paused(&mrkt) == false, 4);
        let fake_price = price::new(
            i64::new(350_000_000, false),  
            0,                              
            i64::new(8, true),               
        1000                              
        );
        let feed_id_bytes = b"ETH_PERP_FEED_ID";
        validate_and_scale(&mrkt, feed_id_bytes, fake_price);
        ts::return_shared(mrkt);
    };
    transfer::public_transfer(admin_cap, ADMIN);
    clock::destroy_for_testing(clock);
    scenario.end();
}