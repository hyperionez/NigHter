#[test_only]
module perp_dex::market_tests;

use sui::test_scenario::{Self as ts};
use perp_dex::admin;
use perp_dex::market::{Self, Market};
use sui::clock::{Self, Clock};

const ADMIN: address = @0xA;

#[test]
fun create_market_sets_all_parameters_correctly() {
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
    scenario.ctx()
    );

    scenario.next_tx(ADMIN);
    {
        let market = scenario.take_shared<Market>();
        assert!(market::max_leverage(&market) == 20, 0);
        assert!(market::initial_margin_bps(&market) == 1000, 1);
        assert!(market::maintenance_margin_bps(&market) == 500, 2);
        assert!(market::mock_price(&market) == 50_000, 3);
        assert!(market::is_paused(&market) == false, 4);
        ts::return_shared(market);
    };
    transfer::public_transfer(admin_cap, ADMIN);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test, expected_failure(abort_code = 0)]
fun create_market_rejects_zero_leverage() {
    let mut scenario = ts::begin(ADMIN);
    let admin_cap = admin::mint_for_testing(scenario.ctx());
    let mut clock = clock::create_for_testing(scenario.ctx());
    market::create_market(
    &admin_cap,
    b"BTC_PERP",
    0,
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
    scenario.ctx()
    );

    transfer::public_transfer(admin_cap, ADMIN);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test, expected_failure(abort_code = 1)]
fun create_market_rejects_invalid_margin_config() {
    let mut scenario = ts::begin(ADMIN);
    let admin_cap = admin::mint_for_testing(scenario.ctx());
    let mut clock = clock::create_for_testing(scenario.ctx());
    market::create_market(
    &admin_cap,
    b"BTC_PERP",
    20,
    400,
    500,
    10,
    10,
    1_000_000,
    50_000,
    b"BTC_PERP_FEED_ID",
    60,
    10,
    &clock,
    scenario.ctx()
    );

    transfer::public_transfer(admin_cap, ADMIN);
    clock::destroy_for_testing(clock);
    scenario.end();
}