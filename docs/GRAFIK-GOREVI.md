# ZAPEDU grafik görevi (Antigravity için)

Bu dosya, oyun sahnelerinin grafiklerini üretmek için Antigravity'ye verilecek komutları içerir. Üretilen dosyalar
`public/gorseller/` klasörüne konur; kod bunları bulursa kullanır, bulamazsa bugünkü emoji görünümü aynen kalır.

## Nasıl kullanılır
1. Antigravity'de yeni bir klasör aç (ör. `zapedu-gorseller`). Aşağıdaki **A. Ortak stil** metnini ilk mesaj olarak yapıştır.
2. Sonra her **B** bölümünü ayrı bir mesaj olarak ver. Her mesajın sonunda "dosya adlarını aynen kullan" yazdığından emin ol.
3. Üretilen dosyaları `zapedu-gorseller` klasöründe topla; bitince bana klasörün yolunu ver. Ben `public/gorseller/` altına yerleştirip koda bağlarım.
4. Beğenmediğin görsel için aynı mesajı "daha az çocuksu, daha sinematik" gibi bir notla yeniden iste.

## A. Ortak stil (ilk mesaj)
```
Bir üniversite amfisinde projeksiyonla gösterilen, öğrencilerin telefonuyla oynadığı canlı bir ders oyunu için görsel
varlıklar üreteceksin. Oyunların adı: Zombi Kaçışı, Roket Yarışı, Ejderha Savaşı, Arena, Kule, Halat Çekme.

Stil: modern, parlak, sinematik 2D oyun illüstrasyonu (mobil oyun kalitesinde, "Clash Royale / Brawl Stars / Monument Valley"
arası). Temiz vektör çizgisi, yumuşak gölgeler, parlayan (glow) ışık efektleri, derinlik hissi. 1990'ların piksel arcade
görünümü OLMASIN; emoji OLMASIN; düz, yavan şekiller OLMASIN.

Renk: koyu lacivert/mor arka plan ailesi (#070a1f, #1a1450), vurgu renkleri turkuaz (#22d3ee), mor (#8b5cf6), pembe (#f472b6),
sarı-altın (#fbbf24). Kontrast yüksek olmalı: uzaktaki sırada oturan öğrenci perdeden okuyabilsin.

Teknik: her varlık ayrı dosya. Karakter ve nesneler ŞEFFAF arka planlı PNG (en az 512x512, kare) ya da temiz SVG. Arka planlar
JPG/WebP ya da PNG, 1920x1080 (16:9). Dosya başına 400 KB'ı geçme (WebP/optimize PNG). Metin/yazı ekleme; yazıyı ben koda
eklerim. Telif hakkı olan karakter, logo ya da marka kullanma; hepsi özgün olsun.

Dosya adlarını istediğim gibi, küçük harf ve tire ile aynen kullan.
```

## B. Oyun komutları (her biri ayrı mesaj)

### B1. Zombi Kaçışı
```
Zombi Kaçışı oyunu için şu varlıkları üret (dosya adlarını aynen kullan):

arka-zombi.webp  (1920x1080) Gece, sisli, terk edilmiş bir üniversite kampüsü; uzakta ay, yakın planda dağınık sandalyeler ve
  kırık bir kapı. Sol tarafta güvenli bölge (sıcak ışık), sağ tarafta zombilerin geldiği karanlık. Yatay kompozisyon, ortada
  boş koşu şeridi.
zombi-1.png, zombi-2.png, zombi-3.png  (şeffaf, 512x512) Üç farklı zombi: tembel yürüyen, sırtı kamburlu, hızlı koşan. Komik-
  tehditkâr, çocuklara uygun, kan yok. Yeşil-mor ton, parlayan gözler. Sağdan sola bakan, yürüyüş pozunda.
ogrenci-1.png ... ogrenci-8.png  (şeffaf, 512x512) Sekiz farklı çevik genç karakter (üniversite öğrencisi, sırt çantalı,
  kapüşonlu, gözlüklü, bere...). Koşar pozda, soldan sağa bakan, çeşitli ten ve saç tipleri, ifadeli yüzler.
efekt-yakalandi.png  (şeffaf, 512x512) Zombi yakalama anı için mor-yeşil patlama/duman efekti.
efekt-kurtuldu.png  (şeffaf, 512x512) Kurtulma anı için turkuaz parlama ve konfeti efekti.
```

### B2. Roket Yarışı
```
Roket Yarışı oyunu için (dosya adlarını aynen kullan):

arka-roket.webp  (1080x1920 dikey ve 1920x1080 yatay iki ayrı dosya: arka-roket-dikey.webp, arka-roket-yatay.webp) Yıldızlı
  derin uzay, nebula bulutları, uzakta gezegenler; en altta dünya atmosferi parlaması. Yarış pistini andıran dikey ışık çizgileri.
roket-1.png ... roket-6.png  (şeffaf, 512x512) Altı farklı, renkli, sevimli ama havalı roket/uzay gemisi (turkuaz, mor, pembe,
  altın, yeşil, turuncu). Yukarı bakan, alt ucunda parlayan alev efekti ayrı bir katman olarak da: alev-1.png (şeffaf).
bitis-cizgisi.png  (şeffaf, 1920x200) Neon, damalı bitiş şeridi / uzay kapısı.
efekt-turbo.png  (şeffaf, 512x512) Doğru cevaba verilen hız patlaması.
```

### B3. Ejderha Savaşı
```
Ejderha Savaşı için (dosya adlarını aynen kullan):

arka-ejderha.webp  (1920x1080) Epik fantezi dağ geçidi, gün batımı, lav parıltısı, uzakta kale. Ön planda savaş alanı.
ejderha.png  (şeffaf, 1024x1024) Muhteşem, korkutucu ama çizgi film dengesinde büyük bir ejderha; sola bakan, ağzında ateş
  hazırlığı. ejderha-yaralandi.png ve ejderha-oldu.png diye iki ek poz (aynı tasarım).
kahraman-1.png ... kahraman-8.png  (şeffaf, 512x512) Sekiz farklı fantastik kahraman (büyücü, okçu, şövalye, ninja, hırsız,
  şifacı, mühendis, bilgin). Sağa bakan, savaş pozunda.
efekt-ates.png, efekt-darbe.png, efekt-kalkan.png  (şeffaf, 512x512) Ejderha ateşi, kahraman saldırısı, koruyucu kalkan.
can-cubugu.svg  Ejderhanın can çubuğu: süslü, taş-altın çerçeveli, içi boş (doluluğu kod çizer).
```

### B4. Arena ve Kule (takım oyunları)
```
Arena ve Kule oyunları için (dosya adlarını aynen kullan):

arka-arena.webp  (1920x1080) Fütüristik gladyatör arenası, ışıklı zemin, tribünler, spot ışıkları.
arka-kule.webp  (1920x1080) Gökyüzünde inşa alanı, bulutların üstünde, güneş doğuşu.
takim-kalkan-1.png ... takim-kalkan-6.png  (şeffaf, 512x512) Altı takım için armalar: kırmızı, mavi, yeşil, sarı, mor, turuncu;
  her birinde farklı sembol (şahin, kurt, boğa, kartal, ejder, aslan). Yazı yok.
blok-1.png ... blok-6.png  (şeffaf, 512x512) Takım renklerinde parlayan inşa blokları (kule katları).
kule-zemin.png  (şeffaf, 1024x256) Kulelerin oturduğu taş/metal kaide.
kupa.png  (şeffaf, 512x512) Altın kupa, parlama ile. podyum.png  (şeffaf, 1024x512) 1-2-3 podyum.
```

### B5. Halat Çekme ve Hocayla Yarış
```
(dosya adlarını aynen kullan)

arka-halat.webp  (1920x1080) Stadyum çimi, iki yanda takım renkleri, güneşli gün.
halat.png  (şeffaf, 2048x256) Kalın örgü halat, ortasında kırmızı işaret bandı.
takim-halat-sol.png, takim-halat-sag.png  (şeffaf, 1024x512) Halatı çeken iki ekip silueti, çaba hâlinde (sevimli, renkli).
hoca-yaris.png  (şeffaf, 512x512) Gözlüklü, sakallı, havalı bir hoca karakteri (ceket, cübbe değil, jenerik akademisyen);
  ogrenci-sinif.png sınıfı temsil eden kalabalık öğrenci grubu. İkisi karşı karşıya, boks eldiveni ya da düello stilinde.
```

### B6. Genel arayüz ve marka
```
(dosya adlarını aynen kullan)

logo-zapedu.svg  "ZE" harflerinden oluşan, modern, neon-gradyan (turkuaz-mor-pembe) bir logo işareti (harfler arasında zekice
  bir bağ olsun). logo-zapedu-yatay.svg ayrıca "ZAPEDU" yazılı yatay sürüm.
arka-sahne.webp  (1920x1080) Slaytların ve yoklama ekranının arkasında duracak, dikkat dağıtmayan, koyu lacivert-mor soyut
  parıltı/aurora arka planı (okunurluğu bozmasın).
arka-telefon.webp  (1080x1920) Öğrenci telefonu için aynı aileden, daha sade dikey arka plan.
rozet-seri-1.png ... rozet-seri-3.png  (şeffaf, 256x256) Devam serisi rozetleri: alev (2+), yıldızlı alev (5+), taçlı alev (10+).
konfeti.png  (şeffaf, 1920x1080) Ders sonu kutlama konfeti katmanı.
```

## C. Bana vereceğin şey
Klasör yolunu ve hangi grupların (B1-B6) hazır olduğunu söyle. Ben şunları yaparım:
- Dosyaları `public/gorseller/` altına koyar, boyutlarını optimize ederim.
- Sahnelerde dosya varsa görseli, yoksa mevcut emojiyi gösteririm; hiçbir oyun yarım kalmaz.
- Önce bir oyunu (öneri: Zombi Kaçışı) bağlar, tarayıcıda denerim, onay verirsen diğerlerine geçerim.
