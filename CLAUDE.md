# Perp DEX (Sui Move) — Project Context

Read this file at the start of every session in this repo. It is durable project context and overrides generic default behavior.

## What this is

Oracle-based pooled-counterparty perpetual futures DEX on Sui Move — Hyperliquid/GMX-style vAMM where traders trade against a shared LP vault, mark price comes from an external oracle (Pyth). Explicitly **not** an order-book/CLOB (that decision was researched and reconfirmed — see the plan doc's "Order Book vs Pooled Model" note). This is a learning project: the user is building it to learn Sui Move and DeFi mechanism design, not shipping to mainnet imminently.

## Collaboration style — read this first

The user writes all Move source code themselves. **Do not use Edit/Write on files under `sources/` or `tests/`.** Your role is to teach: explain the *why* behind each piece of logic (design rationale, Move/Sui-specific constraints, why an API/pattern is needed), review code after the user writes it (read it, run `sui move build` / `sui move test`), and flag bugs or risks. It's fine to write to the plan doc, run build/test commands, or do read-only exploration — just don't author source changes for them.

## Full architecture & roadmap

Complete module map, 3 core data-flow scenarios, Move/Sui-specific risks, and the full milestone plan (0–10) live at:
`D:\ClaudeCodeData\.claude\plans\glittery-yawning-steele.md`
Read this before answering "what's next" or any architecture question — don't re-derive it from scratch or skip ahead in the milestone order without checking it (module dependencies like funding→oracle+clock, liquidation→margin follow this sequence).

## Current focus: Milestone 5 (funding rate)

M4 is done at unit-test scope (staleness integration testing deliberately deferred to M8-9, see below — user's explicit call). Now building `funding.move`. Prerequisite not yet done: `long_open_interest`/`short_open_interest` on `Market` are still never incremented anywhere (open interest tracking was never wired in M1-3) — funding's skew formula needs this, so it must be wired first.

## Current status (verified 2026-07-27 via `sui move test`)

- M0–3 done. M4 (Pyth oracle) wiring in progress: `oracle.move` is implemented (feed-id match, staleness via `Clock`, negative-price/expo-sign validation, scales Pyth's price to a 1e9 fixed-point) and **is now wired into `router.move`**, using the split pattern: `open_position`/`close_position` are thin public wrappers that call `oracle::get_validated_price(market, price_info_object, clock)` then delegate to `public(package) open_position_at_price`/`close_position_at_price`, which take a plain `u64` price. That split exists specifically so unit tests can keep exercising the math/logic path directly (see next point) without needing a real `PriceInfoObject`.
- Build clean, **11/11 tests passing**. `router_tests.move` now calls `open_position_at_price`/`close_position_at_price` directly with literal prices instead of going through the oracle-touching public entrypoints.
- Test coverage, corrected understanding: **`PriceInfoObject` cannot be constructed from `perp_dex`'s own test code at all** — `price_info::new_price_info_object` is `public(friend)` restricted to `pyth::pyth`/`pyth::state`, and Pyth's own `#[test_only]` test-harness module (`pyth_tests`, which has a `setup_test()` that fabricates one) does not get compiled/exposed to downstream dependents under `sui move test` — Move test-only code never leaks across the dependency graph. Consequence:
  - **Feed-id mismatch IS unit-tested now** — `oracle_tests::mismatch_feed_id` calls `validate_and_scale` with a wrong feed id and asserts it aborts with `EInvalidID` (abort code 1). Done.
  - **Staleness rejection is NOT unit-testable** — the check happens inside Pyth's own `pyth::get_price_no_older_than`, before our code ever runs, and exercising it needs a real `PriceInfoObject` + real Wormhole/Pyth verification machinery. This requires a localnet (`sui start`) integration test with Pyth+Wormhole actually deployed, not a `sui move test` unit test. The plan doc already anticipated this in its Verifikasi section.
- Known warnings (expected, not action items): `EMarketPaused` unused (reserved for M6 pause/circuit-breaker), `sui::math::pow` deprecated call in `oracle.move`, one harmless upstream Pyth doc-comment warning.
- Reminder for later: `pyth_price_feed_id` in test markets is currently an arbitrary ASCII literal (`b"BTC_PERP_FEED_ID"`), not a real Pyth feed id. Real Pyth price feed ids are specific 32-byte identifiers (e.g. BTC/USD's is a fixed 32-byte hex value from Pyth's price feed registry) — `create_market` must be called with the real 32-byte id before any localnet/testnet integration test will actually match a genuine `PriceInfoObject`.

## Known gaps / risks to flag when relevant

1. **Rounding-direction bug (real, worth fixing soon):** `math::mul_div` always floors. In `router::close_position`'s loss branch, `pnl` is computed with `mul_div` and rounds down — but a loss should round *up* (protocol-favor: the vault should never collect less than the true loss). Right now the vault bleeds a small amount on every losing trade. Fix direction: add a `mul_div_round_up` variant and use it consistently — round down whenever paying value *out* of the vault, round up whenever charging value *to* the vault.
2. **Two un-reconciled sources of max leverage:** `market.max_leverage` (plain integer) and `market.initial_margin_bps` (percentage) are both stored, but `initial_margin_bps` is only checked once at `create_market` (`initial_margin_bps > maintenance_margin_bps`) and never actually enforced in `open_position` — only `max_leverage` gates position size. They can drift and imply different caps (current test market: `max_leverage=20` but `initial_margin_bps=1000` i.e. 10% implies 10x). Decide whether to derive one from the other or validate consistency at creation.
3. **Underwater positions can't close today:** `close_position` aborts with `ELossExceedsCollateral` when loss exceeds collateral. With no liquidation yet (M6), such a position is stuck — not closable by anyone, including its owner — and represents unrealized bad debt sitting against the vault. Expected at this milestone, but real exposure until M6 lands.
4. Confirmed-inert fields (all intentionally deferred to later milestones per the plan): `open_fee_bps`/`close_fee_bps` stored but never charged; `long_open_interest`/`short_open_interest` never incremented; `max_open_interest` never checked; `paused` never checked in router.
5. `max_price_stanless_secs` is a typo (staleness) baked into a public getter name in `market.move`/`oracle.move`. Cheap to rename now, gets more expensive the more modules reference it.
6. The fixed-point price scale (`PRICE_DECIMALS = 9` in `oracle.move`) is an implicit contract, not written down anywhere as an invariant. Not a bug today since `mock_price` and real oracle price are never mixed for the same position, but once the router switches over, entry_price and exit_price must always come from the same source/scale — worth stating explicitly as a doc comment or shared const when M4 wires the router.

## Windows-specific toolchain note

`sui move build` breaks on the Pyth/Wormhole git dependencies due to a Windows-specific symlink bug in Sui's dependency fetcher (their `Move.toml` is a symlink that gets checked out as a plain text file with `core.symlinks=false` forced on the local clone). Recurring fix lives in the `project_sui_move_windows_symlink_bug` memory — `git config core.symlinks true` + `git checkout -f HEAD -- <path>` inside the affected `.move\git\<...>` cache folder, redone any time that cache folder is deleted/recreated.
