import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CHART_SYMBOL } from '@/config/index.ts'
import './PriceChart.css'

const INTERVALS = ['1m', '15m', '1h', '4h'] as const
type Interval = (typeof INTERVALS)[number]

const CANDLE_COUNT = 60

export interface Candle {
  openTime: number
  open: number
  high: number
  low: number
  close: number
}

async function fetchCandles(interval: Interval, signal: AbortSignal): Promise<Candle[]> {
  const url = `https://api.binance.com/api/v3/klines?symbol=${CHART_SYMBOL}&interval=${interval}&limit=${CANDLE_COUNT}`
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`Binance klines returned ${response.status}`)
  const rows = (await response.json()) as unknown[][]
  return rows.map((row) => ({
    openTime: Number(row[0]),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
  }))
}

function clockLabel(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export function PriceChart() {
  const [interval, setInterval] = useState<Interval>('1m')

  const { data: candles, error } = useQuery({
    queryKey: ['candles', interval],
    retry: false,
    refetchInterval: 15_000,
    queryFn: ({ signal }) => fetchCandles(interval, signal),
  })

  const high = candles?.length ? Math.max(...candles.map((c) => c.high)) : 0
  const low = candles?.length ? Math.min(...candles.map((c) => c.low)) : 0
  const span = high - low || 1
  const last = candles?.[candles.length - 1]

  const y = (price: number) => ((high - price) / span) * 100
  const columnWidth = candles?.length ? 100 / candles.length : 0

  const axis = candles?.length
    ? [0, 0.25, 0.5, 0.75, 1].map((f) =>
        clockLabel(candles[Math.min(candles.length - 1, Math.round(f * (candles.length - 1)))].openTime),
      )
    : []

  return (
    <section className="panel chart">
      <div className="chart-head">
        <span className="panel-title">{CHART_SYMBOL}</span>
        <div className="chart-intervals">
          {INTERVALS.map((candidate) => (
            <button
              key={candidate}
              type="button"
              className={candidate === interval ? 'interval interval-on' : 'interval'}
              onClick={() => setInterval(candidate)}
            >
              {candidate}
            </button>
          ))}
        </div>
        <span className="panel-spacer" />
        <span className="panel-meta">Binance spot</span>
      </div>

      <div
        className="chart-plot"
        role="img"
        aria-label={
          candles?.length && last
            ? `${CHART_SYMBOL} ${interval} candles, last ${candles.length} periods, latest close ${last.close}`
            : 'Price chart loading'
        }
      >
        <span className="gridline" style={{ top: '25%' }} />
        <span className="gridline" style={{ top: '50%' }} />
        <span className="gridline" style={{ top: '75%' }} />

        {candles?.map((candle, index) => {
          const up = candle.close >= candle.open
          const left = index * columnWidth
          const bodyTop = y(Math.max(candle.open, candle.close))
          const bodyHeight = Math.max(Math.abs(y(candle.open) - y(candle.close)), 0.6)
          return (
            <span key={candle.openTime}>
              <span
                className={up ? 'wick wick-up' : 'wick wick-down'}
                style={{
                  left: `${left + columnWidth * 0.5}%`,
                  top: `${y(candle.high)}%`,
                  height: `${y(candle.low) - y(candle.high)}%`,
                }}
              />
              <span
                className={up ? 'body body-up' : 'body body-down'}
                style={{
                  left: `${left + columnWidth * 0.2}%`,
                  width: `${columnWidth * 0.6}%`,
                  top: `${bodyTop}%`,
                  height: `${bodyHeight}%`,
                }}
              />
            </span>
          )
        })}

        {last && (
          <span className="chart-tag" style={{ top: `${y(last.close)}%` }}>
            {last.close.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        )}

        {error && <span className="chart-error">Chart unavailable: {error.message}</span>}
      </div>

      <div className="chart-axis">
        {axis.map((label, index) => (
          <span key={`${label}-${index}`}>{label}</span>
        ))}
      </div>
    </section>
  )
}
