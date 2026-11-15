// Akıştaki "oyun" adımı için oyun listesi ve açıklamaları (perde kartı ve akış düzenleyici kullanır).

export type OyunAnahtari = 'takim' | 'halat' | 'hoca' | 'merdiven' | 'zombi' | 'roket' | 'ejderha' | 'arena' | 'kule' | 'kale'

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
    nasil: 'Sınıf iki takıma ayrılır. Her soruda daha çok bilen takım halatı kendi tarafına çeker; halat ucuna ulaşan takım kazanır, sorular biterse halatı kendi tarafında tutan.',
    baslat: '2 takımlı takım modunu ve halat görünümünü açar.',
  },
  hoca: {
    ad: 'Hocayla yarış',
    emoji: '🥊',
    nasil: 'Sınıf hocaya karşı oynar. Hoca her soruda cevabını gizlice verir; hoca doğru bilirse hoca, sınıfın en az %60\'ı doğru bilirse sınıf puan alır. Hoca cevap vermezse o soruyu kaybeder.',
    baslat: 'Hocayla yarış skorunu açar.',
  },
  arena: {
    ad: 'Son kalan arenası',
    emoji: '⚔️',
    nasil: 'Bireysel eleme oyunu. Her öğrencinin canı soru sayısına bağlıdır (soruların %40\'ı kadar yanlış hakkı); canı bitenler arenadan düşer. Ayakta kalıp soruların yarısını bilenler kazanır.',
    baslat: 'Son kalan arenası sahnesini perdede açar.',
  },
  kule: {
    ad: 'Kule yarışı',
    emoji: '🏗️',
    nasil: 'Sınıf 3 takıma ayrılır. Her soruda takım, doğru oranına göre 0-3 blok ekler; takımın yarısından fazlası bilmezse rüzgâr üst bloğu düşürür. Önce hedef yüksekliğe çıkan takım kazanır.',
    baslat: '3 takımlı takım modunu ve kule sahnesini açar.',
  },
  kale: {
    ad: 'Kale kuşatması',
    emoji: '🏰',
    nasil: 'Her takımın bir kalesi var. Doğru cevaplar takımın ordusunu bir sonraki takımın kalesine yürütür, sonra kalenin etrafını sarar. Hedef kaleyi önce tamamen kuşatan takım kazanır; sıralama kişi başına doğruya göredir.',
    baslat: '3 takımlı takım modunu ve kale kuşatması sahnesini açar.',
  },
  roket: {
    ad: 'Roket yarışı',
    emoji: '🚀',
    nasil: 'Her öğrenci perdede ilk adıyla bir roket olur. Doğru cevap roketi ileri iter; yanlıştan sonra motor arızası yapar. Bitiş çizgisine ilk varanlar podyuma çıkar. Bireysel hız ve bilgi yarışıdır.',
    baslat: 'Roket yarışı sahnesini perdede açar.',
  },
  ejderha: {
    ad: 'Ejderha savaşı',
    emoji: '🐉',
    nasil: 'Bütün sınıf birlikte bir ejderhaya karşı savaşır. Doğru cevaplar ejderhaya vurur; yanlış ya da cevapsız kalan kahraman bir can kaybeder. Sınıf ejderhayı yenerse kazanır.',
    baslat: 'Ejderha savaşı sahnesini perdede açar.',
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
