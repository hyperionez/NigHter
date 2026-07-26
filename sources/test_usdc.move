/// Mock collateral coin used while the vault/margin logic is being built.
/// Swap this out for a real bridged USDC type once the protocol is ready
/// to integrate an actual stablecoin on Sui.
module perp_dex::test_usdc;

use sui::coin::{Self, TreasuryCap};
use sui::url;

public struct TEST_USDC has drop {}

// `coin::create_currency` is deprecated in favor of the new `coin_registry`
// two-phase flow, which is significant added complexity not worth it for a
// disposable mock coin used only until real collateral is integrated.
#[allow(deprecated_usage)]
fun init(witness: TEST_USDC, ctx: &mut TxContext) {
    let (treasury_cap, metadata) = coin::create_currency(
        witness,
        6,
        b"tUSDC",
        b"Test USDC",
        b"Mock USDC for perp_dex development and testing",
        option::some(url::new_unsafe_from_bytes(b"")),
        ctx,
    );
    transfer::public_freeze_object(metadata);
    transfer::public_transfer(treasury_cap, ctx.sender());
}

/// Anyone holding the `TreasuryCap` (the deployer, by default) can mint
/// test collateral. Fine for devnet/testnet; never do this for real funds.
public fun mint(
    treasury_cap: &mut TreasuryCap<TEST_USDC>,
    amount: u64,
    ctx: &mut TxContext,
): coin::Coin<TEST_USDC> {
    coin::mint(treasury_cap, amount, ctx)
}

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    init(TEST_USDC {}, ctx)
}
