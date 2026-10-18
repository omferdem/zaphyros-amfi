# AmfiOS

Üniversite dersleri için canlı ders sistemi. Hoca derse projeksiyondan başlar, öğrenciler QR kodu okutup telefonlarının tarayıcısından katılır. Yoklama, slayt, quiz, tartışma ve oyunlar tek akışta, hocanın kontrolünde ilerler.

**Durum:** v0.2.1, Faz 1 (QR yoklama) tamam. Canlı adres: https://omferdem.github.io/zaphyros-amfi/

## Kendi kopyanı kurmak
Her hoca kendi bağımsız kopyasını kurar; verileri yalnızca kendi Supabase projesinde durur. Adım adım anlatım: `docs/KURULUM.md`.

## Yerelde çalıştırma
```
npm install
npm run dev
npm test
```

## Belgeler
- `CLAUDE.md`: Projede çalışırken uyulacak kurallar ve bağlayıcı kararlar
- `docs/MIMARI.md`: Mimari, veri modeli, yoklama ve gerçek zaman tasarımı
- `docs/YOL-HARITASI.md`: Fazlar ve sürümler
- `docs/PROTOTIP-INCELEME.md`: İlk Gemini prototipinin değerlendirmesi

## Teknoloji
Vite, React, TypeScript, Tailwind, Supabase, GitHub Pages.

© Ömer Faruk Erdem
