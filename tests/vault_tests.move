#[test_only]
module perp_dex::vault_tests;

use sui::test_scenario::{Self as ts};
use sui::coin;
use perp_dex::vault::{Self, Vault, LpReceipt};
use perp_dex::test_usdc::TEST_USDC;
use perp_dex::admin;
use perp_dex::market::{Self,Market};
use perp_dex::router;
use perp_dex::treasury::{Self, Treasury};
use sui::clock;

const ADMIN: address = @0xA;
const LP_ONE: address = @0xB1;
const LP_TWO: address = @0xB2;
const TRADER: address = @0xC1;

#[test]
fun deposit_then_withdraw_returns_full_amount() {
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
        b"BTC_PERP_FEED_ID",
        60,
        10,
        &clock,
        100, 50, scenario.ctx()
    );
    scenario.next_tx(LP_ONE);
    {
        let market = scenario.take_shared<Market>();
        vault::init_for_testing(object::id(&market) ,scenario.ctx());
        ts::return_shared(market);
    };  

    scenario.next_tx(LP_ONE);
    {
        let mut vault = scenario.take_shared<Vault>();
        let payment = coin::mint_for_testing<TEST_USDC>(1_000, scenario.ctx());
        let receipt = vault::deposit_liquidity(&mut vault, payment, scenario.ctx());
        assert!(vault::shares(&receipt) == 1_000, 0);
        assert!(vault::total_balance(&vault) == 1_000, 1);
        transfer::public_transfer(receipt, LP_ONE);
        ts::return_shared(vault);
    };

    scenario.next_tx(LP_ONE);
    {
        let mut vault = scenario.take_shared<Vault>();
        let receipt = scenario.take_from_sender<LpReceipt>();
        let market = scenario.take_shared<Market>();
        let payout = vault::withdraw_liquidity(&mut vault, &market,receipt, scenario.ctx());
        assert!(coin::value(&payout) == 1_000, 2);
        assert!(vault::total_balance(&vault) == 0, 3);
        assert!(vault::lp_supply(&vault) == 0, 4);
        transfer::public_transfer(payout, LP_ONE);
        transfer::public_transfer(admin_cap, ADMIN);
        ts::return_shared(vault);
        ts::return_shared(market);
    };

    clock::destroy_for_testing(clock);


    scenario.end();
}

#[test]
fun second_lp_gets_proportional_shares() {
    let mut scenario = ts::begin(ADMIN);
    vault::init_for_testing(object::id_from_address(@0xCAFE), scenario.ctx());

    scenario.next_tx(LP_ONE);
    {
        let mut vault = scenario.take_shared<Vault>();
        let payment = coin::mint_for_testing<TEST_USDC>(1_000, scenario.ctx());
        let receipt = vault::deposit_liquidity(&mut vault, payment, scenario.ctx());
        assert!(vault::shares(&receipt) == 1_000, 0);
        transfer::public_transfer(receipt, LP_ONE);
        ts::return_shared(vault);
    };

   
    scenario.next_tx(LP_TWO);
    {
        let mut vault = scenario.take_shared<Vault>();
        let payment = coin::mint_for_testing<TEST_USDC>(500, scenario.ctx());
        let receipt = vault::deposit_liquidity(&mut vault, payment, scenario.ctx());
        assert!(vault::shares(&receipt) == 500, 5);
        assert!(vault::lp_supply(&vault) == 1_500, 6);
        assert!(vault::total_balance(&vault) == 1_500, 7);
        transfer::public_transfer(receipt, LP_TWO);
        ts::return_shared(vault);
    };

    scenario.end();
}

#[test, expected_failure(abort_code = 0)]
fun deposit_zero_amount_aborts() {
    let mut scenario = ts::begin(ADMIN);
    vault::init_for_testing(object::id_from_address(@0xCAFE), scenario.ctx());

    scenario.next_tx(LP_ONE);
    {
        let mut vault = scenario.take_shared<Vault>();
        let payment = coin::mint_for_testing<TEST_USDC>(0, scenario.ctx());
        let receipt = vault::deposit_liquidity(&mut vault, payment, scenario.ctx());
        transfer::public_transfer(receipt, LP_ONE);
        ts::return_shared(vault);
    };

    scenario.end();
}


#[test, expected_failure(abort_code =3)]
fun withdraw_blocked_by_open_interest(){
    let mut scenario = ts::begin(ADMIN);
    let admin_cap = admin::mint_for_testing(scenario.ctx());
    let clock = clock::create_for_testing(scenario.ctx());
    market::create_market(
        &admin_cap,
        b"BTC_PERP",
        1000, 50, 10, 10,
        1_000_000,
        100,
        false,
        50_000,
        b"BTC_PERP_FEED_ID",
        60, 10,
        &clock,
        100, 50,
        scenario.ctx()
    );
    treasury::init_for_testing(scenario.ctx());
    scenario.next_tx(LP_ONE);
    {
        let market = scenario.take_shared<Market>();
        vault::init_for_testing(object::id(&market), scenario.ctx());
        ts::return_shared(market);
    };
    
    scenario.next_tx(LP_ONE);
    {
        let mut vault = scenario.take_shared<Vault>();
        let payment = coin::mint_for_testing<TEST_USDC>(100_000, scenario.ctx());
        let receipt = vault::deposit_liquidity(&mut vault, payment, scenario.ctx());
        transfer::public_transfer( receipt, LP_ONE);
        ts::return_shared(vault);
    };

    scenario.next_tx(TRADER);
    {
        let mut vault = scenario.take_shared<Vault>();
        let mut market = scenario.take_shared<Market>();
        let mut treasury = scenario.take_shared<Treasury>();
        let collateral = coin::mint_for_testing<TEST_USDC>(1_000, scenario.ctx());
        router::open_position_at_price(
            &mut market, &mut vault, &mut treasury, collateral, true, 10, 50_000, &clock, scenario.ctx()
        );
        ts::return_shared(market);
        ts::return_shared(treasury);
        ts::return_shared(vault);
    };


    scenario.next_tx(LP_ONE);
    {
        let mut vault = scenario.take_shared<Vault>();
        let market = scenario.take_shared<Market>();
        let receipt = scenario.take_from_sender<LpReceipt>();
        let payout = vault::withdraw_liquidity(&mut vault, &market, receipt, scenario.ctx());
        transfer::public_transfer(payout, LP_ONE);
        ts::return_shared(vault);
        ts::return_shared(market);
    };

    transfer::public_transfer(admin_cap, ADMIN);
    clock::destroy_for_testing(clock);
    scenario.end();
}


#[test]
fun withdraw_succeds_when_free_liquidity_covers_it(){
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
        b"BTC_PERP_FEED_ID",
        60,
        10,
        &clock,
        100,
        50,
        scenario.ctx()
    );
    treasury::init_for_testing(scenario.ctx());

    scenario.next_tx(LP_ONE);
    {
        let market = scenario.take_shared<Market>();
        vault::init_for_testing(object::id(&market), scenario.ctx());
        ts::return_shared(market);
    };

    scenario.next_tx(LP_ONE);
    {
        let mut vault = scenario.take_shared<Vault>();
        let payment = coin::mint_for_testing<TEST_USDC>(100_000, scenario.ctx());
        let receipt = vault::deposit_liquidity(&mut vault, payment, scenario.ctx());
        transfer::public_transfer(receipt, LP_ONE);
        ts::return_shared(vault);
    };

    scenario.next_tx(LP_TWO);
    {
        let mut vault = scenario.take_shared<Vault>();
        let payment = coin::mint_for_testing<TEST_USDC>(20_000, scenario.ctx());
        let receipt = vault::deposit_liquidity(&mut vault, payment, scenario.ctx());
        transfer::public_transfer(receipt, LP_TWO);
        ts::return_shared(vault);
    };

    scenario.next_tx(TRADER);
    {
        let mut market = scenario.take_shared<Market>();
        let mut vault = scenario.take_shared<Vault>();
        let mut treasury = scenario.take_shared<Treasury>();
        let collateral = coin::mint_for_testing(1_000, scenario.ctx());
        router::open_position_at_price(
            &mut market, &mut vault, &mut treasury,
            collateral, true, 10, 50_000, &clock, scenario.ctx()
        );
        ts::return_shared(market);
        ts::return_shared(vault);
        ts::return_shared(treasury);
    };

    scenario.next_tx(LP_TWO);
    {
        let mut vault = scenario.take_shared<Vault>();
        let market = scenario.take_shared<Market>();
        let receipt = scenario.take_from_sender<LpReceipt>();
        let payout = vault::withdraw_liquidity(
            &mut vault, &market, receipt, scenario.ctx()
        );
        assert!(coin::value(&payout) > 0, 10);
        assert!(vault::total_balance(&vault) >= market::long_open_interest(&market), 11);
        transfer::public_transfer(payout, LP_TWO);
        ts::return_shared(vault);
        ts::return_shared(market);
    };

    transfer::public_transfer(admin_cap, ADMIN);
    clock::destroy_for_testing(clock);
    scenario.end();
}
#[test_only]
fun setup_vault(scenario: &mut ts::Scenario): sui::clock::Clock {
    let admin_cap = admin::mint_for_testing(scenario.ctx());
    let clock = clock::create_for_testing(scenario.ctx());
    market::create_market(
        &admin_cap,
        b"BTC_PERP",
        1000, 500, 10, 10,
        1_000_000, 100, false, 50_000,
        b"BTC_PERP_FEED_ID",
        60, 10, &clock, 100, 50,
        scenario.ctx()
    );
    treasury::init_for_testing(scenario.ctx());
    transfer::public_transfer(admin_cap, ADMIN);
    scenario.next_tx(LP_ONE);
    {
        let market = scenario.take_shared<Market>();
        vault::init_for_testing(object::id(&market), scenario.ctx());
        ts::return_shared(market);
    };
    clock
}

#[test]
fun split_receipt_enables_partial_withdrawal() {
    let mut scenario = ts::begin(ADMIN);
    let clock = setup_vault(&mut scenario);

    scenario.next_tx(LP_ONE);
    {
        let mut vault = scenario.take_shared<Vault>();
        let payment = coin::mint_for_testing<TEST_USDC>(10_000, scenario.ctx());
        let receipt = vault::deposit_liquidity(&mut vault, payment, scenario.ctx());
        transfer::public_transfer(receipt, LP_ONE);
        ts::return_shared(vault);
    };

    scenario.next_tx(LP_ONE);
    {
        let mut vault = scenario.take_shared<Vault>();
        let market = scenario.take_shared<Market>();
        let mut receipt = scenario.take_from_sender<LpReceipt>();
        let part = vault::split_receipt(&mut receipt, 3_000, scenario.ctx());
        assert!(vault::shares(&part) == 3_000, 0);
        assert!(vault::shares(&receipt) == 7_000, 1);

        let payout = vault::withdraw_liquidity(&mut vault, &market, part, scenario.ctx());
        assert!(coin::value(&payout) == 3_000, 2);
        assert!(vault::total_balance(&vault) == 7_000, 3);
        assert!(vault::lp_supply(&vault) == 7_000, 4);
        assert!(vault::shares(&receipt) == 7_000, 5);

        transfer::public_transfer(payout, LP_ONE);
        transfer::public_transfer(receipt, LP_ONE);
        ts::return_shared(market);
        ts::return_shared(vault);
    };

    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
fun merge_receipt_combines_two_deposits() {
    let mut scenario = ts::begin(ADMIN);
    let clock = setup_vault(&mut scenario);

    scenario.next_tx(LP_ONE);
    {
        let mut vault = scenario.take_shared<Vault>();
        let first = coin::mint_for_testing<TEST_USDC>(4_000, scenario.ctx());
        let receipt_one = vault::deposit_liquidity(&mut vault, first, scenario.ctx());
        let second = coin::mint_for_testing<TEST_USDC>(6_000, scenario.ctx());
        let mut receipt_two = vault::deposit_liquidity(&mut vault, second, scenario.ctx());

        vault::merge_receipt(&mut receipt_two, receipt_one);
        assert!(vault::shares(&receipt_two) == 10_000, 0);
        assert!(vault::lp_supply(&vault) == 10_000, 1);

        transfer::public_transfer(receipt_two, LP_ONE);
        ts::return_shared(vault);
    };

    scenario.next_tx(LP_ONE);
    {
        let mut vault = scenario.take_shared<Vault>();
        let market = scenario.take_shared<Market>();
        let receipt = scenario.take_from_sender<LpReceipt>();
        let payout = vault::withdraw_liquidity(&mut vault, &market, receipt, scenario.ctx());
        assert!(coin::value(&payout) == 10_000, 2);
        assert!(vault::total_balance(&vault) == 0, 3);
        transfer::public_transfer(payout, LP_ONE);
        ts::return_shared(market);
        ts::return_shared(vault);
    };

    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test, expected_failure(abort_code=4)]
fun split_receipt_rejects_full_amount() {
    let mut scenario = ts::begin(ADMIN);
    let clock = setup_vault(&mut scenario);

    scenario.next_tx(LP_ONE);
    {
        let mut vault = scenario.take_shared<Vault>();
        let payment = coin::mint_for_testing<TEST_USDC>(1_000, scenario.ctx());
        let mut receipt = vault::deposit_liquidity(&mut vault, payment, scenario.ctx());
        let part = vault::split_receipt(&mut receipt, 1_000, scenario.ctx());
        transfer::public_transfer(part, LP_ONE);
        transfer::public_transfer(receipt, LP_ONE);
        ts::return_shared(vault);
    };

    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
fun free_liquidity_excludes_open_interest() {
    let mut scenario = ts::begin(ADMIN);
    let clock = setup_vault(&mut scenario);

    scenario.next_tx(LP_ONE);
    {
        let mut vault = scenario.take_shared<Vault>();
        let payment = coin::mint_for_testing<TEST_USDC>(100_000, scenario.ctx());
        let receipt = vault::deposit_liquidity(&mut vault, payment, scenario.ctx());
        transfer::public_transfer(receipt, LP_ONE);
        ts::return_shared(vault);
    };

    scenario.next_tx(TRADER);
    {
        let mut market = scenario.take_shared<Market>();
        let mut vault = scenario.take_shared<Vault>();
        let mut treasury = scenario.take_shared<Treasury>();
        let collateral = coin::mint_for_testing<TEST_USDC>(1_000, scenario.ctx());
        router::open_position_at_price(
            &mut market, &mut vault, &mut treasury,
            collateral, true, 10, 50_000, &clock, scenario.ctx()
        );
        ts::return_shared(market);
        ts::return_shared(vault);
        ts::return_shared(treasury);
    };

    scenario.next_tx(LP_ONE);
    {
        let vault = scenario.take_shared<Vault>();
        let market = scenario.take_shared<Market>();
        let balance = vault::total_balance(&vault);
        let reserved = market::long_open_interest(&market) + market::short_open_interest(&market);
        assert!(vault::free_liquidity(&vault, &market) == balance - reserved, 0);
        assert!(vault::redeemable_value(&vault, vault::lp_supply(&vault)) == balance, 1);
        ts::return_shared(market);
        ts::return_shared(vault);
    };

    clock::destroy_for_testing(clock);
    scenario.end();
}
