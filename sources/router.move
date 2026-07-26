module perp_dex::router;

use sui::coin::{Self, Coin};
use perp_dex::market::Market;
use perp_dex::vault::{Vault, Self};
use perp_dex::test_usdc::TEST_USDC;
use perp_dex::market;
use perp_dex::position::{Position, Self};
use perp_dex::math;

const EInvalidLeverage : u64 = 0;
const EWrongMarket : u64 = 1;
const ENotOwner : u64 = 2;
const ELossExceedsCollateral : u64 = 3;

public fun open_position(
    market: &Market,
    vault: &mut Vault,
    collateral : Coin<TEST_USDC>,
    is_long: bool,
    leverage: u64,
    ctx: &mut TxContext
) {
    assert!(leverage > 0 && leverage <= market::max_leverage(market), EInvalidLeverage);
    let collateral_amount = coin::value(&collateral);
    let size = collateral_amount * leverage;
    let entry_price = market::mock_price(market);
    vault::hold_collateral(vault, collateral);
    let position = position::new(
        ctx.sender(),
        object::id(market),
        is_long, size, collateral_amount, entry_price, ctx
    );
    position::share(position);
}

public fun close_position(
    market: &Market,
    vault: &mut Vault,
    position : Position,
    ctx : &mut TxContext
) {
    assert!(position::market_id(&position) == object::id(market), EWrongMarket);
    assert!(position::owner(&position) == ctx.sender(), ENotOwner);
    let exit_price = market::mock_price(market);
    let (owner, _market_id, is_long, size,
     collateral, entry_price)= position::destroy(position);
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