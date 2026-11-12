import { useEffect, useRef } from 'react'
import { BINS, draw, percent, type Decision, type Drop } from '../../shared/model'
import { drawBoard, type Point } from '../visual/drawBoard'
import { binCenter, HEIGHT, startPhysics, WIDTH } from '../visual/galton'

const demo = [
  [1, 0, 1, 0], [0, 0, 1, 0], [1, 1, 0, 1],
] satisfies Decision[][]

export function Board({ preview = false, drop, onSettled }: { preview?: boolean; drop?: Drop | null; onSettled?: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const callback = useRef(onSettled)
  callback.current = onSettled
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) {
      if (drop) callback.current?.()
      return
    }
    const pixelRatio = Math.min(window.devicePixelRatio, 2)
    canvas.width = WIDTH * pixelRatio
    canvas.height = HEIGHT * pixelRatio
    ctx.scale(pixelRatio, pixelRatio)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let previous = 0
    let demoIndex = 0
    let animation = drop ? startPhysics(drop) : null
    let activeDrop = drop ?? null
    let ball: Point | null = { x: WIDTH / 2, y: 34 }
    let selected: number | null = null
    let trail: Point[] = []
    let restartAt = 650
    let notified = false
    const frame = (now: number) => {
      const time = now - startedAt
      if (preview && !reduced && !animation && time >= restartAt) {
        const path = demo[demoIndex++ % demo.length]
        let i = 0
        activeDrop = { id: 'preview', ...draw(() => path[i++]) }
        animation = startPhysics(activeDrop)
        trail = []
        selected = null
      }
      let impact = 0
      if (animation && activeDrop) {
        const result = reduced ? { x: binCenter(activeDrop.bin), y: 301, done: true, impact: 0 } : animation.step(previous ? now - previous : 16)
        ball = { x: result.x, y: result.y }
        impact = result.impact
        if (!result.done) trail = [...trail.slice(-13), ball]
        else {
          animation.dispose()
          animation = null
          trail = []
          selected = activeDrop.bin
          restartAt = time + 1500
        }
      }
      drawBoard(ctx, ball, trail, selected, reduced ? 0 : time, impact)
      if (drop && selected !== null && !notified) {
        notified = true
        callback.current?.()
      }
      previous = now
      if (!reduced && (preview || animation)) raf = requestAnimationFrame(frame)
    }
    const startedAt = performance.now()
    raf = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf); animation?.dispose() }
  }, [preview, drop])
  return <div className="board">
    <canvas ref={ref} aria-label="Máquina de Galton com quatro fileiras de pinos e cinco compartimentos" role="img"/>
    <div className="bins">
      {BINS.map(({ points, probability }) => <div key={points}><b>{points}<small> pts</small></b><span>{percent(probability)}</span></div>)}
    </div>
  </div>
}
