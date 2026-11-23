/**
 * Zirveye Tırmanış: `arka-dag.webp` (1920x1080) üzerindeki gerçek patikanın dönüm noktaları (görselden çıkarıldı).
 * Patika vadideki ilk kıvrımdan başlar, üç ana dolambaçtan geçip zirveye (bayrak) çıkar.
 * Kamplar bu yolun uzunluğuna eşit aralıkla yerleştirilir (ZirveSahnesi).
 */
export const DAG_GENISLIK = 1920
export const DAG_YUKSEKLIK = 1080

export const YOL_NOKTALARI: [number, number][] = [
  [550, 890],
  [535, 960],
  [470, 990],
  [425, 1015],
  [450, 1035],
  [600, 1040],
  [770, 1020],
  [850, 975],
  [865, 920],
  [820, 870],
  [770, 845],
  [820, 825],
  [920, 830],
  [1010, 865],
  [1050, 910],
  [1200, 950],
  [1290, 930],
  [1325, 870],
  [1280, 820],
  [1170, 780],
  [1050, 760],
  [1060, 730],
  [1200, 730],
  [1300, 740],
  [1400, 720],
  [1440, 680],
  [1400, 630],
  [1330, 600],
  [1250, 570],
  [1210, 550],
  [1240, 525],
  [1350, 520],
  [1470, 500],
  [1550, 465],
  [1580, 390],
  [1490, 370],
  [1400, 375],
  [1380, 360],
  [1420, 330],
  [1550, 335],
  [1610, 310],
  [1600, 280],
  [1500, 260],
  [1440, 250],
  [1440, 220],
  [1550, 200],
  [1630, 160],
  [1630, 140],
  [1550, 115],
  [1515, 105],
  [1520, 80],
  [1545, 60],
]

/** Noktalardan yumuşak (Catmull-Rom) bir SVG yolu üretir. */
export function yolUret(noktalar: [number, number][] = YOL_NOKTALARI): string {
  const p = noktalar
  let d = `M ${p[0][0]} ${p[0][1]}`
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[Math.max(0, i - 1)]
    const p1 = p[i]
    const p2 = p[i + 1]
    const p3 = p[Math.min(p.length - 1, i + 2)]
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)}, ${c2[0].toFixed(1)} ${c2[1].toFixed(1)}, ${p2[0]} ${p2[1]}`
  }
  return d
}

export const DAG_YOLU = yolUret()
/** Zirve bayrağının yeri (yolun son noktası), yüzde olarak */
export const ZIRVE_YUZDE = { x: (YOL_NOKTALARI[YOL_NOKTALARI.length - 1][0] / DAG_GENISLIK) * 100, y: (YOL_NOKTALARI[YOL_NOKTALARI.length - 1][1] / DAG_YUKSEKLIK) * 100 }
