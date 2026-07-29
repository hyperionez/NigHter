module perp_dex::fee;

use perp_dex::math;

public fun calculate_open_fee(
    size:u64,
    open_fee_bps : u64
) : u64 {
    math::mul_div(size, open_fee_bps, 10_000)
}

public fun calculate_close_fee(
    size : u64, close_fee_bps : u64
) : u64{
    math::mul_div(size, close_fee_bps, 10_000)
}