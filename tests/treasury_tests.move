#[test_only]
module perp_dex::treasury_tests;

use sui::test_scenario::{Self as ts};
use perp_dex::treasury::{Self, Treasury};
use perp_dex::admin;
use sui::coin;
use perp_dex::test_usdc::TEST_USDC;

const ADMIN : address = @0xA;

#[test]
fun deposit_accumulates_balance(){
    let mut scenario = ts::begin(ADMIN);
    treasury::init_for_testing(scenario.ctx());

    scenario.next_tx(ADMIN);
    {
        let mut treasury = scenario.take_shared<Treasury>();
        let payment = coin::mint_for_testing<TEST_USDC>(300, scenario.ctx());
        treasury::deposit(&mut treasury, payment);
        assert!(treasury::total_balance(&treasury) == 300, 0);

        let payment2 = coin::mint_for_testing<TEST_USDC>(200, scenario.ctx());
        treasury::deposit(&mut treasury, payment2);
        assert!(treasury::total_balance(&treasury) == 500 ,1);

        ts::return_shared(treasury);
    };

    scenario.end();
}

#[test]
fun withdraw_reduces_balance_and_returns_coin(){
    let mut scenario = ts::begin(ADMIN);
    treasury::init_for_testing(scenario.ctx());

    scenario.next_tx(ADMIN);
    {
        let mut treasury = scenario.take_shared<Treasury>();
        let payment = coin::mint_for_testing<TEST_USDC>(1_000, scenario.ctx());
        treasury::deposit(&mut treasury, payment);
        ts::return_shared(treasury);
    };

    scenario.next_tx(ADMIN);
    {
        let mut treasury = scenario.take_shared<Treasury>();
        let admin_cap = admin::mint_for_testing(scenario.ctx());

        let payout = treasury::withdraw_treasury(&mut treasury, &admin_cap, 400, scenario.ctx());
        assert!(coin::value(&payout) == 400 , 2);
        assert!(treasury::total_balance(&treasury) == 600, 3);

        transfer::public_transfer(payout, ADMIN);
        transfer::public_transfer(admin_cap, ADMIN);
        ts::return_shared(treasury);
    };

    scenario.end();
}


#[test, expected_failure]
fun withdraw_more_than_balance_aborts(){
    let mut scenario = ts::begin(ADMIN);
    treasury::init_for_testing(scenario.ctx());

    scenario.next_tx(ADMIN);
    {
        let mut treasury = scenario.take_shared<Treasury>();
        let payment = coin::mint_for_testing<TEST_USDC>(1000, scenario.ctx());
        treasury::deposit(&mut treasury, payment);
        ts::return_shared(treasury);
    };

    scenario.next_tx(ADMIN);
    {
        let mut treasury = scenario.take_shared<Treasury>();
        let admin_cap = admin::mint_for_testing(scenario.ctx());

        let payout = treasury::withdraw_treasury(&mut treasury, &admin_cap, 500, scenario.ctx());
        assert!(treasury::total_balance(&treasury) < 0, 0);
        transfer::public_transfer(payout, ADMIN);
        transfer::public_transfer(admin_cap, ADMIN);
        ts::return_shared(treasury);
    };
    scenario.end();
}