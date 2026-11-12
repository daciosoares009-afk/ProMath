import { binCenter, BIN_WIDTH, CENTER, HEIGHT, pegs, WIDTH } from './galton'

export type Point = { x: number; y: number }
export function drawBoard(ctx: CanvasRenderingContext2D, ball: Point | null, trail: Point[], bin: number | null, time: number, impact = 0) {
  ctx.clearRect(0, 0, WIDTH, HEIGHT)
  const background = ctx.createLinearGradient(0, 0, 0, HEIGHT)
  background.addColorStop(0, '#0b2036')
  background.addColorStop(1, '#081222')
  ctx.fillStyle = background
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
  ctx.strokeStyle = '#1a39505e'
  ctx.lineWidth = 0.8
  for (let x = 8; x < WIDTH; x += 21) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, HEIGHT); ctx.stroke() }
  for (let y = 9; y < HEIGHT; y += 21) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); ctx.stroke() }

  const glow = ctx.createRadialGradient(CENTER, 150, 8, CENTER, 155, 250)
  glow.addColorStop(0, '#14559160')
  glow.addColorStop(1, '#07122200')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  ctx.beginPath()
  ctx.moveTo(70, 275); ctx.lineTo(70, 246); ctx.lineTo(218, 48)
  ctx.quadraticCurveTo(234, 27, 249, 27)
  ctx.lineTo(311, 27); ctx.quadraticCurveTo(326, 27, 342, 48)
  ctx.lineTo(490, 246); ctx.lineTo(490, 275)
  ctx.fillStyle = '#0c263b9c'; ctx.fill()
  ctx.strokeStyle = '#368aaa'; ctx.lineWidth = 2
  ctx.shadowColor = '#0ba6ef'; ctx.shadowBlur = 13; ctx.stroke(); ctx.shadowBlur = 0

  ctx.strokeStyle = '#6ae6ff50'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(80, 258); ctx.lineTo(80, 249); ctx.lineTo(226, 52)
  ctx.moveTo(480, 258); ctx.lineTo(480, 249); ctx.lineTo(334, 52); ctx.stroke()
  ctx.fillStyle = '#061728'; ctx.beginPath(); ctx.roundRect(CENTER - 22, 14, 44, 35, 8); ctx.fill()
  ctx.strokeStyle = '#2b83aa'; ctx.stroke()
  ctx.fillStyle = '#61e5ff'; ctx.fillRect(CENTER - 9, 17, 18, 2)
  for (const { x, y } of pegs) {
    ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fillStyle = '#166083'; ctx.fill()
    ctx.beginPath(); ctx.arc(x, y, 7.6, 0, Math.PI * 2); ctx.fillStyle = '#081e32'; ctx.fill()
    const peg = ctx.createRadialGradient(x - 2, y - 2, 0, x, y, 5.7)
    peg.addColorStop(0, '#e9fbff'); peg.addColorStop(0.5, '#72e7ff'); peg.addColorStop(1, '#1889bd')
    ctx.beginPath(); ctx.arc(x, y, 5.7, 0, Math.PI * 2); ctx.fillStyle = peg; ctx.fill()
  }

  for (let i = 0; i < 5; i++) {
    const x = binCenter(i) - BIN_WIDTH / 2
    const selected = i === bin
    const bay = ctx.createLinearGradient(0, 266, 0, 324)
    bay.addColorStop(0, selected ? '#533a1c' : '#11314b')
    bay.addColorStop(1, selected ? '#977336' : '#102137')
    ctx.fillStyle = bay
    ctx.beginPath(); ctx.roundRect(x + 2, 267, BIN_WIDTH - 4, 54, [3, 3, 7, 7]); ctx.fill()
    ctx.strokeStyle = selected ? '#ffd375' : '#2d6079'; ctx.stroke()
    ctx.fillStyle = selected ? '#ffe7a4' : '#40bdd888'
    ctx.fillRect(x + 9, 317, BIN_WIDTH - 18, 2)
  }

  for (let i = 0; i < 32; i++) {
    const side = i % 2 ? 1 : -1
    const x = CENTER + side * (137 + (i * 61 % 124))
    const y = 18 + (i * 47 % 233)
    ctx.fillStyle = `rgba(92,210,252,${0.16 + (1 + Math.sin(time / 630 + i)) * 0.12})`
    ctx.fillRect(x, y, i % 7 ? 1 : 3, i % 7 ? 1 : 3)
  }
  trail.forEach(({ x, y }, index) => {
    const ratio = (index + 1) / trail.length
    ctx.beginPath(); ctx.arc(x, y, 2 + ratio * 4, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255,188,69,${ratio * 0.28})`; ctx.fill()
  })
  if (ball) {
    if (impact > 0.15) {
      ctx.beginPath(); ctx.arc(ball.x, ball.y, 12 + (1 - impact) * 17, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(255,217,135,${impact})`; ctx.stroke()
    }
    const sphere = ctx.createRadialGradient(ball.x - 3, ball.y - 4, 1, ball.x, ball.y, 11)
    sphere.addColorStop(0, '#fff8d2'); sphere.addColorStop(0.42, '#ffdb79'); sphere.addColorStop(0.8, '#ef9c2e'); sphere.addColorStop(1, '#a45313')
    ctx.beginPath(); ctx.arc(ball.x, ball.y, 9.5, 0, Math.PI * 2)
    ctx.shadowBlur = 21; ctx.shadowColor = '#ffba42'; ctx.fillStyle = sphere; ctx.fill(); ctx.shadowBlur = 0
  }
}

