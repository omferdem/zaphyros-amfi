"""Doğru şık, yanlışlardan belirgin biçimde uzunsa şıkkın açıklayıcı kuyruğunu (", çünkü", "; ", ", yani" gibi) keser.
Yalnızca kesilen kısım şıkkın ana iddiasını bozmayacak ayraçlarda ve kalan metin yeterince uzunsa uygulanır. Kullanım: python -I scripts/soru-dengele.py"""
import glob
import os
import re

KAYNAK = os.path.join(os.path.dirname(__file__), '..', 'docs', 'soru-onerileri', 'kaynak')
AYRAC = re.compile(r'(, çünkü |; |, yani |, ancak |, buna karşılık |, ise |, bu yüzden )')
degisen = 0
for dosya in sorted(glob.glob(os.path.join(KAYNAK, 'h*.txt'))):
    satirlar = open(dosya, encoding='utf8').read().split('\n')
    yeni = []
    for satir in satirlar:
        p = satir.split('|')
        if len(p) == 10:
            dogru, yanlislar = p[3], p[4:7]
            uzun = max(len(y) for y in yanlislar)
            if len(dogru) >= 25 and len(dogru) > 1.25 * uzun:
                parcalar = AYRAC.split(dogru, maxsplit=1)
                if len(parcalar) == 3 and len(parcalar[0]) >= 22:
                    kisa = parcalar[0]
                    # yeterince kısaldıysa kabul et
                    if len(kisa) <= 1.25 * uzun or len(kisa) < len(dogru) * 0.75:
                        p[3] = kisa
                        degisen += 1
        yeni.append('|'.join(p))
    open(dosya, 'w', encoding='utf8', newline='\n').write('\n'.join(yeni))
print('kısaltılan doğru şık sayısı:', degisen)
