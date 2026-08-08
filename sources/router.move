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
use perp_dex::funding;
use perp_dex::treasury::{Treasury, Self};
use perp_dex::fee;

const EInvalidLeverage : u64 = 0;
const EWrongMarket : u64 = 1;
const ENotOwner : u64 = 2;
const ELossExceedsCollateral : u64 = 3;
const EMarketPaused : u64 = 4;

public fun open_position(
    market: &mut Market,
    vault: &mut Vault,
    treasury: &mut Treasury,
    collateral : Coin<TEST_USDC>,
    is_long: bool,
    leverage: u64,
    price_info_object: &PriceInfoObject,
    clock : &Clock,
    ctx: &mut TxContext
) {
    
    let entry_price = oracle::get_validated_price(market, price_info_object, clock);
    open_position_at_price(market, vault, treasury, collateral, is_long, leverage, entry_price, clock, ctx);
}

public(package) fun open_position_at_price(
    market: &mut Market,
    vault: &mut Vault,
    treasury : &mut Treasury,
    collateral: Coin<TEST_USDC>,
    is_long: bool,
    leverage: u64,
    price: u64,
    clock: &Clock,
    ctx: &mut TxContext
) {
    assert!(vault::market_id(vault) == object::id(market), EWrongMarket);
    assert!(!market::is_paused(market), EMarketPaused);
    funding::settle_funding(market, clock);
    assert!(leverage > 0 && leverage <= market::max_leverage(market), EInvalidLeverage);
    let collateral_amount = coin::value(&collateral);
    let size = collateral_amount * leverage;
    let open_fee = fee::calculate_open_fee(size, market::open_fee_bps(market));
    let mut collateral = collateral;
    let fee_coin = coin::split(&mut collateral, open_fee, ctx);
    treasury::deposit(treasury, fee_coin);
    let net_collateral_amount = coin::value(&collateral);
    if(is_long){
        market::add_long_open_interest(market, size);
    } else {
        market::add_short_open_interest(market, size);
    };
    let (entry_funding_charge_index, entry_funding_credit_index) = if (is_long) {
        (market::cumulative_funding_long_charge(market), market::cumulative_funding_long_credit(market))
    } else {
        (market::cumulative_funding_short_charge(market), market::cumulative_funding_short_credit(market))
    };
    vault::hold_collateral(vault, collateral);
    
    let position = position::new(
        ctx.sender(),
        object::id(market),
        is_long,
        size,
        net_collateral_amount,
        price,
        entry_funding_charge_index,
        entry_funding_credit_index,
        ctx
    );
    position::share(position);
}


public fun close_position(
    market: &mut Market,
    vault: &mut Vault,
    treasury: &mut Treasury,
    position : Position,
    price_info_object : &PriceInfoObject,
    clock : &Clock,
    ctx : &mut TxContext
) {
    let exit_price = oracle::get_validated_price(market,
     price_info_object,
     clock);
    close_position_at_price(market,
    vault,
    treasury,
    position,
    exit_price,
    clock,
    ctx);
}

public(package) fun close_position_at_price(
    market: &mut Market,
    vault: &mut Vault,
    treasury : &mut Treasury,
    position : Position,
    exit_price : u64,
    clock: &Clock,
    ctx: &mut TxContext
) {
    assert!(vault::market_id(vault) == object::id(market), EWrongMarket);
    assert!(!market::is_paused(market), EMarketPaused);
    funding::settle_funding(market, clock);
    assert!(position::market_id(&position) == object::id(market), EWrongMarket);
    assert!(position::owner(&position) == ctx.sender(), ENotOwner);
    let (owner,
     _market_id,
     is_long,
     size,
     collateral, 
     entry_price,
     entry_funding_charge_index,
     entry_funding_credit_index)= position::destroy(position);
    let (funding_is_charge, funding_amount) = funding::funding_settlement(market,
     is_long,
      entry_funding_charge_index,
       entry_funding_credit_index,
        size);

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
    let (net_result, net_is_profit) : (u64, bool) = if (is_profit) {
        if(funding_is_charge) {
            if (pnl > funding_amount) {
                (pnl - funding_amount, true)
            } else {
                (funding_amount - pnl,  false)
            }
        } else {
            (pnl + funding_amount, true)
        } 
    } else {
        if(funding_is_charge) {
            (pnl + funding_amount, false)
        } else {
            if(funding_amount > pnl) {
                (funding_amount - pnl, true)
            } else {
                (pnl - funding_amount, false)
            }
        }
    };
    let close_fee = fee::calculate_close_fee(size,
     market::close_fee_bps(market));
    let payout = if (net_is_profit) {
        assert!(close_fee <= collateral + net_result, ELossExceedsCollateral);
        collateral + net_result -  close_fee
    } else {
        assert!(net_result + close_fee <= collateral, ELossExceedsCollateral);
        collateral - net_result - close_fee
    };
    let fee_coin = vault::pay_out(vault, close_fee, ctx);
    treasury::deposit(treasury, fee_coin);
    let payout_coin = vault::pay_out(vault, payout, ctx);
    transfer::public_transfer(payout_coin, owner);
}