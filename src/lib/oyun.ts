// Akıştaki "oyun" adımı için oyun listesi ve açıklamaları (perde kartı ve akış düzenleyici kullanır).

export type OyunAnahtari = 'takim' | 'halat' | 'hoca' | 'merdiven' | 'zombi'

export interface OyunBilgisi {
  ad: string
  emoji: string
  /** Perdede ve akış düzenleyicide görünen kısa açıklama */
  nasil: string
  /** "Oyunu başlat" düğmesinin yaptığı iş */
  baslat: string
}

export const OYUNLAR: Record<OyunAnahtari, OyunBilgisi> = {
  takim: {
    ad: 'Takım yarışması',
    emoji: '👥',
    nasil: 'Sınıf üç takıma ayrılır. Herkes telefonundan takımını seçer; sorulara verilen puanlar takım bazında toplanır, üye başına ortalamayla sıralanır.',
    baslat: '3 takımlı takım modunu açar.',
  },
  halat: {
    ad: 'Halat çekme',
    emoji: '🪢',
    nasil: 'Sınıf iki takıma ayrılır. Bir takımın doğru cevapları halatı kendi tarafına çeker; fark üç doğruya ulaşınca takım halatı çeker.',
    baslat: '2 takımlı takım modunu ve halat görünümünü açar.',
  },
  hoca: {
    ad: 'Hocayla yarış',
    emoji: '🥊',
    nasil: 'Sınıf hocaya karşı oynar. Hoca her soruda cevabını gizlice verir; doğru bilen taraf puan alır. Skor perdede durur.',
    baslat: 'Hocayla yarış skorunu açar.',
  },
  zombi: {
    ad: 'Zombi kaçışı',
    emoji: '🧟',
    nasil: 'Sınıf bir piramidin zirvesine çıkmaya çalışır; her öğrenci perdede ayrı bir karakterdir. Doğru cevap bir kat yükseltir, zombiler her soruda yaklaşır. Sınıfın %70\'i zirveye çıkarsa kurtulur.',
    baslat: 'Zombi kaçışı piramidini perdede açar.',
  },
  merdiven: {
    ad: 'Bilgi merdiveni',
    emoji: '🪜',
    nasil: 'Sınıf tek bir yarışmacı gibi basamak çıkar. Cevap verenlerin en az yarısı doğru bilirse bir basamak çıkılır; yanlışta son güvenli basamağa inilir. İki jokeri var.',
    baslat: 'Bilgi merdivenini açar.',
  },
}

/** Başka panellerin (takım, merdiven) dinlediği, oyunun başlatıldığını bildiren tarayıcı olayı. */
export const OYUN_OLAYI = 'amfi-oyun'
