import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CHART_SYMBOL } from '@/config/index.ts'
import './PriceChart.css'

const INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d', '1w'] as const
type Interval = (typeof INTERVALS)[number]

const HISTORY = 500
const MIN_VISIBLE = 15
const MAX_VISIBLE = 320
const DEFAULT_VISIBLE = 90
const RIGHT_MARGIN = 0.12
const MIN_AXIS_WIDTH = 56
const MAX_AXIS_WIDTH = 120
const MIN_PLOT_HEIGHT = 180

export interface Candle {
  openTime: number
  open: number
  high: number
  low: number
  close: number
}

interface View {
  right: number
  count: number
}

async function fetchCandles(interval: Interval, signal: AbortSignal): Promise<Candle[]> {
  const url = `https://api.binance.com/api/v3/klines?symbol=${CHART_SYMBOL}&interval=${interval}&limit=${HISTORY}`
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function priceLabel(price: number): string {
  return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function niceTicks(low: number, high: number, target: number): number[] {
  const span = high - low
  if (!(span > 0)) return [low]
  const rough = span / target
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)))
  const normalised = rough / magnitude
  const step =
    (normalised >= 5 ? 5 : normalised >= 2.5 ? 2.5 : normalised >= 2 ? 2 : 1) * magnitude
  const out: number[] = []
  for (let value = Math.ceil(low / step) * step; value <= high; value += step) {
    out.push(Number(value.toFixed(10)))
  }
  return out
}

function dateLabel(ms: number, interval: Interval): string {
  const date = new Date(ms)
  const day = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  if (interval === '1d' || interval === '1w') return day
  return `${day}, ${date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
}

function timeLabel(ms: number, interval: Interval): string {
  const date = new Date(ms)
  if (interval === '1d' || interval === '1w') {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export function PriceChart() {
  const [interval, setInterval] = useState<Interval>('1d')
  const [scale, setScale] = useState<'auto' | 'log'>('auto')
  const [view, setView] = useState<View | undefined>(undefined)
  const [size, setSize] = useState({ width: 760, height: 300 })
  const [cursor, setCursor] = useState<{ x: number; y: number } | undefined>(undefined)

  const plotRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ x: number; right: number } | undefined>(undefined)

  const { data: candles, error } = useQuery({
    queryKey: ['candles', interval],
    retry: false,
    refetchInterval: 15_000,
    queryFn: ({ signal }) => fetchCandles(interval, signal),
  })

  useEffect(() => {
    const node = plotRef.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height }),
    )
    observer.observe(node)
    setSize({ width: node.clientWidth, height: node.clientHeight })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    setView(undefined)
  }, [interval])

  const total = candles?.length ?? 0
  const count = clamp(view?.count ?? DEFAULT_VISIBLE, MIN_VISIBLE, Math.max(MIN_VISIBLE, total))
  const right = view?.right ?? total - 1

  const plotWidth = Math.max(80, size.width)
  const plotHeight = Math.max(MIN_PLOT_HEIGHT, size.height)
  const slot = plotWidth / count
  const first = right - count + 1

  const limits = useCallback(
    (nextCount: number) => ({
      min: Math.min(total - 1, nextCount - 1),
      max: total - 1 + nextCount * RIGHT_MARGIN,
    }),
    [total],
  )

  const zoom = useCallback(
    (factor: number, anchorX: number) => {
      if (total === 0) return
      setView((current) => {
        const activeCount = clamp(current?.count ?? DEFAULT_VISIBLE, MIN_VISIBLE, Math.max(MIN_VISIBLE, total))
        const activeRight = current?.right ?? total - 1
        const activeSlot = plotWidth / activeCount
        const anchorIndex = activeRight - activeCount + 1 + anchorX / activeSlot

        const nextCount = clamp(Math.round(activeCount * factor), MIN_VISIBLE, Math.min(MAX_VISIBLE, total))
        const nextFirst = anchorIndex - (anchorX / plotWidth) * nextCount
        const bounds = limits(nextCount)
        return { count: nextCount, right: clamp(nextFirst + nextCount - 1, bounds.min, bounds.max) }
      })
    },
    [limits, plotWidth, total],
  )

  useEffect(() => {
    const node = plotRef.current
    if (!node) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = node.getBoundingClientRect()
      zoom(event.deltaY > 0 ? 1.15 : 1 / 1.15, event.clientX - rect.left)
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  }, [zoom])

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (total === 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { x: event.clientX, right }
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    setCursor({ x: event.clientX - rect.left, y: event.clientY - rect.top })

    const drag = dragRef.current
    if (!drag) return
    const shifted = drag.right - (event.clientX - drag.x) / slot
    const bounds = limits(count)
    setView({ count, right: clamp(shifted, bounds.min, bounds.max) })
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current) event.currentTarget.releasePointerCapture(event.pointerId)
    dragRef.current = undefined
  }

  const fromIndex = Math.max(0, Math.floor(first))
  const toIndex = Math.min(total - 1, Math.ceil(right))
  const visible = candles?.slice(fromIndex, toIndex + 1) ?? []

  const high = visible.length ? Math.max(...visible.map((c) => c.high)) : 0
  const low = visible.length ? Math.min(...visible.map((c) => c.low)) : 0
  const pad = (high - low) * 0.08 || 1
  const top = high + pad
  const span = top - (low - pad) || 1

  const bottom = top - span
  const logTop = Math.log(Math.max(top, 1e-9))
  const logBottom = Math.log(Math.max(bottom, 1e-9))
  const logSpan = logTop - logBottom || 1
  const useLog = scale === 'log' && bottom > 0

  const y = (price: number) =>
    useLog
      ? ((logTop - Math.log(Math.max(price, 1e-9))) / logSpan) * plotHeight
      : ((top - price) / span) * plotHeight

  const priceAt = (offset: number) =>
    useLog
      ? Math.exp(logTop - (offset / plotHeight) * logSpan)
      : top - (offset / plotHeight) * span

  const x = (index: number) => (index - first) * slot + slot / 2

  const last = candles?.[total - 1]
  const ticks = visible.length ? niceTicks(bottom, top, plotHeight > 360 ? 7 : 5) : []

  const tickStep = ticks.length > 1 ? Math.abs(ticks[1] - ticks[0]) : 0
  const tickDecimals = tickStep >= 1 ? 0 : 2
  const tickText = (value: number) =>
    value.toLocaleString(undefined, {
      minimumFractionDigits: tickDecimals,
      maximumFractionDigits: tickDecimals,
    })

  const widestLabel = Math.max(
    7,
    ...ticks.map((tick) => tickText(tick).length),
    last ? priceLabel(last.close).length + 2 : 0,
    cursor ? priceLabel(priceAt(cursor.y)).length + 2 : 0,
  )
  const axisWidth = clamp(Math.round(widestLabel * 6 + 16), MIN_AXIS_WIDTH, MAX_AXIS_WIDTH)

  const axisLabels = visible.length
    ? [0, 0.25, 0.5, 0.75, 1].map((f) => {
        const candle = visible[Math.min(visible.length - 1, Math.round(f * (visible.length - 1)))]
        return { key: candle.openTime, label: timeLabel(candle.openTime, interval) }
      })
    : []

  const hovered =
    cursor && visible.length
      ? candles?.[clamp(Math.round(first + cursor.x / slot), 0, total - 1)]
      : undefined

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
        {hovered && (
          <span className="chart-readout">
            <span>O {priceLabel(hovered.open)}</span>
            <span>H {priceLabel(hovered.high)}</span>
            <span>L {priceLabel(hovered.low)}</span>
            <span className={hovered.close >= hovered.open ? 'num-long' : 'num-short'}>
              C {priceLabel(hovered.close)}
            </span>
          </span>
        )}
        <div className="chart-intervals">
          <button
            type="button"
            className={scale === 'auto' ? 'interval interval-on' : 'interval'}
            title="Fit the visible candles"
            onClick={() => setScale('auto')}
          >
            Auto
          </button>
          <button
            type="button"
            className={scale === 'log' ? 'interval interval-on' : 'interval'}
            title="Space price levels logarithmically"
            onClick={() => setScale('log')}
          >
            Log
          </button>
        </div>

        <button
          type="button"
          className="interval"
          onClick={() => setView(undefined)}
          title="Reset zoom and scroll back to the latest candle"
        >
          Reset
        </button>
        <span className="panel-meta">Binance spot</span>
      </div>

      <div className="chart-frame">
        <div
          ref={plotRef}
          className="chart-plot"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onPointerLeave={(event) => {
            endDrag(event)
            setCursor(undefined)
          }}
          onDoubleClick={() => setView(undefined)}
          role="img"
          aria-label={
            last
              ? `${CHART_SYMBOL} ${interval} candles, ${count} of ${total} periods visible, latest close ${priceLabel(last.close)}`
              : 'Price chart loading'
          }
        >
          <svg width={plotWidth} height={plotHeight} className="chart-svg">
            {ticks.map((price) => (
              <line
                key={price}
                className="gridline"
                x1={0}
                x2={plotWidth}
                y1={y(price)}
                y2={y(price)}
              />
            ))}

            {visible.map((candle, offset) => {
              const index = fromIndex + offset
              const cx = x(index)
              if (cx < -slot || cx > plotWidth + slot) return null
              const up = candle.close >= candle.open
              const bodyTop = y(Math.max(candle.open, candle.close))
              const bodyHeight = Math.max(Math.abs(y(candle.open) - y(candle.close)), 1)
              const bodyWidth = Math.max(1, slot * 0.62)
              return (
                <g key={candle.openTime} className={up ? 'candle-up' : 'candle-down'}>
                  <line x1={cx} x2={cx} y1={y(candle.high)} y2={y(candle.low)} />
                  <rect x={cx - bodyWidth / 2} y={bodyTop} width={bodyWidth} height={bodyHeight} />
                </g>
              )
            })}

            {cursor && (
              <g className="crosshair">
                <line x1={cursor.x} x2={cursor.x} y1={0} y2={plotHeight} />
                <line x1={0} x2={plotWidth} y1={cursor.y} y2={cursor.y} />
              </g>
            )}
          </svg>

          {error && <span className="chart-error">Chart unavailable: {error.message}</span>}
        </div>

        <div className="chart-axis-y" style={{ width: axisWidth }}>
          {ticks.map((price) => (
            <span key={price} className="axis-tick" style={{ top: y(price) }}>
              {tickText(price)}
            </span>
          ))}
          {last && (
            <span className="axis-last" style={{ top: y(last.close) }}>
              {priceLabel(last.close)}
            </span>
          )}
          {cursor && (
            <span className="axis-cursor" style={{ top: cursor.y }}>
              {priceLabel(priceAt(cursor.y))}
            </span>
          )}
        </div>
      </div>

      <div className="chart-axis-x" style={{ paddingRight: axisWidth }}>
        {axisLabels.map((tick) => (
          <span key={tick.key}>{tick.label}</span>
        ))}
        {cursor && hovered && (
          <span
            className="axis-x-cursor"
            style={{ left: clamp(cursor.x, 56, Math.max(56, plotWidth - 56)) }}
          >
            {dateLabel(hovered.openTime, interval)}
          </span>
        )}
      </div>
    </section>
  )
}
