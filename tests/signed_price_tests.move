#[test_only]
module perp_dex::signed_price_tests;

use sui::test_scenario::{Self as ts};
use sui::clock::{Clock, Self};
use sui::coin::{Self};
use perp_dex::admin;
use perp_dex::treasury::{Self, Treasury};
use perp_dex::market::{Self, Market};
use perp_dex::vault::{Self, Vault};
use perp_dex::router;
use perp_dex::position::{Self, Position};
use perp_dex::test_usdc::TEST_USDC;

const ADMIN : address = @0xA;
const LP : address = @0xB1;
const TRADER : address = @0xC1;

const SIGNER_PUBKEY : vector<u8> = x"79b5562e8fe654f94078b112e8a98ba7901f853ae695bed7e0e3910bad049664";
const EXPECTED_MESSAGE : vector<u8> = x"a058cccb1180e0c063232bed5fcf330614d57c74f056f8b3db0317812e129eb200004a21912cab800000000000011170";
const VALID_SIGNATURE : vector<u8> = x"89fa6897e8185c3fb05b683f196e8f405babc0dac7ad47e0c1839d4cb6f219eef98a5418aa731cbde3164b825c0339ba57e23eac0ba10b036bd48dc86907d302";
const SIGNED_PRICE : u64 = 81508030000000;
const SIGNED_TIMESTAMP_MS : u64 = 70_000;
const NOW_MS : u64 = 100_000;

fun setup(scenario: &mut ts::Scenario, signer_pubkey: vector<u8>): Clock {
    treasury::init_for_testing(scenario.ctx());
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_cap = admin::mint_for_testing(scenario.ctx());
    market::create_market(&admin_cap,
     b"BTC-PERP", 1000, 500, 10, 10, 1_000_000, 100, true, 50_000,
     signer_pubkey, b"BTC_PERP_FEED_ID", 60, 10, &clock, 100, 50, scenario.ctx());
    scenario.next_tx(ADMIN);
    {
        let market = scenario.take_shared<Market>();
        vault::create_vault_for_market(&market, &admin_cap, scenario.ctx());
        ts::return_shared(market);
    };
    transfer::public_transfer(admin_cap, ADMIN);
    scenario.next_tx(LP);
    {
        let mut vault = scenario.take_shared<Vault>();
        let lp_payment = coin::mint_for_testing<TEST_USDC>(100_000, scenario.ctx());
        let receipt = vault::deposit_liquidity(&mut vault, lp_payment, scenario.ctx());
        transfer::public_transfer(receipt, LP);
        ts::return_shared(vault);
    };
    clock
}

fun open_signed(
    scenario: &mut ts::Scenario,
    clock: &Clock,
    price: u64,
    timestamp_ms: u64,
    signature: vector<u8>,
) {
    scenario.next_tx(TRADER);
    {
        let mut market = scenario.take_shared<Market>();
        let mut vault = scenario.take_shared<Vault>();
        let mut treasury = scenario.take_shared<Treasury>();
        let collateral = coin::mint_for_testing<TEST_USDC>(10_000, scenario.ctx());
        router::open_position_with_signed_price(
            &mut market, &mut vault, &mut treasury, collateral,
            true, 10, price, timestamp_ms, signature, clock, scenario.ctx()
        );
        ts::return_shared(market);
        ts::return_shared(vault);
        ts::return_shared(treasury);
    };
}

#[test]
fun message_encoding_is_stable(){
    let mut scenario = ts::begin(ADMIN);
    let clock = setup(&mut scenario, SIGNER_PUBKEY);
    scenario.next_tx(TRADER);
    {
        let market = scenario.take_shared<Market>();
        let msg = market::price_report_message(&market, SIGNED_PRICE, SIGNED_TIMESTAMP_MS);
        assert!(vector::length(&msg) == 48, 0);
        assert!(msg == EXPECTED_MESSAGE, 1);
        ts::return_shared(market);
    };
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
fun signed_price_is_accepted(){
    let mut scenario = ts::begin(ADMIN);
    let mut clock = setup(&mut scenario, SIGNER_PUBKEY);
    clock::increment_for_testing(&mut clock, NOW_MS);
    open_signed(&mut scenario, &clock, SIGNED_PRICE, SIGNED_TIMESTAMP_MS, VALID_SIGNATURE);
    scenario.next_tx(TRADER);
    {
        let p = scenario.take_shared<Position>();
        assert!(position::entry_price(&p) == SIGNED_PRICE, 0);
        assert!(position::size(&p) == 100_000, 1);
        ts::return_shared(p);
    };
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test, expected_failure(abort_code = perp_dex::market::EInvalidPriceSignature)]
fun tampered_price_is_rejected(){
    let mut scenario = ts::begin(ADMIN);
    let mut clock = setup(&mut scenario, SIGNER_PUBKEY);
    clock::increment_for_testing(&mut clock, NOW_MS);
    open_signed(&mut scenario, &clock, SIGNED_PRICE + 1, SIGNED_TIMESTAMP_MS, VALID_SIGNATURE);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test, expected_failure(abort_code = perp_dex::market::EInvalidPriceSignature)]
fun tampered_timestamp_is_rejected(){
    let mut scenario = ts::begin(ADMIN);
    let mut clock = setup(&mut scenario, SIGNER_PUBKEY);
    clock::increment_for_testing(&mut clock, NOW_MS);
    open_signed(&mut scenario, &clock, SIGNED_PRICE, SIGNED_TIMESTAMP_MS + 1, VALID_SIGNATURE);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test, expected_failure(abort_code = perp_dex::market::EStalePrice)]
fun stale_signed_price_is_rejected(){
    let mut scenario = ts::begin(ADMIN);
    let mut clock = setup(&mut scenario, SIGNER_PUBKEY);
    clock::increment_for_testing(&mut clock, SIGNED_TIMESTAMP_MS + 61_000);
    open_signed(&mut scenario, &clock, SIGNED_PRICE, SIGNED_TIMESTAMP_MS, VALID_SIGNATURE);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test, expected_failure(abort_code = perp_dex::market::ENotSignedPriceMarket)]
fun signed_entrypoint_rejects_manual_market(){
    let mut scenario = ts::begin(ADMIN);
    let mut clock = setup(&mut scenario, b"");
    clock::increment_for_testing(&mut clock, NOW_MS);
    open_signed(&mut scenario, &clock, SIGNED_PRICE, SIGNED_TIMESTAMP_MS, VALID_SIGNATURE);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test, expected_failure(abort_code = perp_dex::market::ENotManualPriceMarket)]
fun mock_entrypoint_rejects_signed_market(){
    let mut scenario = ts::begin(ADMIN);
    let clock = setup(&mut scenario, SIGNER_PUBKEY);
    scenario.next_tx(TRADER);
    {
        let mut market = scenario.take_shared<Market>();
        let mut vault = scenario.take_shared<Vault>();
        let mut treasury = scenario.take_shared<Treasury>();
        let collateral = coin::mint_for_testing<TEST_USDC>(10_000, scenario.ctx());
        router::open_position_with_mock_price(
            &mut market, &mut vault, &mut treasury, collateral,
            true, 10, &clock, scenario.ctx()
        );
        ts::return_shared(market);
        ts::return_shared(vault);
        ts::return_shared(treasury);
    };
    clock::destroy_for_testing(clock);
    scenario.end();
}
