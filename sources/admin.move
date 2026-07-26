module perp_dex::admin;

/// Held by the deployer (later, ideally a multisig). Required for any
/// governance action: creating/configuring markets, pausing, withdrawing
/// the treasury. Liquidation and funding settlement are intentionally
/// NOT gated by this cap -- those must stay permissionless.
public struct AdminCap has key, store {
    id: UID,
}

fun init(ctx: &mut TxContext) {
    transfer::transfer(AdminCap { id: object::new(ctx) }, ctx.sender());
}

#[test_only]
public fun mint_for_testing(ctx: &mut TxContext): AdminCap {
    AdminCap { id: object::new(ctx) }
}
