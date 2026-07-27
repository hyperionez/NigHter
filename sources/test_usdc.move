module perp_dex::test_usdc;

use sui::coin::{Self, TreasuryCap};
use sui::url;

public struct TEST_USDC has drop {}

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
