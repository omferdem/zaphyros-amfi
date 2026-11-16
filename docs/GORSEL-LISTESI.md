# ZAPEDU oyun görselleri: Gemini üretim listesi

Mevcut görsellerin tarzı: kalın siyah dış çizgili, düz renk gölgelendirmeli (cel-shaded), canlı renkli, mobil oyun çıkartması tarzı çizgi film karakterleri. Yeni görseller aynı aileden görünmeli.

Kod, bu listedeki dosya adlarını `public/gorseller` içinde arar; dosya yoksa mevcut görsele ya da emojiye düşer. Yani görseller geldikçe kod kendiliğinden kullanır, başka değişiklik gerekmez (poz dosyalarını kullanan kodlar ayrı bir iştir, aşağıdaki "Kodda bağlantı" bölümüne bak).

## Nasıl üretilecek

1. Gemini'de her yeni sohbete önce aşağıdaki **tarz cümlesini**, sonra listedeki tek bir görselin tarifini yaz.
2. Tutarlılık için bir karakterin pozlarını üretirken o karakterin mevcut resmini (ör. `kahraman-1.webp`) Gemini'ye ekle ve "bu karakterin aynısını, şu pozda" de.
3. Arka planı şeffaf olmayan bir görsel gelirse sorun değil: düz beyaz arka plan iste, arka plan sonradan temizlenir.
4. Dosyaları listedeki adla kaydet ve bir klasörde topla. "Şu klasördeki görselleri `public/gorseller` içine al, WebP'ye çevir" demen yeterli. Karakterler en fazla 512 px, arka planlar 1920x1080.

**Tarz cümlesi (her isteğin başına):**
> Mobile game character art, bold thick black outlines, flat cel-shading, vibrant saturated colors, clean cartoon style, full body, centered, no text, no watermark, isolated on a plain white background.

**Arka planlar için tarz cümlesi:**
> Mobile game background art, painterly cartoon style matching bold outlined characters, vibrant colors, wide 16:9 landscape, no characters, no text, leave the lower third relatively open for characters to stand on.

## Öncelik 1: öğrenci karakterlerinin pozları (bütün oyunlarda kullanılıyor)

`ogrenci-1` ile `ogrenci-8` arasındaki her karakter için 4 poz, toplam 32 görsel.

| Dosya adı | Tarif |
|---|---|
| `ogrenci-N-kos.webp` | same character running to the right, dynamic pose, one leg forward |
| `ogrenci-N-cek.webp` | same character pulling a rope with both hands, leaning back, straining |
| `ogrenci-N-dus.webp` | same character falling backwards, surprised face, comic style |
| `ogrenci-N-sevin.webp` | same character jumping with both arms up, very happy, celebrating |

## Öncelik 2: ejderha savaşı

`kahraman-1` ile `kahraman-8` için 3 poz, toplam 24 görsel.

| Dosya adı | Tarif |
|---|---|
| `kahraman-N-vur.webp` | same hero attacking with their weapon, lunging forward, motion lines |
| `kahraman-N-dus.webp` | same hero knocked down, lying on the ground, dazed with stars |
| `kahraman-N-sevin.webp` | same hero raising weapon in victory, cheering |

Ejderha için 2 ek poz (mevcut `ejderha.webp` ile):

| Dosya adı | Tarif |
|---|---|
| `ejderha-kukre.webp` | same dragon roaring with mouth wide open, wings spread |
| `ejderha-ates.webp` | same dragon breathing a big stream of fire to the left |

## Öncelik 3: Kule yarışı

| Dosya adı | Tarif |
|---|---|
| `kule-tugla.webp` | a single square stone building block, cartoon style, front view, 1:1 |
| `kule-vinc.webp` | a tall wooden construction crane with a rope and hook, side view, tall vertical image |
| `kule-bayrak.webp` | a waving victory flag on a pole, white flag (color will be tinted by code) |
| `arka-kule-gok.webp` | (arka plan) open sky with clouds and floating islands, vertical extension of a construction site, 1080x1920 |

## Öncelik 4: Zirveye Tırmanış (bilgi merdiveninin yeni hâli)

| Dosya adı | Tarif |
|---|---|
| `arka-dag.webp` | (arka plan) a tall snowy mountain seen from the side, a winding trail with 15 small camp spots from bottom left to the summit at top right, 1920x1080 |
| `dag-kamp.webp` | a small orange mountaineering tent, cartoon style |
| `dag-guvenli-kamp.webp` | a bigger base camp tent with a flag next to it |
| `dag-cig.webp` | a cartoon avalanche, snow cloud rolling down, isolated |
| `dag-zirve-bayrak.webp` | a big flag planted on a snowy summit rock |
| `ogrenci-N-tirman.webp` | same character climbing with a rope and backpack (8 görsel) |

## Öncelik 5: Orman'dan eve dönüş

| Dosya adı | Tarif |
|---|---|
| `arka-orman.webp` | (arka plan) a deep magical forest at dusk, a winding dirt path from bottom left to top right, small stream and wooden bridge, 1920x1080 |
| `orman-ev.webp` | a cozy small cottage with warm glowing windows and a chimney |
| `orman-kurt.webp` | a cartoon wolf, cute but sneaky, not scary, crouching |
| `orman-kurt-gozler.webp` | two glowing yellow eyes in a dark bush |
| `orman-fener.webp` | an old glowing lantern |

## Öncelik 6: Kale kuşatması

| Dosya adı | Tarif |
|---|---|
| `arka-kale-harita.webp` | (arka plan) top-down fantasy battlefield map, grass and dirt, a round clearing in the center, 1920x1080 |
| `kale-merkez.webp` | a medieval castle seen from a slight top-down angle, isolated |
| `kale-cadir.webp` | a small army tent, white (color tinted by code) |
| `kale-asker.webp` | a small cartoon soldier with a spear, white and grey armor (color tinted by code) |
| `kale-mancinik.webp` | a wooden catapult |

## Öncelik 7: Hoca karakteri (emoji kalpleri ve hocayla yarış)

Mevcut `hoca-yaris.webp` ile aynı kişi:

| Dosya adı | Tarif |
|---|---|
| `hoca-normal.webp` | same teacher standing, friendly smile |
| `hoca-mutlu.webp` | same teacher laughing with hearts around |
| `hoca-ziplar.webp` | same teacher jumping with joy |
| `hoca-uzgun.webp` | same teacher pretending to be sad, comic |

## Kodda bağlantı (durum)

- Bugün kodda kullanılan yeni dosya adları: yok. Mevcut sahneler `ogrenci-N`, `kahraman-N`, `blok-N`, `ejderha`, `ejderha-yaralandi`, `ejderha-oldu`, `hoca-yaris`, `ogrenci-sinif` ve arka plan dosyalarını okur.
- Poz dosyaları (`-kos`, `-cek`, `-dus`, `-sevin`, `-vur`, `-tirman`) geldiğinde karakterin hareket sırasında poz değiştirmesi için ilgili sahnelerde küçük bir kod değişikliği gerekir; görseller gelince bu iş yapılır. Görsel yoksa tek poz kullanılmaya devam eder.
- Zirveye Tırmanış şu an patikayı SVG ile çizer; `arka-dag.webp` gelirse arka plan olarak kullanılabilir.
