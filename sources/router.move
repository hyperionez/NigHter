module perp_dex::router;

use sui::coin::{Self, Coin};
use perp_dex::market::Market;
use perp_dex::vault::{Vault, Self};
use perp_dex::test_usdc::TEST_USDC;
use perp_dex::market;
use perp_dex::position::{Position, Self};
use perp_dex::math;
use pyth::price_info::PriceInfoObject;
use sui::clock::Clock;
use perp_dex::oracle;

const EInvalidLeverage : u64 = 0;
const EWrongMarket : u64 = 1;
const ENotOwner : u64 = 2;
const ELossExceedsCollateral : u64 = 3;

public fun open_position(
    market: &mut Market,
    vault: &mut Vault,
    collateral : Coin<TEST_USDC>,
    is_long: bool,
    leverage: u64,
    price_info_object: &PriceInfoObject,
    clock : &Clock,
    ctx: &mut TxContext
) {
    
    let entry_price = oracle::get_validated_price(market, price_info_object, clock);
    open_position_at_price(market, vault, collateral, is_long, leverage, entry_price, ctx);
}

public(package) fun open_position_at_price(
    market: &mut Market,
    vault: &mut Vault,
    collateral: Coin<TEST_USDC>,
    is_long: bool,
    leverage: u64,
    price: u64,
    ctx: &mut TxContext
) {
    assert!(leverage > 0 && leverage <= market::max_leverage(market), EInvalidLeverage);
    let collateral_amount = coin::value(&collateral);
    let size = collateral_amount * leverage;
    if(is_long){
        market::add_long_open_interest(market, size);
    } else {
        market::add_short_open_interest(market, size);
    };
    vault::hold_collateral(vault, collateral);
    
    let position = position::new(
        ctx.sender(),
        object::id(market),
        is_long, size, collateral_amount, price, ctx
    );
    position::share(position);
}


public fun close_position(
    market: &mut Market,
    vault: &mut Vault,
    position : Position,
    price_info_object : &PriceInfoObject,
    clock : &Clock,
    ctx : &mut TxContext
) {
    let exit_price = oracle::get_validated_price(market, price_info_object, clock);
    close_position_at_price(market, vault, position, exit_price, ctx);
}

public(package) fun close_position_at_price(
    market: &mut Market,
    vault: &mut Vault,
    position : Position,
    exit_price : u64,
    ctx: &mut TxContext
) {
    assert!(position::market_id(&position) == object::id(market), EWrongMarket);
    assert!(position::owner(&position) == ctx.sender(), ENotOwner);
    let (owner, _market_id, is_long, size,
     collateral, entry_price)= position::destroy(position);
    if(is_long){
        market::add_long_close_interest(market, size);
    } else {
        market::add_short_close_interest(market, size);
    };
    let is_profit = (is_long && exit_price >= entry_price) || (!is_long && exit_price <= entry_price);
    let price_diff = if (exit_price >= entry_price) {
        exit_price - entry_price
    } else {
        entry_price - exit_price
    };
    let pnl = math::mul_div(size, price_diff, entry_price);
    let payout = if (is_profit) {
        collateral + pnl
    } else {
        assert!(pnl <= collateral, ELossExceedsCollateral);
        collateral - pnl
    };
    let payout_coin = vault::pay_out(vault, payout, ctx);
    transfer::public_transfer(payout_coin, owner);
}