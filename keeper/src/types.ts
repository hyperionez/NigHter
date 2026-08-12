export interface PositionOpenedEvent {
  position_id: string;
  market_id: string;
  owner: string;
  is_long: boolean;
  size: string;
  collateral: string;
  entry_price: string;
}

export interface PositionClosedEvent {
  position_id: string;
  market_id: string;
  owner: string;
  net_is_profit: boolean;
  net_result: string;
  payout: string;
}

export interface PositionLiquidatedEvent {
  position_id: string;
  market_id: string;
  owner: string;
  keeper: string;
  bad_debt: boolean;
}

export interface TrackedPosition {
  positionId: string;
  marketId: string;
  owner: string;
  isLong: boolean;
}
