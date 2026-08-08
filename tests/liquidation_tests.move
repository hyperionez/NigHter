#[test_only]
module perp_dex::liquidation_tests;

use sui::test_scenario::{Self as ts};
use perp_dex::vault::{Vault, Self};
use sui::clock::{Clock, Self};
use perp_dex::admin;
use perp_dex::treasury::{Self, Treasury};
use perp_dex::market;
use sui::coin::{Coin, Self};
use perp_dex::test_usdc::TEST_USDC;
use perp_dex::market::Market;
use perp_dex::router;
use perp_dex::position::Position;
use perp_dex::liquidation;

const ADMIN : address = @0xA;
const LP : address = @0xB1;
const TRADER : address = @0xC1;
const KEEPER : address = @0xD1;

fun setup(scenario: &mut ts::Scenario): Clock{
    treasury::init_for_testing(scenario.ctx());
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_cap = admin::mint_for_testing(scenario.ctx());
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
     scenario.ctx(),);
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
        let lp_payment = coin::mint_for_testing<TEST_USDC>(100_000,scenario.ctx());
        let receipt = vault::deposit_liquidity(&mut vault,lp_payment,scenario.ctx());
        transfer::public_transfer(receipt, LP);
        ts::return_shared(vault);
    };
    clock
}

#[test]
fun test_unhealthy_position(){
    let mut scenario = ts::begin(ADMIN);
    let mut clock = setup(&mut scenario);
    scenario.next_tx(TRADER);
    {
        let mut market = scenario.take_shared<Market>();
        let mut vault = scenario.take_shared<Vault>();
        let mut treasury = scenario.take_shared<Treasury>();
        let collateral = coin::mint_for_testing<TEST_USDC>(10_000,
        scenario.ctx());
        router::open_position_at_price(&mut market,
         &mut vault,
         &mut treasury,
         collateral,
         true,
          10, 
          50_000,
          &clock,
          scenario.ctx());
        ts::return_shared(market);
        ts::return_shared(vault);
        ts::return_shared(treasury);
    };
    scenario.next_tx(ADMIN);
    {
        let admin_cap = admin::mint_for_testing(scenario.ctx());
        let mut market = scenario.take_shared<Market>();
        market::set_mock_price(&mut market, &admin_cap,46_000);
        ts::return_shared(market);
        transfer::public_transfer(admin_cap, ADMIN);
    };
    scenario.next_tx(KEEPER);
    {
        let mut market = scenario.take_shared<Market>();
        let mut vault = scenario.take_shared<Vault>();
        let mut treasury = scenario.take_shared<Treasury>();
        let position = scenario.take_shared<Position>();
        liquidation::liquidate_at_price(
            &mut market,
            &mut vault,
            &mut treasury,
            position,
            46_000,
            &clock,
            scenario.ctx()
        );
        ts::return_shared(market);
        ts::return_shared(vault);
        ts::return_shared(treasury);
    };
    scenario.next_tx(KEEPER);
    {
        let payout = scenario.take_from_sender<Coin<TEST_USDC>>();
        assert!(coin::value(&payout) == 500, 0);
        transfer::public_transfer(payout, KEEPER);
    };
    scenario.next_tx(TRADER);
    {
        let payout = scenario.take_from_sender<Coin<TEST_USDC>>();
        assert!(coin::value(&payout) == 1000-100, 1);
        transfer::public_transfer(payout, TRADER);
    };
    sui::clock::destroy_for_testing(clock);
    scenario.end();
}

#[test, expected_failure(abort_code=2)]
fun test_unhealthy_position_non_liquidatable(){
    let mut scenario = ts::begin(ADMIN);
    let mut clock = setup(&mut scenario);
    scenario.next_tx(TRADER);
    {
        let mut market = scenario.take_shared<Market>();
        let mut vault = scenario.take_shared<Vault>();
        let mut treasury = scenario.take_shared<Treasury>();
        let collateral = coin::mint_for_testing<TEST_USDC>(10_000,
        scenario.ctx());
        router::open_position_at_price(&mut market,
         &mut vault,
         &mut treasury,
          collateral,
           true,
          10, 
          50_000,
          &clock,
          scenario.ctx());
        ts::return_shared(market);
        ts::return_shared(vault);
        ts::return_shared(treasury);
    };
    scenario.next_tx(ADMIN);
    {
        let admin_cap = admin::mint_for_testing(scenario.ctx());
        let mut market = scenario.take_shared<Market>();
        market::set_mock_price(&mut market, &admin_cap,48_000);
        ts::return_shared(market);
        transfer::public_transfer(admin_cap, ADMIN);
    };
    scenario.next_tx(KEEPER);
    {
        let mut market = scenario.take_shared<Market>();
        let mut vault = scenario.take_shared<Vault>();
        let mut treasury = scenario.take_shared<Treasury>();
        let position = scenario.take_shared<Position>();
        liquidation::liquidate_at_price(
            &mut market,
            &mut vault,
            &mut treasury,
            position,
            48_000,
            &clock,
            scenario.ctx()
        );
        ts::return_shared(market);
        ts::return_shared(vault);
        ts::return_shared(treasury);
    };
    sui::clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
fun test_unhealthy_position_bad_debt(){ //vault rugi
    let mut scenario = ts::begin(ADMIN);
    let mut clock = setup(&mut scenario);
    scenario.next_tx(TRADER);
    {
        let mut market = scenario.take_shared<Market>();
        let mut vault = scenario.take_shared<Vault>();
        let mut treasury = scenario.take_shared<Treasury>();
        let collateral = coin::mint_for_testing<TEST_USDC>(10_000,
        scenario.ctx());
        router::open_position_at_price(&mut market,
         &mut vault,
         &mut treasury,
          collateral,
           true,
          10, 
          50_000,
          &clock,
          scenario.ctx());
        ts::return_shared(market);
        ts::return_shared(vault);
        ts::return_shared(treasury);
    };
    scenario.next_tx(ADMIN);
    {
        let admin_cap = admin::mint_for_testing(scenario.ctx());
        let mut market = scenario.take_shared<Market>();
        market::set_mock_price(&mut market, &admin_cap,40_000);
        ts::return_shared(market);
        transfer::public_transfer(admin_cap, ADMIN);
    };
    scenario.next_tx(KEEPER);
    {
        let mut market = scenario.take_shared<Market>();
        let mut vault = scenario.take_shared<Vault>();
        let mut treasury = scenario.take_shared<Treasury>();
        let position = scenario.take_shared<Position>();
        liquidation::liquidate_at_price(
            &mut market,
            &mut vault,
            &mut treasury,
            position,
            40_000,
            &clock,
            scenario.ctx()
        );
        ts::return_shared(market);
        ts::return_shared(vault);
        assert!(treasury::total_balance(&treasury) == 0, 2);
        ts::return_shared(treasury);
    };
    scenario.next_tx(KEEPER);
    {
        let payout = scenario.take_from_sender<Coin<TEST_USDC>>();
        assert!(coin::value(&payout) == 500, 0);
        transfer::public_transfer(payout, KEEPER);
    };
    sui::clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
fun test_unhealthy_position_with_funding(){
    let mut scenario = ts::begin(ADMIN);
    let mut clock = setup(&mut scenario);
    scenario.next_tx(TRADER);
    {
        let mut market = scenario.take_shared<Market>();
        let mut vault = scenario.take_shared<Vault>();
        let mut treasury = scenario.take_shared<Treasury>();
        let collateral = coin::mint_for_testing<TEST_USDC>(10_000,
        scenario.ctx());
        router::open_position_at_price(&mut market,
         &mut vault,
         &mut treasury,
          collateral,
           true,
          10, 
          50_000,
          &clock,
          scenario.ctx());
        ts::return_shared(market);
        ts::return_shared(vault);
        ts::return_shared(treasury);
        
    };
    sui::clock::increment_for_testing(&mut clock, 39_600_000);
    scenario.next_tx(ADMIN);
    {
        let admin_cap = admin::mint_for_testing(scenario.ctx());
        let mut market = scenario.take_shared<Market>();
        market::set_mock_price(&mut market, &admin_cap,48_000);
        ts::return_shared(market);
        transfer::public_transfer(admin_cap, ADMIN);
    };
    scenario.next_tx(KEEPER);
    {
        let mut market = scenario.take_shared<Market>();
        let mut vault = scenario.take_shared<Vault>();
        let mut treasury = scenario.take_shared<Treasury>();
        let position = scenario.take_shared<Position>();
        liquidation::liquidate_at_price(
            &mut market,
            &mut vault,
            &mut treasury,
            position,
            48_000,
            &clock,
            scenario.ctx()
        );
        ts::return_shared(market);
        ts::return_shared(vault);
        ts::return_shared(treasury);
    };
    scenario.next_tx(KEEPER);
    {
        let payout = scenario.take_from_sender<Coin<TEST_USDC>>();
        assert!(coin::value(&payout) == 500, 0);
        transfer::public_transfer(payout, KEEPER);
    };
    scenario.next_tx(TRADER);
    {
        let payout = scenario.take_from_sender<Coin<TEST_USDC>>();
        assert!(coin::value(&payout) == 3900-100, 0);
        transfer::public_transfer(payout, TRADER);
    };
    sui::clock::destroy_for_testing(clock);
    scenario.end();
}
#[test]
fun liquidate_still_works_when_market_paused(){
    let mut scenario = ts::begin(ADMIN);
    let clock = setup(&mut scenario);
    scenario.next_tx(TRADER);
    {
        let mut market = scenario.take_shared<Market>();
        let mut vault = scenario.take_shared<Vault>();
        let mut treasury = scenario.take_shared<Treasury>();
        let collateral = coin::mint_for_testing<TEST_USDC>(10_000,
        scenario.ctx());
        router::open_position_at_price(&mut market,
         &mut vault,
         &mut treasury,
         collateral,
         true,
          10,
          50_000,
          &clock,
          scenario.ctx());
        ts::return_shared(market);
        ts::return_shared(vault);
        ts::return_shared(treasury);
    };
    scenario.next_tx(ADMIN);
    {
        let admin_cap = admin::mint_for_testing(scenario.ctx());
        let mut market = scenario.take_shared<Market>();
        market::set_mock_price(&mut market, &admin_cap,46_000);
        market::set_paused(&mut market, &admin_cap, true);
        ts::return_shared(market);
        transfer::public_transfer(admin_cap, ADMIN);
    };
    scenario.next_tx(KEEPER);
    {
        let mut market = scenario.take_shared<Market>();
        let mut vault = scenario.take_shared<Vault>();
        let mut treasury = scenario.take_shared<Treasury>();
        let position = scenario.take_shared<Position>();
        liquidation::liquidate_at_price(
            &mut market,
            &mut vault,
            &mut treasury,
            position,
            46_000,
            &clock,
            scenario.ctx()
        );
        ts::return_shared(market);
        ts::return_shared(vault);
        ts::return_shared(treasury);
    };
    scenario.next_tx(KEEPER);
    {
        let payout = scenario.take_from_sender<Coin<TEST_USDC>>();
        assert!(coin::value(&payout) == 500, 0);
        transfer::public_transfer(payout, KEEPER);
    };
    scenario.next_tx(TRADER);
    {
        let payout = scenario.take_from_sender<Coin<TEST_USDC>>();
        assert!(coin::value(&payout) == 1000-100, 1);
        transfer::public_transfer(payout, TRADER);
    };
    sui::clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
fun liquiditon_bad_debt_fully_covered_by_treasury(){
    let mut scenario = ts::begin(ADMIN);
    let mut clock = setup(&mut scenario);
    scenario.next_tx(TRADER);
    {
        let mut market = scenario.take_shared<Market>();
        let mut vault = scenario.take_shared<Vault>();
        let mut treasury = scenario.take_shared<Treasury>();
        let collateral = coin::mint_for_testing<TEST_USDC>(10_000, scenario.ctx());
        router::open_position_at_price(
            &mut market,
            &mut vault,
            &mut treasury,
            collateral,
            true,
            10,
            50_000,
            &clock,
            scenario.ctx()
        );
        ts::return_shared(market);
        ts::return_shared(treasury);
        ts::return_shared(vault);
    };


    scenario.next_tx(ADMIN);
    {
        let mut treasury = scenario.take_shared<Treasury>();
        let seed = coin::mint_for_testing<TEST_USDC>(10_000, scenario.ctx());
        treasury::deposit(&mut treasury, seed);
        ts::return_shared(treasury);
    };

    scenario.next_tx(ADMIN);
    {
        let admin_cap = admin::mint_for_testing(scenario.ctx());
        let mut market = scenario.take_shared<Market>();
        market::set_mock_price(&mut market, &admin_cap, 40_000);
        ts::return_shared(market);
        transfer::public_transfer(admin_cap, ADMIN);
    };
    
    scenario.next_tx(KEEPER);
    {
        let mut market = scenario.take_shared<Market>();
        let mut vault = scenario.take_shared<Vault>();
        let mut treasury = scenario.take_shared<Treasury>();
        let position = scenario.take_shared<Position>();
        liquidation::liquidate_at_price(
            &mut market,
            &mut vault,
            &mut treasury,
            position,
            40_000,
            &clock,
            scenario.ctx()
        );
        assert!(vault::total_balance(&vault) == 109_900, 1);
        assert!(treasury::total_balance(&treasury) == 10_100 - 500, 2);
        ts::return_shared(market);
        ts::return_shared(vault);
        ts::return_shared(treasury);
    };
    scenario.next_tx(KEEPER);
    {
        let payout = scenario.take_from_sender<Coin<TEST_USDC>>();
        assert!(coin::value(&payout) == 500, 0);
        transfer::public_transfer(payout, KEEPER);
    };
    sui::clock::destroy_for_testing(clock);
    scenario.end();
}

#[test, expected_failure(abort_code=1)]
fun liquidate_reverts_when_vault_market_mismatched(){
    let mut scenario = ts::begin(ADMIN);
    let clock = setup(&mut scenario);
    scenario.next_tx(TRADER);
    {
        let mut market = scenario.take_shared<Market>();
        let mut vault = scenario.take_shared<Vault>();
        let mut treasury = scenario.take_shared<Treasury>();
        let collateral = coin::mint_for_testing<TEST_USDC>(10_000, scenario.ctx());
        router::open_position_at_price(&mut market,
         &mut vault, &mut treasury, collateral, true, 10, 50_000, &clock, scenario.ctx());
        ts::return_shared(market);
        ts::return_shared(vault);
        ts::return_shared(treasury);
    };
    scenario.next_tx(ADMIN);
    {
        let admin_cap = admin::mint_for_testing(scenario.ctx());
        let mut market = scenario.take_shared<Market>();
        market::set_mock_price(&mut market, &admin_cap, 46_000);
        ts::return_shared(market);
        transfer::public_transfer(admin_cap, ADMIN);
    };
    scenario.next_tx(ADMIN);
    let wrong_vault_id = vault::init_for_testing(object::id_from_address(@0xDEAD), scenario.ctx());
    scenario.next_tx(KEEPER);
    {
        let mut market = scenario.take_shared<Market>();
        let mut wrong_vault = scenario.take_shared_by_id<Vault>(wrong_vault_id);
        let mut treasury = scenario.take_shared<Treasury>();
        let position = scenario.take_shared<Position>();
        liquidation::liquidate_at_price(
            &mut market, &mut wrong_vault, &mut treasury,
            position, 46_000, &clock, scenario.ctx()
        );
        ts::return_shared(market);
        ts::return_shared(wrong_vault);
        ts::return_shared(treasury);
    };
    sui::clock::destroy_for_testing(clock);
    scenario.end();
}