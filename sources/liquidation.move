module perp_dex::liquidation;

use perp_dex::market::{Market, Self};
use sui::clock::Clock;
use perp_dex::vault::{Vault, Self};
use perp_dex::position::{Position, Self};
use perp_dex::funding;
use perp_dex::oracle;
use perp_dex::margin;
use pyth::price_info::PriceInfoObject;

use std::u64::min;
use sui::coin::{Coin, Self};
use perp_dex::test_usdc::TEST_USDC;
use perp_dex::math;
use perp_dex::treasury::{Treasury, Self};

const EWrongMarket : u64 = 1;
const EIsNotLiquidatable : u64 = 2;

public fun liquidate(
    market:&mut Market,
    vault: &mut Vault,
    treasury: &mut Treasury,
    position: Position,
    price_info_object: &PriceInfoObject,
    clock:&Clock,
    ctx: &mut TxContext
) {
    let current_price = oracle::get_validated_price(
        market,
        price_info_object,
        clock
    );
    liquidate_at_price(market, vault, treasury, position, current_price, clock, ctx);
}

public fun liquidate_at_price(
    market: &mut Market,
    vault: &mut Vault,
    treasury: &mut Treasury,
    position: Position,
    current_price: u64,
    clock: &Clock,
    ctx: &mut TxContext
){
    funding::settle_funding(market, clock);
    assert!(vault::market_id(vault) == object::id(market), EWrongMarket);
    assert!(position::market_id(&position) == object::id(market), EWrongMarket);
    let entry_price = position::entry_price(&position);
    let size = position::size(&position);
    let is_long = position::is_long(&position);
    let entry_charge_index = position::entry_funding_charge_index(&position);
    let entry_credit_index = position::entry_funding_credit_index(&position);
    
    let (is_profit, pnl) = margin::calculate_pnl(
        entry_price,
        current_price,
        size,
        is_long
    );
    let (funding_is_charge, funding_amount) = funding::funding_settlement(
        market,
        is_long,
        entry_charge_index,
        entry_credit_index,
        size
    );
    let (net_result, net_is_profit) : (u64, bool) = if (is_profit) {
        if(funding_is_charge) {
            if (pnl > funding_amount) {
                (pnl - funding_amount, true)
            } else {
                (funding_amount - pnl, false)
            }
        } else {
            (pnl + funding_amount, true)
        }
    } else {
        if (funding_is_charge) {
            (pnl + funding_amount, false)
        } else {
            if(funding_amount > pnl) {
                (funding_amount - pnl, true)
            } else {
                (pnl - funding_amount, false)
            }
        }
    };

    let collateral = position::collateral(&position);
    let maintenance_margin_bps = market::maintenance_margin_bps(market);
    assert!(margin::is_liquidatable(
        collateral,
        net_is_profit,
        net_result,
        size,
        maintenance_margin_bps
    ),EIsNotLiquidatable);
    let (owner_address,
        _,
        _,
        size,
        collateral,
        _,
        _,
        _) = position::destroy(position);
    let final_equity = if(net_is_profit) {
        collateral + net_result
    } else {
        if(net_result >= collateral){
            0
        } else {
            collateral - net_result
        }
    };
    let liquidation_penalty_bps = market::liquidation_penalty_bps(market);
    let keeper_reward_bps = market::keeper_reward_bps(market);
    if(final_equity > 0){
        let penalty = min(math::mul_div(size,liquidation_penalty_bps,10_000), final_equity);
        let keeper_reward = min(math::mul_div(size,keeper_reward_bps,10_000), penalty);
        let keeper_coin :Coin<TEST_USDC> = vault::pay_out(
            vault,
            keeper_reward,
            ctx
        );
        let owner_payout = final_equity - penalty;
        let treasury_earning = vault::pay_out(vault, penalty - keeper_reward, ctx);
        treasury::deposit(treasury, treasury_earning);
        let owner_coin = vault::pay_out(
            vault,
            owner_payout,
            ctx
        );
        transfer::public_transfer(
            owner_coin,
            owner_address
        );
        transfer::public_transfer(
            keeper_coin,
            ctx.sender()
        );
    } else {
        let keeper_reward_amount = math::mul_div(size, keeper_reward_bps, 10_000);
        let mut keeper_coin = treasury::withdraw_up_to(treasury, keeper_reward_amount, ctx);
        let covered = coin::value(&keeper_coin);
        if(covered < keeper_reward_amount) {
            let shortfall = keeper_reward_amount - covered;
            let from_vault = vault::pay_out(vault, shortfall, ctx);
            coin::join(&mut keeper_coin, from_vault);
        };
        transfer::public_transfer(
            keeper_coin,
            ctx.sender()
        );
    };

}