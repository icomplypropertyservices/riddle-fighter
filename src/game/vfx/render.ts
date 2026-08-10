/**
 * Draw all VFX particles with world-class blending.
 */
import type { VfxParticle } from './types'

export function tickVfx(list: VfxParticle[]): VfxParticle[] {
  for (const p of list) {
    p.x += p.vx
    p.y += p.vy
    p.vy += p.gravity ?? 0.12
    p.vx *= p.drag ?? 0.98
    p.vy *= p.drag ?? 0.98
    if (p.spin) p.rot = (p.rot || 0) + p.spin
    p.life--
  }
  return list.filter((p) => p.life > 0)
}

export function drawVfx(ctx: CanvasRenderingContext2D, list: VfxParticle[]): void {
  for (const p of list) {
    const t = Math.max(0, p.life / p.max)
    const a = Math.min(1, t * 1.2)
    ctx.save()
    ctx.globalAlpha = a
    ctx.translate(p.x, p.y)
    if (p.rot) ctx.rotate(p.rot)

    if (p.glow) {
      ctx.shadowColor = p.color
      ctx.shadowBlur = p.glow * t
    }

    switch (p.kind) {
      case 'ring': {
        ctx.strokeStyle = p.color
        ctx.lineWidth = 1.5 + (1 - t) * 2.5
        ctx.beginPath()
        ctx.arc(0, 0, p.size + (1 - t) * 18, 0, Math.PI * 2)
        ctx.stroke()
        break
      }
      case 'star':
      case 'orb': {
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size * (0.8 + t))
        g.addColorStop(0, '#fff')
        g.addColorStop(0.35, p.color)
        g.addColorStop(1, 'transparent')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(0, 0, p.size * (0.9 + (1 - t) * 0.6), 0, Math.PI * 2)
        ctx.fill()
        break
      }
      case 'ember': {
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size)
        g.addColorStop(0, '#fde68a')
        g.addColorStop(0.4, p.color)
        g.addColorStop(1, 'transparent')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(0, 0, p.size * t + 1, 0, Math.PI * 2)
        ctx.fill()
        break
      }
      case 'petal': {
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.ellipse(0, 0, p.size * 1.2, p.size * 0.55, 0, 0, Math.PI * 2)
        ctx.fill()
        break
      }
      case 'arc':
      case 'slash': {
        ctx.strokeStyle = p.color
        ctx.lineWidth = Math.max(1, p.size * 0.6)
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(-p.size * 1.5, 0)
        ctx.quadraticCurveTo(0, -p.size, p.size * 1.8, 0)
        ctx.stroke()
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(-p.size, 0)
        ctx.lineTo(p.size * 1.2, 0)
        ctx.stroke()
        break
      }
      case 'glyph': {
        ctx.strokeStyle = p.color
        ctx.lineWidth = 1.5
        ctx.strokeRect(-p.size, -p.size, p.size * 2, p.size * 2)
        ctx.beginPath()
        ctx.moveTo(0, -p.size)
        ctx.lineTo(0, p.size)
        ctx.moveTo(-p.size, 0)
        ctx.lineTo(p.size, 0)
        ctx.stroke()
        break
      }
      case 'smoke':
      case 'dust': {
        ctx.fillStyle = p.color
        ctx.globalAlpha = a * 0.45
        ctx.beginPath()
        ctx.arc(0, 0, p.size * (1.2 - t * 0.3), 0, Math.PI * 2)
        ctx.fill()
        break
      }
      case 'beam': {
        const g = ctx.createLinearGradient(-p.size * 2, 0, p.size * 3, 0)
        g.addColorStop(0, 'transparent')
        g.addColorStop(0.4, p.color)
        g.addColorStop(1, 'transparent')
        ctx.fillStyle = g
        ctx.fillRect(-p.size * 2, -p.size * 0.35, p.size * 5, p.size * 0.7)
        break
      }
      case 'shard':
      case 'debris': {
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.moveTo(0, -p.size)
        ctx.lineTo(p.size * 0.7, p.size * 0.5)
        ctx.lineTo(-p.size * 0.6, p.size * 0.4)
        ctx.closePath()
        ctx.fill()
        break
      }
      case 'shock': {
        ctx.strokeStyle = p.color
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(0, 0, p.size + (1 - t) * 22, 0, Math.PI * 2)
        ctx.stroke()
        break
      }
      default: {
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(0, 0, Math.max(1, p.size * 0.7), 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.restore()
  }
  ctx.globalAlpha = 1
  ctx.shadowBlur = 0
}
