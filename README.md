## Trazo — уеб оптимизатор

Отворете `index.html` в съвременен браузър, за да използвате планировчика за линейно рязане. Можете също да стартирате папката с всеки статичен HTTP сървър.

- Задайте един или повече видове материал; оставете броя празен, ако наличността е неограничена.
- Добавете размери и количества на детайлите или ги импортирайте от списък във формат `позиция, дължина, количество`.
- Настройте мерните единици, ширината на среза и подрязването на пръта, след което натиснете **Изчисли план**.
- Прегледайте използването на материала и остатъка за всеки прът, експортирайте плана като CSV или PDF и възстановете планове от локалната история.
- За PDF браузърът отваря диалога за печат; изберете „Запазване като PDF“.

Алгоритъмът сравнява няколко подредби и стратегии за разполагане, след което избира плана с най-малко неразпределени детайли и най-малък остатък. Това е евристична оптимизация и не гарантира математически доказан глобален оптимум.

Интерфейсът и изчисленията работят в браузъра, без инсталиране на зависимости и без сървърна част.

# Audio CD Ripper

Jednostavan Python program za ripanje audio CD-a u WAV, MP3 ili FLAC format.

## Potrebno

- Python 3.9+
- FFmpeg instaliran i dostupan u PATH-u

Preuzmi FFmpeg:
- https://www.ffmpeg.org/download.html

## Pokretanje

```bash
python audio_cd_ripper.py --list-drives
python audio_cd_ripper.py --device D: --first-track 1 --last-track 10 --format wav --output-dir ./cd_rip
python audio_cd_ripper.py --device D: --first-track 1 --last-track 10 --format mp3 --output-dir ./cd_rip
```

Ako FFmpeg automatski ne prepozna CD, koristi `--device` i navedeni disk ili uređaj.

## Napomena

Ovaj program koristi FFmpeg-ov CDDA čitač. Ako je CD drive kompatibilan s FFmpeg-om, ripanje će raditi pravilno.
