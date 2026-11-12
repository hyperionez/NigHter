#[test_only]
module perp_dex::market_tests;

use sui::test_scenario::{Self as ts};
use perp_dex::admin;
use perp_dex::market::{Self, Market, DemoPriceCap};
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
    1000,
    500,
    10,
    10,
    1_000_000,
    100,
    false,
    50_000,
    b"", b"BTC_PERP_FEED_ID",
    60,
    10,
    &clock,
    100,
    50,
    scenario.ctx()
    );

    scenario.next_tx(ADMIN);
    {
        let market = scenario.take_shared<Market>();
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



#[test, expected_failure(abort_code = 1)]
fun create_market_rejects_invalid_margin_config() {
    let mut scenario = ts::begin(ADMIN);
    let admin_cap = admin::mint_for_testing(scenario.ctx());
    let mut clock = clock::create_for_testing(scenario.ctx());
    market::create_market(
    &admin_cap,
    b"BTC_PERP",
    400,
    500,
    10,
    10,
    1_000_000,
    100,
    false,
    50_000,
    b"", b"BTC_PERP_FEED_ID",
    60,
    10,
    &clock,
    100,
    50,
    scenario.ctx()
    );

    transfer::public_transfer(admin_cap, ADMIN);
    clock::destroy_for_testing(clock);
    scenario.end();
}


#[test, expected_failure(abort_code = 1)]
fun create_market_rejects_close_fee_exceeding_maintenance_margin() {
    let mut scenario = ts::begin(ADMIN);
    let admin_cap = admin::mint_for_testing(scenario.ctx());
    let mut clock = clock::create_for_testing(scenario.ctx());
    market::create_market(
    &admin_cap,
    b"BTC_PERP",
    1000,
    500,    
    10,
    500,    
    1_000_000,
    100,
    false,
    50_000,
    b"", b"BTC_PERP_FEED_ID",
    60,
    10,
    &clock,
    100,
    50,
    scenario.ctx()
    );

    transfer::public_transfer(admin_cap, ADMIN);
    clock::destroy_for_testing(clock);
    scenario.end();
}
#[test]
fun demo_price_cap_can_move_mock_price() {
    let mut scenario = ts::begin(ADMIN);
    let admin_cap = admin::mint_for_testing(scenario.ctx());
    let clock = clock::create_for_testing(scenario.ctx());
    market::create_market(
        &admin_cap,
        b"BTC_PERP",
        1000, 500, 10, 10,
        1_000_000,
        100,
        true,
        50_000,
        b"", b"BTC_PERP_FEED_ID",
        60, 10, &clock, 100, 50,
        scenario.ctx()
    );

    scenario.next_tx(ADMIN);
    {
        let market = scenario.take_shared<Market>();
        market::mint_demo_price_cap(&market, &admin_cap, ADMIN, scenario.ctx());
        ts::return_shared(market);
    };

    scenario.next_tx(ADMIN);
    {
        let mut market = scenario.take_shared<Market>();
        let cap = scenario.take_from_sender<DemoPriceCap>();
        market::set_demo_price(&mut market, &cap, 61_000, &clock);
        assert!(market::mock_price(&market) == 61_000, 0);
        transfer::public_transfer(cap, ADMIN);
        ts::return_shared(market);
    };

    transfer::public_transfer(admin_cap, ADMIN);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test, expected_failure(abort_code=5)]
fun mint_demo_price_cap_rejects_non_demo_market() {
    let mut scenario = ts::begin(ADMIN);
    let admin_cap = admin::mint_for_testing(scenario.ctx());
    let clock = clock::create_for_testing(scenario.ctx());
    market::create_market(
        &admin_cap,
        b"BTC_PERP",
        1000, 500, 10, 10,
        1_000_000,
        100,
        false,
        50_000,
        b"", b"BTC_PERP_FEED_ID",
        60, 10, &clock, 100, 50,
        scenario.ctx()
    );

    scenario.next_tx(ADMIN);
    {
        let market = scenario.take_shared<Market>();
        market::mint_demo_price_cap(&market, &admin_cap, ADMIN, scenario.ctx());
        ts::return_shared(market);
    };

    transfer::public_transfer(admin_cap, ADMIN);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test, expected_failure(abort_code=5)]
fun set_mock_price_rejects_non_demo_market() {
    let mut scenario = ts::begin(ADMIN);
    let admin_cap = admin::mint_for_testing(scenario.ctx());
    let clock = clock::create_for_testing(scenario.ctx());
    market::create_market(
        &admin_cap,
        b"BTC_PERP",
        1000, 500, 10, 10,
        1_000_000,
        100,
        false,
        50_000,
        b"", b"BTC_PERP_FEED_ID",
        60, 10, &clock, 100, 50,
        scenario.ctx()
    );

    scenario.next_tx(ADMIN);
    {
        let risk_cap = admin::mint_risk_cap_for_testing(scenario.ctx());
        let mut market = scenario.take_shared<Market>();
        market::set_mock_price(&mut market, &risk_cap, 61_000, &clock);
        ts::return_shared(market);
        transfer::public_transfer(risk_cap, ADMIN);
    };

    transfer::public_transfer(admin_cap, ADMIN);
    clock::destroy_for_testing(clock);
    scenario.end();
}

const SIGNER_PUBKEY: vector<u8> = x"79b5562e8fe654f94078b112e8a98ba7901f853ae695bed7e0e3910bad049664";

#[test, expected_failure(abort_code = perp_dex::market::ENotManualPriceMarket)]
fun set_mock_price_rejects_signed_market() {
    let mut scenario = ts::begin(ADMIN);
    let admin_cap = admin::mint_for_testing(scenario.ctx());
    let clock = clock::create_for_testing(scenario.ctx());
    market::create_market(
        &admin_cap,
        b"BTC_PERP",
        1000, 500, 10, 10,
        1_000_000,
        100,
        true,
        50_000,
        SIGNER_PUBKEY, b"BTC_PERP_FEED_ID",
        60, 10, &clock, 100, 50,
        scenario.ctx()
    );

    scenario.next_tx(ADMIN);
    {
        let risk_cap = admin::mint_risk_cap_for_testing(scenario.ctx());
        let mut market = scenario.take_shared<Market>();
        market::set_mock_price(&mut market, &risk_cap, 61_000, &clock);
        ts::return_shared(market);
        transfer::public_transfer(risk_cap, ADMIN);
    };

    transfer::public_transfer(admin_cap, ADMIN);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test, expected_failure(abort_code = perp_dex::market::ENotManualPriceMarket)]
fun mint_demo_price_cap_rejects_signed_market() {
    let mut scenario = ts::begin(ADMIN);
    let admin_cap = admin::mint_for_testing(scenario.ctx());
    let clock = clock::create_for_testing(scenario.ctx());
    market::create_market(
        &admin_cap,
        b"BTC_PERP",
        1000, 500, 10, 10,
        1_000_000,
        100,
        true,
        50_000,
        SIGNER_PUBKEY, b"BTC_PERP_FEED_ID",
        60, 10, &clock, 100, 50,
        scenario.ctx()
    );

    scenario.next_tx(ADMIN);
    {
        let market = scenario.take_shared<Market>();
        market::mint_demo_price_cap(&market, &admin_cap, ADMIN, scenario.ctx());
        ts::return_shared(market);
    };

    transfer::public_transfer(admin_cap, ADMIN);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test, expected_failure(abort_code = perp_dex::market::ENotManualPriceMarket)]
fun set_demo_price_rejects_market_flipped_to_signed() {
    let mut scenario = ts::begin(ADMIN);
    let admin_cap = admin::mint_for_testing(scenario.ctx());
    let clock = clock::create_for_testing(scenario.ctx());
    market::create_market(
        &admin_cap,
        b"BTC_PERP",
        1000, 500, 10, 10,
        1_000_000,
        100,
        true,
        50_000,
        b"", b"BTC_PERP_FEED_ID",
        60, 10, &clock, 100, 50,
        scenario.ctx()
    );

    scenario.next_tx(ADMIN);
    {
        let market = scenario.take_shared<Market>();
        market::mint_demo_price_cap(&market, &admin_cap, ADMIN, scenario.ctx());
        ts::return_shared(market);
    };

    scenario.next_tx(ADMIN);
    {
        let mut market = scenario.take_shared<Market>();
        market::set_price_signer(&mut market, &admin_cap, SIGNER_PUBKEY);
        ts::return_shared(market);
    };

    scenario.next_tx(ADMIN);
    {
        let mut market = scenario.take_shared<Market>();
        let cap = scenario.take_from_sender<DemoPriceCap>();
        market::set_demo_price(&mut market, &cap, 61_000, &clock);
        transfer::public_transfer(cap, ADMIN);
        ts::return_shared(market);
    };

    transfer::public_transfer(admin_cap, ADMIN);
    clock::destroy_for_testing(clock);
    scenario.end();
}
