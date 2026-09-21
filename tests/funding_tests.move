#[test_only]
module perp_dex::funding_tests;

use sui::test_scenario::{Self as ts};
use perp_dex::vault::{Vault, Self};
use perp_dex::admin;
use perp_dex::funding;
use perp_dex::market::{Self, Market};
use perp_dex::test_usdc::TEST_USDC;
use perp_dex::router;
use perp_dex::position::Position;
use perp_dex::position;
use sui::coin::{Coin, Self};
use sui::clock::{Self, Clock};
use perp_dex::treasury::{Treasury, Self};

const ADMIN : address = @0xA;
const LP : address = @0xB1;
const TRADER_LONG : address = @0xC1;
const TRADER_SHORT : address = @0xC2;

fun setup(scenario: &mut ts::Scenario): Clock{
    treasury::init_for_testing(scenario.ctx());
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_cap = admin::mint_for_testing(scenario.ctx());
    market::create_market(&admin_cap
    , b"BTC-PERP",
     1000,
     500,
     10,
     10,
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
fun crank_funding_advances_index_and_timestamp(){
    let mut scenario = ts::begin(ADMIN);
    let mut clock = setup(&mut scenario);

    scenario.next_tx(TRADER_LONG);
    {
        let mut market = scenario.take_shared<Market>();
        let mut vault = scenario.take_shared<Vault>();
        let mut treasury = scenario.take_shared<Treasury>();
        let collateral = coin::mint_for_testing<TEST_USDC>(1_000, scenario.ctx());
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

    scenario.next_tx(TRADER_SHORT);
    {
        let mut market = scenario.take_shared<Market>();
        let mut vault = scenario.take_shared<Vault>();
        let mut treasury = scenario.take_shared<Treasury>();
        let collateral = coin::mint_for_testing<TEST_USDC>(500, scenario.ctx());
        router::open_position_at_price(&mut market,
        &mut vault,
        &mut treasury,
        collateral,
        false,
        10,
        50_000,
        &clock,
        scenario.ctx());
        ts::return_shared(market);
        ts::return_shared(vault);
        ts::return_shared(treasury);
    };

    sui::clock::increment_for_testing(&mut clock, 3_600_000);

    scenario.next_tx(ADMIN);
    {
        let mut market = scenario.take_shared<Market>();
        funding::crank_funding(&mut market, &clock);
        assert!(market::cumulative_funding_long_charge(&market) > 0, 0);
        assert!(market::cumulative_funding_short_credit(&market) > 0, 1);
        assert!(market::last_funding_time(&market) == clock::timestamp_ms(&clock), 2);
        ts::return_shared(market);
    };

    sui::clock::destroy_for_testing(clock);
    scenario.end();

}