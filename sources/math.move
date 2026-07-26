module perp_dex::math;

/// Computes `(a * b) / c` using a `u128` intermediate product so that
/// `a * b` doesn't overflow `u64` before the division is applied.
public fun mul_div(a: u64, b: u64, c: u64): u64 {
    (((a as u128) * (b as u128)) / (c as u128)) as u64
}
