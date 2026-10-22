#[test_only]
module perp_dex::admin_tests;

use sui::test_scenario::{Self as ts};
use sui::clock::{Self, Clock};
use sui::coin::{Self};
use perp_dex::admin::{Self, RiskCap, TreasurerCap};
use perp_dex::market::{Self, Market};
use perp_dex::treasury::{Self, Treasury};
use perp_dex::test_usdc::TEST_USDC;

const ADMIN: address = @0xA;
const RISK_OPERATOR: address = @0xB2;
const TREASURER: address = @0xB3;

fun create_demo_market(scenario: &mut ts::Scenario): Clock {
    let admin_cap = admin::mint_for_testing(scenario.ctx());
    let clock = clock::create_for_testing(scenario.ctx());
    market::create_market(
        &admin_cap,
        b"BTC-PERP",
        1000, 500, 10, 10,
        1_000_000, 100,
        true,
        50_000,
        b"BTC_PERP_FEED_ID",
        60, 10, &clock, 100, 50,
        scenario.ctx()
    );
    transfer::public_transfer(admin_cap, ADMIN);
    clock
}

#[test]
fun admin_delegates_risk_cap_to_a_separate_address() {
    let mut scenario = ts::begin(ADMIN);
    let clock = create_demo_market(&mut scenario);

    scenario.next_tx(ADMIN);
    {
        let admin_cap = scenario.take_from_sender<perp_dex::admin::AdminCap>();
        admin::mint_risk_cap(&admin_cap, RISK_OPERATOR, scenario.ctx());
        transfer::public_transfer(admin_cap, ADMIN);
    };

    scenario.next_tx(RISK_OPERATOR);
    {
        let risk_cap = scenario.take_from_sender<RiskCap>();
        let mut market = scenario.take_shared<Market>();
        market::set_paused(&mut market, &risk_cap, true);
        assert!(market::is_paused(&market), 0);
        market::set_mock_price(&mut market, &risk_cap, 61_000);
        assert!(market::mock_price(&market) == 61_000, 1);
        ts::return_shared(market);
        transfer::public_transfer(risk_cap, RISK_OPERATOR);
    };

    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
fun admin_delegates_treasurer_cap_to_a_separate_address() {
    let mut scenario = ts::begin(ADMIN);
    treasury::init_for_testing(scenario.ctx());
    let admin_cap = admin::mint_for_testing(scenario.ctx());

    scenario.next_tx(ADMIN);
    {
        let mut treasury = scenario.take_shared<Treasury>();
        let payment = coin::mint_for_testing<TEST_USDC>(1_000, scenario.ctx());
        treasury::deposit(&mut treasury, payment);
        ts::return_shared(treasury);
    };

    scenario.next_tx(ADMIN);
    {
        admin::mint_treasurer_cap(&admin_cap, TREASURER, scenario.ctx());
    };

    scenario.next_tx(TREASURER);
    {
        let treasurer_cap = scenario.take_from_sender<TreasurerCap>();
        let mut treasury = scenario.take_shared<Treasury>();
        let payout = treasury::withdraw_treasury(&mut treasury, &treasurer_cap, 400, scenario.ctx());
        assert!(coin::value(&payout) == 400, 0);
        assert!(treasury::total_balance(&treasury) == 600, 1);
        transfer::public_transfer(payout, TREASURER);
        ts::return_shared(treasury);
        transfer::public_transfer(treasurer_cap, TREASURER);
    };

    transfer::public_transfer(admin_cap, ADMIN);
    scenario.end();
}

#[test]
fun risk_cap_holder_can_surrender_it() {
    let mut scenario = ts::begin(ADMIN);
    let admin_cap = admin::mint_for_testing(scenario.ctx());

    scenario.next_tx(ADMIN);
    {
        admin::mint_risk_cap(&admin_cap, RISK_OPERATOR, scenario.ctx());
    };

    scenario.next_tx(RISK_OPERATOR);
    {
        let risk_cap = scenario.take_from_sender<RiskCap>();
        admin::burn_risk_cap(risk_cap);
    };

    scenario.next_tx(RISK_OPERATOR);
    {
        assert!(!ts::has_most_recent_for_sender<RiskCap>(&scenario), 0);
    };

    transfer::public_transfer(admin_cap, ADMIN);
    scenario.end();
}

#[test]
fun treasurer_cap_holder_can_surrender_it() {
    let mut scenario = ts::begin(ADMIN);
    let admin_cap = admin::mint_for_testing(scenario.ctx());

    scenario.next_tx(ADMIN);
    {
        admin::mint_treasurer_cap(&admin_cap, TREASURER, scenario.ctx());
    };

    scenario.next_tx(TREASURER);
    {
        let treasurer_cap = scenario.take_from_sender<TreasurerCap>();
        admin::burn_treasurer_cap(treasurer_cap);
    };

    scenario.next_tx(TREASURER);
    {
        assert!(!ts::has_most_recent_for_sender<TreasurerCap>(&scenario), 0);
    };

    transfer::public_transfer(admin_cap, ADMIN);
    scenario.end();
}
