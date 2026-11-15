"""kaynak/_duzelt*.txt dosyalarındaki "dosya:satır|yanlış1|yanlış2|yanlış3" kayıtlarını uygular (yanlış şıkları değiştirir)."""
import glob
import os

KAYNAK = os.path.join(os.path.dirname(__file__), '..', 'docs', 'soru-onerileri', 'kaynak')
degisim = {}
for f in sorted(glob.glob(os.path.join(KAYNAK, '_duzelt*.txt'))):
    for l in open(f, encoding='utf8').read().split('\n'):
        p = l.split('|')
        if len(p) == 4:
            degisim[p[0]] = p[1:]
sayac = 0
for dosya in sorted(glob.glob(os.path.join(KAYNAK, 'h*.txt'))):
    ad = os.path.basename(dosya)[:-4]
    satirlar = open(dosya, encoding='utf8').read().split('\n')
    for i, l in enumerate(satirlar, 1):
        anahtar = f'{ad}:{i}'
        if anahtar in degisim:
            p = l.split('|')
            if len(p) == 10:
                p[4:7] = degisim[anahtar]
                satirlar[i - 1] = '|'.join(p)
                sayac += 1
    open(dosya, 'w', encoding='utf8', newline='\n').write('\n'.join(satirlar))
print('uygulanan düzeltme:', sayac)
