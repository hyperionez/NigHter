module perp_dex::math;


public fun mul_div(a: u64, b: u64, c: u64): u64 {
    (((a as u128) * (b as u128)) / (c as u128)) as u64
}

public fun mul_div_round_up(a: u64, b: u128, c: u128): u64 {
    let product = (a as u128) * b;
    (((product + c - 1) / c) as u64)
}