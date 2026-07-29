# Fizik Atölyesi

Türkiye Yüzyılı Maarif Modeli ile uyumlu, etkileşimli fizik deneyleri ve
serbest simülasyonlar için hazırlanan web portalıdır.

## Visual Studio Code ile çalıştırma

1. Visual Studio Code'da `fizik-atolyesi` klasörünü açın.
2. Terminalde `npm install` komutunu çalıştırın.
3. `npm run dev` komutuyla yerel geliştirme sunucusunu başlatın.
4. Terminalde gösterilen yerel adresi tarayıcıda açın.

## Sunucu paketi

`npm run build:static` komutu, herhangi bir statik web sunucusuna veya GitHub
Pages'e yüklenebilen dosyaları `sunucu-paketi` klasöründe üretir. Paket göreli
dosya yolları kullandığından bir alt klasörde de çalışabilir.

## Ana yapı

- İlgi çekici, özgün ve telif sorunu taşımayan Fizik Atölyesi ana sayfası
- Fizik Deney Setleri ve Serbest Deney ve Simülasyon olarak iki ana çalışma yolu
- Deney setleri altında Mekanik, Elektrik, Dalgalar-Optik ve Modern Fizik alanları
- Serbest çalışma altında sekiz fizik konu alanı
- Henüz hazırlanmayan bütün alanlar için çalışan bekleme sayfaları
- Masaüstü, tablet ve telefonlara uyumlu responsive tasarım

## Açık deney seti: Mekanik

- Serbest vektör çalışma alanı
- Hava rayında düzgün ve sabit ivmeli hareket
- Serbest düşme
- İki boyutta hareket
- İki boyutlu çarpışmalar
- Balistik sarkaç
- Dönme dinamiği ve tork

Mekanik deneylerinde öğrenciler düzenekleri kurabilir, ölçüm alabilir, grafikleri
inceleyebilir ve kanıta dayalı kısa deney raporlarını yazabilir.
