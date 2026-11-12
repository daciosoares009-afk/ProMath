import Matter from 'matter-js'
import type { Decision, Drop } from '../../shared/model'

export const WIDTH = 560
export const HEIGHT = 326
export const BIN_WIDTH = 84
export const CENTER = WIDTH / 2
const FIRST_Y = 91
const ROW_HEIGHT = 48
const PEG_RADIUS = 5
const BALL_RADIUS = 9
const STEP = 1000 / 60
const IMPACT_AT = 0.3
const ROW_MS = 480
const END_MS = 430
const last = 4 * ROW_MS + END_MS
export const pegs = Array.from({ length: 4 }, (_, row) =>
  Array.from({ length: row + 1 }, (_, col) => ({
    x: CENTER + (col - row / 2) * BIN_WIDTH, y: FIRST_Y + row * ROW_HEIGHT,
  }))).flat()
export const binCenter = (bin: number) => CENTER + (bin - 2) * BIN_WIDTH

function target(path: Decision[], elapsed: number) {
  const row = Math.min(4, Math.floor(elapsed / ROW_MS))
  const progress = (elapsed - row * ROW_MS) / (row === 4 ? END_MS : ROW_MS)
  const rights = path.slice(0, row).filter(Boolean).length
  const x = CENTER + (rights - row / 2) * BIN_WIDTH
  if (row === 4) return { x, y: 256 + 45 * progress }
  const sign = path[row] === 1 ? 1 : -1
  const turn = Math.max(0, (progress - IMPACT_AT) / (1 - IMPACT_AT))
  const startY = row ? FIRST_Y + (row - 1) * ROW_HEIGHT + 21 : 36
  const hitY = FIRST_Y + row * ROW_HEIGHT - BALL_RADIUS - PEG_RADIUS + 1
  const endY = row === 3 ? 256 : FIRST_Y + row * ROW_HEIGHT + 21
  const y = progress < IMPACT_AT
    ? startY + (hitY - startY) * progress / IMPACT_AT
    : hitY + (endY - hitY) * turn
  return { x: x + sign * BIN_WIDTH / 2 * (turn > 0 ? Math.sin(turn * Math.PI / 2) : progress / IMPACT_AT * 4 / (BIN_WIDTH / 2)), y }
}

export function startPhysics(drop: Drop) {
  const engine = Matter.Engine.create({ gravity: { x: 0, y: 0.8, scale: 0.001 } })
  const body = Matter.Bodies.circle(CENTER, 36, BALL_RADIUS, { restitution: 0.55, friction: 0, frictionAir: 0.04 })
  const obstacles = pegs.map(({ x, y }) => Matter.Bodies.circle(x, y, PEG_RADIUS, { isStatic: true, restitution: 0.62 }))
  const floor = Matter.Bodies.rectangle(CENTER, 318, 440, 10, { isStatic: true })
  const separators = Array.from({ length: 6 }, (_, i) => Matter.Bodies.rectangle(binCenter(0) - BIN_WIDTH / 2 + i * BIN_WIDTH, 299, 4, 48, { isStatic: true }))
  const pegIds = new Set(obstacles.map(peg => peg.id))
  Matter.Composite.add(engine.world, [body, floor, ...obstacles, ...separators])
  let elapsed = 0
  let debt = 0
  let impact = 0
  Matter.Events.on(engine, 'collisionStart', ({ pairs }) => {
    if (pairs.some(({ bodyA, bodyB }) => pegIds.has(bodyA.id) || pegIds.has(bodyB.id))) impact = 1
  })
  return {
    step(delta: number) {
      debt += Math.min(delta, 48)
      while (debt >= STEP && elapsed < last) {
        debt -= STEP
        elapsed += STEP
        const { x, y } = target(drop.path, Math.min(elapsed, last))
        const velocity = body.velocity
        Matter.Body.setVelocity(body, {
          x: velocity.x * 0.3 + (x - body.position.x) * 0.34,
          y: velocity.y * 0.28 + (y - body.position.y) * 0.29,
        })
        Matter.Engine.update(engine, STEP)
        impact *= 0.75
      }
      const done = elapsed >= last
      return { x: done ? binCenter(drop.bin) : body.position.x, y: done ? 301 : body.position.y, done, impact }
    },
    dispose() { Matter.Events.off(engine, 'collisionStart'); Matter.Engine.clear(engine) },
  }
}

