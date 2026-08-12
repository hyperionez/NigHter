import type { OnChainMarket, OnChainPosition } from "./chain.js";

const FUNDING_INDEX_PRECISION = 1_000_000_000n;

function mulDivFloor(a: bigint, b: bigint, c: bigint): bigint {
  return (a * b) / c;
}

function mulDivCeil(a: bigint, b: bigint, c: bigint): bigint {
  return (a * b + c - 1n) / c;
}

export function calculatePnl(
  entryPrice: bigint,
  currentPrice: bigint,
  size: bigint,
  isLong: boolean
): { isProfit: boolean; pnl: bigint } {
  const isProfit = (isLong && currentPrice >= entryPrice) || (!isLong && currentPrice <= entryPrice);
  const priceDiff = currentPrice >= entryPrice ? currentPrice - entryPrice : entryPrice - currentPrice;
  const pnl = isProfit ? mulDivFloor(size, priceDiff, entryPrice) : mulDivCeil(size, priceDiff, entryPrice);
  return { isProfit, pnl };
}

export function fundingSettlement(
  market: OnChainMarket,
  isLong: boolean,
  entryChargeIndex: bigint,
  entryCreditIndex: bigint,
  size: bigint
): { isCharge: boolean; amount: bigint } {
  const currentCharge = isLong ? market.cumulativeFundingLongCharge : market.cumulativeFundingShortCharge;
  const currentCredit = isLong ? market.cumulativeFundingLongCredit : market.cumulativeFundingShortCredit;
  const chargeDelta = currentCharge - entryChargeIndex;
  const creditDelta = currentCredit - entryCreditIndex;

  const chargeAmount = mulDivCeil(size, chargeDelta, FUNDING_INDEX_PRECISION);
  const creditAmount = mulDivFloor(size, creditDelta, FUNDING_INDEX_PRECISION);

  return chargeAmount >= creditAmount
    ? { isCharge: true, amount: chargeAmount - creditAmount }
    : { isCharge: false, amount: creditAmount - chargeAmount };
}

export function combineNet(
  isProfit: boolean,
  pnl: bigint,
  fundingIsCharge: boolean,
  fundingAmount: bigint
): { netResult: bigint; netIsProfit: boolean } {
  if (isProfit) {
    if (fundingIsCharge) {
      return pnl > fundingAmount
        ? { netResult: pnl - fundingAmount, netIsProfit: true }
        : { netResult: fundingAmount - pnl, netIsProfit: false };
    }
    return { netResult: pnl + fundingAmount, netIsProfit: true };
  }
  if (fundingIsCharge) {
    return { netResult: pnl + fundingAmount, netIsProfit: false };
  }
  return fundingAmount > pnl
    ? { netResult: fundingAmount - pnl, netIsProfit: true }
    : { netResult: pnl - fundingAmount, netIsProfit: false };
}

export function calculateMarginRatio(
  collateral: bigint,
  isProfit: boolean,
  pnl: bigint,
  size: bigint
): { isSolvent: boolean; marginRatioBps: bigint } {
  if (!isProfit && pnl >= collateral) {
    return { isSolvent: false, marginRatioBps: 0n };
  }
  const equity = isProfit ? collateral + pnl : collateral - pnl;
  return { isSolvent: true, marginRatioBps: mulDivFloor(equity, 10_000n, size) };
}

export function isLiquidatable(
  collateral: bigint,
  isProfit: boolean,
  pnl: bigint,
  size: bigint,
  maintenanceMarginBps: bigint
): boolean {
  const { isSolvent, marginRatioBps } = calculateMarginRatio(collateral, isProfit, pnl, size);
  return !isSolvent || marginRatioBps < maintenanceMarginBps;
}

export function checkLiquidatable(
  position: OnChainPosition,
  market: OnChainMarket,
  currentPrice: bigint
): { liquidatable: boolean; netResult: bigint; netIsProfit: boolean; marginRatioBps: bigint } {
  const { isProfit, pnl } = calculatePnl(position.entryPrice, currentPrice, position.size, position.isLong);
  const funding = fundingSettlement(
    market,
    position.isLong,
    position.entryFundingChargeIndex,
    position.entryFundingCreditIndex,
    position.size
  );
  const { netResult, netIsProfit } = combineNet(isProfit, pnl, funding.isCharge, funding.amount);
  const { marginRatioBps } = calculateMarginRatio(position.collateral, netIsProfit, netResult, position.size);
  const liquidatable = isLiquidatable(
    position.collateral,
    netIsProfit,
    netResult,
    position.size,
    market.maintenanceMarginBps
  );
  return { liquidatable, netResult, netIsProfit, marginRatioBps };
}
