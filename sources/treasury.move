module perp_dex::treasury;

use sui::balance::{Self, Balance};
use perp_dex::test_usdc::TEST_USDC;
use sui::coin::{Coin, Self};
use perp_dex::admin::AdminCap;
use sui::event;

public struct Treasury has key{
    id : UID,
    balance : Balance<TEST_USDC>
}

public struct TreasuryWithdrawn has copy, drop{
    treasury_id : ID,
    withdrawer : address,
    amount : u64,
}

fun init(ctx : &mut TxContext){
    transfer::share_object(Treasury{
        id: object::new(ctx),
        balance: balance::zero()
    });
}

#[test_only]
public fun init_for_testing(ctx: &mut TxContext){
    init(ctx)
}

public(package) fun deposit(treasury: &mut Treasury, payment:Coin<TEST_USDC>){
    balance::join(&mut treasury.balance, coin::into_balance(payment));
}

public fun total_balance(treasury : &Treasury) : u64 {
    balance::value(&treasury.balance)
}

public fun withdraw_treasury(
    treasury : &mut Treasury,
    _adminCap: &AdminCap,
    amount : u64,
    ctx: &mut TxContext
) : Coin<TEST_USDC> {
   event::emit(TreasuryWithdrawn {
    treasury_id : object::id(treasury),
    withdrawer: ctx.sender(),
    amount: amount
   });
   coin::from_balance(balance::split(&mut treasury.balance, amount), ctx)
}