module perp_dex::vault;

use sui::balance::{Self, Balance};
use sui::coin::{Self, Coin};
use sui::event;
use perp_dex::math;
use perp_dex::test_usdc::TEST_USDC;

const EZeroAmount: u64 = 0;
const EWrongVault: u64 = 1;

public struct Vault has key {
    id: UID,
    balance: Balance<TEST_USDC>,
    lp_supply: u64,
}

public struct LpReceipt has key, store {
    id: UID,
    vault_id: ID,
    shares: u64,
}

public struct LiquidityDeposited has copy, drop {
    vault_id: ID,
    depositor: address,
    amount: u64,
    shares_minted: u64,
}

public struct LiquidityWithdrawn has copy, drop {
    vault_id: ID,
    withdrawer: address,
    amount: u64,
    shares_burned: u64,
}

fun init(ctx: &mut TxContext) {
    transfer::share_object(Vault {
        id: object::new(ctx),
        balance: balance::zero(),
        lp_supply: 0,
    });
}

public fun deposit_liquidity(
    vault: &mut Vault,
    payment: Coin<TEST_USDC>,
    ctx: &mut TxContext,
): LpReceipt {
    let amount = coin::value(&payment);
    assert!(amount > 0, EZeroAmount);

    let shares = if (vault.lp_supply == 0) {
        amount
    } else {
        math::mul_div(amount, vault.lp_supply, balance::value(&vault.balance))
    };

    balance::join(&mut vault.balance, coin::into_balance(payment));
    vault.lp_supply = vault.lp_supply + shares;

    event::emit(LiquidityDeposited {
        vault_id: object::id(vault),
        depositor: ctx.sender(),
        amount,
        shares_minted: shares,
    });

    LpReceipt {
        id: object::new(ctx),
        vault_id: object::id(vault),
        shares,
    }
}

public fun withdraw_liquidity(
    vault: &mut Vault,
    receipt: LpReceipt,
    ctx: &mut TxContext,
): Coin<TEST_USDC> {
    let LpReceipt { id, vault_id, shares } = receipt;
    assert!(vault_id == object::id(vault), EWrongVault);
    object::delete(id);

    let payout = math::mul_div(shares, balance::value(&vault.balance), vault.lp_supply);
    vault.lp_supply = vault.lp_supply - shares;

    event::emit(LiquidityWithdrawn {
        vault_id,
        withdrawer: ctx.sender(),
        amount: payout,
        shares_burned: shares,
    });

    coin::from_balance(balance::split(&mut vault.balance, payout), ctx)
}

public fun total_balance(vault: &Vault): u64 {
    balance::value(&vault.balance)
}

public fun lp_supply(vault: &Vault): u64 {
    vault.lp_supply
}

public fun shares(receipt: &LpReceipt): u64 {
    receipt.shares
}

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    init(ctx)
}

public(package) fun hold_collateral(vault: &mut Vault, payment: Coin<TEST_USDC>){
    balance::join(&mut vault.balance, coin::into_balance(payment));
}

public(package) fun pay_out(vault : &mut Vault, amount: u64, ctx: &mut TxContext) : Coin<TEST_USDC> {
    coin::from_balance(balance::split(
    &mut vault.balance,
    amount), ctx)
}
