import assert from 'node:assert/strict'
import test from 'node:test'
import { draw, type Decision } from '../shared/model.ts'
import { binCenter, startPhysics } from '../src/visual/galton.ts'

test('a máquina colide com pinos e chega ao destino dos 16 caminhos', () => {
  for (let bits = 0; bits < 16; bits++) {
    let i = 0
    const drop = { id: String(bits), ...draw(() => ((bits >> i++) & 1) as Decision) }
    const physics = startPhysics(drop)
    let impacts = 0
    let previousImpact = 0
    let frame = physics.step(1000 / 60)
    for (let j = 0; j < 160 && !frame.done; j++) {
      if (frame.impact > previousImpact) impacts++
      previousImpact = frame.impact
      frame = physics.step(1000 / 60)
    }
    physics.dispose()
    assert.ok(frame.done, `Caminho ${drop.path.join('')} não concluiu`)
    assert.ok(impacts >= 4, `Caminho ${drop.path.join('')} teve somente ${impacts} colisões com pinos`)
    assert.equal(frame.x, binCenter(drop.bin))
    assert.equal(frame.y, 301)
  }
})
