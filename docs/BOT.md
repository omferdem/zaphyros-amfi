# Gerçek ders test botu

`scripts/bot.mjs`, açık bir derse sanal öğrenciler katar ve sorulara cevap verir. Perde, kumanda ve oyunlar gerçek yoldan (RPC, Realtime) denenir.

## Kurulum (bir kez)
1. Panelde adı `TEST-BOT` ile başlayan bir ders (şube) aç. İçeriği, denemek istediğin akışı taşıyan içerik olsun.
2. `0047_test_botu.sql` uygulanmış olmalı (bot doğru şıkkı yalnızca TEST-BOT derslerinde öğrenir; gerçek derslerde işlev hata döner).

## Kullanım
Dersi başlat, perdeyi aç, sonra:

```bash
node scripts/bot.mjs --oturum <oturum-uuid> --n 30 --basari 0.6 --gecikme 1-15
```

`--kod 123456` (perdedeki ders kodu) de verilebilir. Bot, sorular açıldıkça cevap verir; ders bitince ya da Ctrl+C ile durur.

## Temizlik
`scripts/bot-temizle.sql` dosyasını SQL Editor'de çalıştır (yalnızca TEST-BOT derslerindeki cevapları ve takma adları siler). Gerçek şubelere dokunmaz.
