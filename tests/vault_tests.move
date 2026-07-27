#[test_only]
module perp_dex::vault_tests;

use sui::test_scenario::{Self as ts};
use sui::coin;
use perp_dex::vault::{Self, Vault, LpReceipt};
use perp_dex::test_usdc::TEST_USDC;

const ADMIN: address = @0xA;
const LP_ONE: address = @0xB1;
const LP_TWO: address = @0xB2;

#[test]
fun deposit_then_withdraw_returns_full_amount() {
    let mut scenario = ts::begin(ADMIN);
    vault::init_for_testing(scenario.ctx());

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
        let payout = vault::withdraw_liquidity(&mut vault, receipt, scenario.ctx());
        assert!(coin::value(&payout) == 1_000, 2);
        assert!(vault::total_balance(&vault) == 0, 3);
        assert!(vault::lp_supply(&vault) == 0, 4);
        transfer::public_transfer(payout, LP_ONE);
        ts::return_shared(vault);
    };

    scenario.end();
}

#[test]
fun second_lp_gets_proportional_shares() {
    let mut scenario = ts::begin(ADMIN);
    vault::init_for_testing(scenario.ctx());

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
    vault::init_for_testing(scenario.ctx());

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
