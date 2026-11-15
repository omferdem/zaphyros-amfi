// Sahne hareketleri için küçük "sinema" motoru: ekranın üstünde uçan nesneler (ateş topu, kılıç, meteor...), patlamalar,
// yüzen sayılar ve sarsılma/devrilme. Web Animations API kullanır; her sahne raund başına bir Sinema oluşturur,
// sahne kapanınca ya da yeni raund başlayınca durdur() ile bütün öğeler temizlenir.
import { gorselAdresi } from './Gorsel'

export interface Nokta {
  x: number
  y: number
}

/** Bir elemanın ekrandaki merkezi. */
export function merkez(el: Element | null | undefined): Nokta | null {
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) return null
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

export function rastgele(a: number, b: number): number {
  return a + Math.random() * (b - a)
}

interface UcusSecenekleri {
  from: Nokta
  to: Nokta
  /** public/gorseller altındaki dosya (ör. "efekt-ates.webp"); yoksa emoji gösterilir */
  resim?: string
  emoji?: string
  boyut?: number
  sure?: number
  gecik?: number
  /** Yörüngenin yukarı doğru yayı (piksel); negatifse aşağı doğru */
  yay?: number
  /** Uçarken toplam dönüş (derece) */
  don?: number
  /** Arkasında bırakacağı iz (emoji); verilmezse iz yok */
  iz?: string
  /** Varışta ulaşacağı ölçek (1 = aynı) */
  olcek?: number
}

export class Sinema {
  private elemanlar = new Set<HTMLElement>()
  private zamanlayicilar = new Set<ReturnType<typeof setTimeout>>()
  private araliklar = new Set<ReturnType<typeof setInterval>>()
  private animasyonlar = new Set<Animation>()
  durdu = false

  /** Sahne kapandığında ya da yeni raund başladığında çağrılır: uçan her şey kaldırılır. */
  durdur(): void {
    this.durdu = true
    for (const z of this.zamanlayicilar) clearTimeout(z)
    for (const a of this.araliklar) clearInterval(a)
    for (const an of this.animasyonlar) an.cancel()
    for (const el of this.elemanlar) el.remove()
    this.zamanlayicilar.clear()
    this.araliklar.clear()
    this.animasyonlar.clear()
    this.elemanlar.clear()
  }

  bekle(ms: number): Promise<void> {
    return new Promise((coz) => {
      const z = setTimeout(() => {
        this.zamanlayicilar.delete(z)
        coz()
      }, ms)
      this.zamanlayicilar.add(z)
    })
  }

  private eleman(boyut: number, resim?: string, emoji?: string): HTMLElement {
    const el = document.createElement('div')
    el.style.cssText = `position:fixed;left:0;top:0;width:${boyut}px;height:${boyut}px;margin:${-boyut / 2}px 0 0 ${-boyut / 2}px;pointer-events:none;z-index:80;display:flex;align-items:center;justify-content:center;will-change:transform,opacity;opacity:0`
    if (resim) {
      const img = document.createElement('img')
      img.src = gorselAdresi(resim)
      img.draggable = false
      img.style.cssText = 'width:100%;height:100%;object-fit:contain'
      // Görsel yoksa emoji yedeği
      if (emoji) {
        img.onerror = () => {
          el.textContent = emoji
          el.style.fontSize = `${boyut * 0.8}px`
          el.style.lineHeight = '1'
        }
      }
      el.appendChild(img)
    } else if (emoji) {
      el.textContent = emoji
      el.style.fontSize = `${boyut * 0.8}px`
      el.style.lineHeight = '1'
    }
    document.body.appendChild(el)
    this.elemanlar.add(el)
    return el
  }

  private kaldir(el: HTMLElement, a?: Animation): void {
    if (a) this.animasyonlar.delete(a)
    el.remove()
    this.elemanlar.delete(el)
  }

  /** Bir nesneyi A noktasından B noktasına yay çizerek uçurur; varınca çözülür. */
  ucur(o: UcusSecenekleri): Promise<void> {
    if (this.durdu) return Promise.resolve()
    const boyut = o.boyut ?? 56
    const sure = o.sure ?? 900
    const gecik = o.gecik ?? 0
    const yay = o.yay ?? 60
    const don = o.don ?? 0
    const olcek = o.olcek ?? 1
    const el = this.eleman(boyut, o.resim, o.emoji)
    const orta = { x: (o.from.x + o.to.x) / 2, y: (o.from.y + o.to.y) / 2 - yay }
    const a = el.animate(
      [
        { transform: `translate(${o.from.x}px, ${o.from.y}px) rotate(0deg) scale(0.6)`, opacity: 0, offset: 0 },
        { transform: `translate(${o.from.x + (orta.x - o.from.x) * 0.12}px, ${o.from.y + (orta.y - o.from.y) * 0.12}px) rotate(${don * 0.1}deg) scale(0.9)`, opacity: 1, offset: 0.08 },
        { transform: `translate(${orta.x}px, ${orta.y}px) rotate(${don * 0.5}deg) scale(1.15)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${o.to.x}px, ${o.to.y}px) rotate(${don}deg) scale(${olcek})`, opacity: 1, offset: 1 },
      ],
      { duration: sure, delay: gecik, easing: 'cubic-bezier(0.35, 0.05, 0.6, 1)', fill: 'both' },
    )
    this.animasyonlar.add(a)
    let aralik: ReturnType<typeof setInterval> | null = null
    if (o.iz) {
      const iz = o.iz
      aralik = setInterval(() => {
        if (this.durdu || a.playState !== 'running' || (a.currentTime as number) < gecik) return
        const r = el.getBoundingClientRect()
        this.parcacik(r.left + r.width / 2, r.top + r.height / 2, iz, boyut * 0.45)
      }, 55)
      this.araliklar.add(aralik)
    }
    return new Promise((coz) => {
      const bitir = () => {
        if (aralik) {
          clearInterval(aralik)
          this.araliklar.delete(aralik)
        }
        this.kaldir(el, a)
        coz()
      }
      a.onfinish = bitir
      a.oncancel = bitir
    })
  }

  private parcacik(x: number, y: number, emoji: string, boyut: number): void {
    const p = document.createElement('div')
    p.textContent = emoji
    p.style.cssText = `position:fixed;left:${x}px;top:${y}px;font-size:${boyut}px;line-height:1;pointer-events:none;z-index:79;transform:translate(-50%,-50%)`
    document.body.appendChild(p)
    this.elemanlar.add(p)
    const a = p.animate(
      [
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 0.9 },
        { transform: `translate(calc(-50% + ${rastgele(-14, 14)}px), calc(-50% + ${rastgele(-10, 18)}px)) scale(0.2)`, opacity: 0 },
      ],
      { duration: 480, easing: 'ease-out', fill: 'both' },
    )
    this.animasyonlar.add(a)
    a.onfinish = () => this.kaldir(p, a)
    a.oncancel = () => this.kaldir(p, a)
  }

  /** Bir noktada kısa bir patlama/vuruş efekti. */
  patlama(p: Nokta, o: { resim?: string; emoji?: string; boyut?: number; sure?: number; gecik?: number } = {}): Promise<void> {
    if (this.durdu) return Promise.resolve()
    const boyut = o.boyut ?? 90
    const el = this.eleman(boyut, o.resim, o.emoji ?? '💥')
    const a = el.animate(
      [
        { transform: `translate(${p.x}px, ${p.y}px) scale(0.2) rotate(-20deg)`, opacity: 0 },
        { transform: `translate(${p.x}px, ${p.y}px) scale(1.25) rotate(8deg)`, opacity: 1, offset: 0.35 },
        { transform: `translate(${p.x}px, ${p.y}px) scale(1.6) rotate(20deg)`, opacity: 0 },
      ],
      { duration: o.sure ?? 520, delay: o.gecik ?? 0, easing: 'ease-out', fill: 'both' },
    )
    this.animasyonlar.add(a)
    return new Promise((coz) => {
      const bitir = () => {
        this.kaldir(el, a)
        coz()
      }
      a.onfinish = bitir
      a.oncancel = bitir
    })
  }

  /** Yukarı süzülüp kaybolan yazı (hasar sayısı gibi). */
  yazi(p: Nokta, metin: string, o: { renk?: string; boyut?: number; sure?: number; gecik?: number } = {}): Promise<void> {
    if (this.durdu) return Promise.resolve()
    const el = document.createElement('div')
    el.textContent = metin
    const boyut = o.boyut ?? 56
    el.style.cssText = `position:fixed;left:0;top:0;pointer-events:none;z-index:81;font-weight:800;font-family:var(--font-display);font-size:${boyut}px;color:${o.renk ?? '#fecaca'};text-shadow:0 0 16px ${o.renk ?? '#ef4444'},0 3px 0 rgba(0,0,0,.6);opacity:0;white-space:nowrap`
    document.body.appendChild(el)
    this.elemanlar.add(el)
    const a = el.animate(
      [
        { transform: `translate(${p.x}px, ${p.y}px) translate(-50%, 0) scale(0.5)`, opacity: 0 },
        { transform: `translate(${p.x}px, ${p.y - 20}px) translate(-50%, 0) scale(1.25)`, opacity: 1, offset: 0.2 },
        { transform: `translate(${p.x}px, ${p.y - 90}px) translate(-50%, 0) scale(1)`, opacity: 0 },
      ],
      { duration: o.sure ?? 1500, delay: o.gecik ?? 0, easing: 'ease-out', fill: 'both' },
    )
    this.animasyonlar.add(a)
    return new Promise((coz) => {
      const bitir = () => {
        this.kaldir(el, a)
        coz()
      }
      a.onfinish = bitir
      a.oncancel = bitir
    })
  }

  /** Bir elemanı kısa süre sarsar (vuruş alınca). */
  sars(el: Element | null | undefined, o: { siddet?: number; sure?: number; gecik?: number } = {}): void {
    if (!el || this.durdu) return
    const s = o.siddet ?? 8
    const a = (el as HTMLElement).animate(
      [
        { transform: 'translate(0, 0)' },
        { transform: `translate(${-s}px, ${s * 0.3}px) rotate(${-s * 0.4}deg)` },
        { transform: `translate(${s}px, ${-s * 0.3}px) rotate(${s * 0.4}deg)` },
        { transform: `translate(${-s * 0.6}px, 0) rotate(${-s * 0.2}deg)` },
        { transform: `translate(${s * 0.4}px, 0)` },
        { transform: 'translate(0, 0)' },
      ],
      { duration: o.sure ?? 450, delay: o.gecik ?? 0, easing: 'ease-in-out' },
    )
    this.animasyonlar.add(a)
    a.onfinish = () => this.animasyonlar.delete(a)
  }

  /** Vuruş alan karakter geriye devrilir; kalk true ise bir süre sonra ayağa kalkar, değilse yerde kalır. */
  devril(el: Element | null | undefined, o: { kalk: boolean; gecik?: number; yon?: 1 | -1 } = { kalk: true }): void {
    if (!el || this.durdu) return
    const yon = o.yon ?? (Math.random() < 0.5 ? 1 : -1)
    const a = (el as HTMLElement).animate(
      o.kalk
        ? [
            { transform: 'translate(0, 0) rotate(0deg)', filter: 'none', offset: 0 },
            { transform: `translate(${yon * -14}px, 8px) rotate(${yon * -70}deg)`, filter: 'grayscale(0.9) brightness(0.7)', offset: 0.18 },
            { transform: `translate(${yon * -14}px, 8px) rotate(${yon * -70}deg)`, filter: 'grayscale(0.9) brightness(0.7)', offset: 0.7 },
            { transform: 'translate(0, 0) rotate(0deg)', filter: 'none', offset: 1 },
          ]
        : [
            { transform: 'translate(0, 0) rotate(0deg)', filter: 'none', offset: 0 },
            { transform: `translate(${yon * -14}px, 8px) rotate(${yon * -70}deg)`, filter: 'grayscale(0.9) brightness(0.7)', offset: 0.2 },
            { transform: `translate(${yon * -14}px, 8px) rotate(${yon * -70}deg)`, filter: 'grayscale(0.9) brightness(0.7)', offset: 1 },
          ],
      { duration: 1700, delay: o.gecik ?? 0, easing: 'ease-out', fill: o.kalk ? 'none' : 'forwards' },
    )
    this.animasyonlar.add(a)
    a.onfinish = () => this.animasyonlar.delete(a)
  }

  /** Bir elemanı bir süre büyütüp (kükreme, zıplama) eski hâline getirir. */
  nabiz(el: Element | null | undefined, o: { olcek?: number; aci?: number; sure?: number; gecik?: number } = {}): void {
    if (!el || this.durdu) return
    const a = (el as HTMLElement).animate(
      [{ transform: 'scale(1) rotate(0deg)' }, { transform: `scale(${o.olcek ?? 1.12}) rotate(${o.aci ?? -3}deg)`, offset: 0.4 }, { transform: 'scale(1) rotate(0deg)' }],
      { duration: o.sure ?? 700, delay: o.gecik ?? 0, easing: 'ease-in-out' },
    )
    this.animasyonlar.add(a)
    a.onfinish = () => this.animasyonlar.delete(a)
  }
}
