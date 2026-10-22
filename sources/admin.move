module perp_dex::admin;

public struct AdminCap has key, store {
    id: UID,
}

public struct RiskCap has key, store {
    id: UID,
}

public struct TreasurerCap has key, store {
    id: UID,
}

fun init(ctx: &mut TxContext) {
    transfer::transfer(AdminCap { id: object::new(ctx) }, ctx.sender());
}

public fun mint_risk_cap(_admin: &AdminCap, recipient: address, ctx: &mut TxContext) {
    transfer::public_transfer(RiskCap { id: object::new(ctx) }, recipient);
}

public fun mint_treasurer_cap(_admin: &AdminCap, recipient: address, ctx: &mut TxContext) {
    transfer::public_transfer(TreasurerCap { id: object::new(ctx) }, recipient);
}

public fun burn_risk_cap(cap: RiskCap) {
    let RiskCap { id } = cap;
    object::delete(id);
}

public fun burn_treasurer_cap(cap: TreasurerCap) {
    let TreasurerCap { id } = cap;
    object::delete(id);
}

#[test_only]
public fun mint_for_testing(ctx: &mut TxContext): AdminCap {
    AdminCap { id: object::new(ctx) }
}

#[test_only]
public fun mint_risk_cap_for_testing(ctx: &mut TxContext): RiskCap {
    RiskCap { id: object::new(ctx) }
}

#[test_only]
public fun mint_treasurer_cap_for_testing(ctx: &mut TxContext): TreasurerCap {
    TreasurerCap { id: object::new(ctx) }
}
