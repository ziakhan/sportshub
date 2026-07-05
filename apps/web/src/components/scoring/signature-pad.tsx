"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Finger/stylus signature pad for the referee sign-off. Draws to a canvas
 * (pointer events — mouse, touch, Apple Pencil all work), exports a compact
 * PNG data URL on every stroke end. Renders at 2x for crisp print output.
 */
export function SignaturePad({
  onChange,
  height = 140,
}: {
  onChange: (dataUrl: string | null) => void
  height?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const hasInk = useRef(false)
  const [empty, setEmpty] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement
    const cssW = parent ? parent.clientWidth : 400
    canvas.width = cssW * 2
    canvas.height = height * 2
    canvas.style.width = `${cssW}px`
    canvas.style.height = `${height}px`
    const ctx = canvas.getContext("2d")
    if (ctx) {
      ctx.scale(2, 2)
      ctx.lineWidth = 2.2
      ctx.lineCap = "round"
      ctx.lineJoin = "round"
      ctx.strokeStyle = "#111827"
    }
  }, [height])

  const pos = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const start = (e: React.PointerEvent) => {
    e.preventDefault()
    canvasRef.current?.setPointerCapture(e.pointerId)
    drawing.current = true
    const ctx = canvasRef.current?.getContext("2d")
    if (!ctx) return
    const { x, y } = pos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return
    e.preventDefault()
    const ctx = canvasRef.current?.getContext("2d")
    if (!ctx) return
    const { x, y } = pos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    hasInk.current = true
  }

  const end = useCallback(() => {
    if (!drawing.current) return
    drawing.current = false
    if (hasInk.current && canvasRef.current) {
      setEmpty(false)
      onChange(canvasRef.current.toDataURL("image/png"))
    }
  }, [onChange])

  const clear = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (canvas && ctx) {
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.restore()
    }
    hasInk.current = false
    setEmpty(true)
    onChange(null)
  }

  return (
    <div>
      <div className="border-ink-300 relative rounded-xl border-2 border-dashed bg-white">
        <canvas
          ref={canvasRef}
          className="block w-full touch-none rounded-xl"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          onPointerCancel={end}
        />
        {empty && (
          <span className="text-ink-300 pointer-events-none absolute inset-0 flex items-center justify-center text-sm">
            Referee signs here
          </span>
        )}
      </div>
      <div className="mt-1 flex justify-end">
        <button
          type="button"
          onClick={clear}
          className="text-ink-500 hover:text-ink-700 text-xs underline"
        >
          Clear signature
        </button>
      </div>
    </div>
  )
}
