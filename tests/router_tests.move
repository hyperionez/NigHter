#[test_only]
module perp_dex::router_tests;

use sui::test_scenario::{Self as ts};
use perp_dex::vault::{Vault, Self};
use perp_dex::admin;
use perp_dex::market::{Self, Market};
use perp_dex::test_usdc::TEST_USDC;
use perp_dex::router;
use perp_dex::position::Position;
use perp_dex::position;
use sui::coin::{Coin, Self};


const ADMIN : address = @0xA;
const LP : address = @0xB1;
const TRADER : address = @0xC1;

fun setup(scenario: &mut ts::Scenario){
    vault::init_for_testing(scenario.ctx());

    let admin_cap = admin::mint_for_testing(scenario.ctx());
    market::create_market(&admin_cap
    , b"BTC-PERP",
     20,    1000,500,10,10,1_000_000,50_000,scenario.ctx(),);
    transfer::public_transfer(admin_cap, ADMIN);
    scenario.next_tx(LP);
    {
        let mut vault = scenario.take_shared<Vault>();
        let lp_payment = coin::mint_for_testing<TEST_USDC>(100_000,scenario.ctx());
        let receipt = vault::deposit_liquidity(&mut vault,lp_payment,scenario.ctx());
        transfer::public_transfer(receipt, LP);
        ts::return_shared(vault);
    }
}

#[test]
fun open_long_then_close_in_profit(){
    let mut scenario = ts::begin(ADMIN);
    setup(&mut scenario);
    scenario.next_tx(TRADER);
    {
        let market = scenario.take_shared<Market>();
        let mut vault = scenario.take_shared<Vault>();
        let collateral = coin::mint_for_testing<TEST_USDC>(1_000,
        scenario.ctx());
        router::open_position(&market,
         &mut vault, collateral, true, 10, scenario.ctx());
        ts::return_shared(market);
        ts::return_shared(vault);
    };
    scenario.next_tx(ADMIN);
    {
        let admin_cap = admin::mint_for_testing(scenario.ctx());
        let mut market = scenario.take_shared<Market>();
        market::set_mock_price(&mut market, &admin_cap,55_000);
        ts::return_shared(market);
        transfer::public_transfer(admin_cap, ADMIN);
    };
    scenario.next_tx(TRADER);
    {
        let market = scenario.take_shared<Market>();
        let mut vault = scenario.take_shared<Vault>();
        let position = scenario.take_shared<Position>();
        router::close_position(&market, &mut vault, position, scenario.ctx());
        ts::return_shared(market);
        ts::return_shared(vault);
    };
    scenario.next_tx(TRADER);
    {
        let payout = scenario.take_from_sender<Coin<TEST_USDC>>();
        assert!(coin::value(&payout) == 2_000, 0);
        transfer::public_transfer(payout, TRADER);
    };
    scenario.end();
}

