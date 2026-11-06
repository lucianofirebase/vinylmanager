# 💿 Auditor de Wishlist vs Biblioteca Digital

Herramienta para auditar tu lista de deseos de vinilos frente a tus carpetas de música digital en la PC (MP3, FLAC, WAV, AIFF, M4A, etc.).

Te permite saber al instante:
* 🟢 **Álbumes Completos (100%)**: Tienes todos los temas del release en digital.
* 🟡 **Tracks Sueltos (Parcial)**: Tienes algunos temas, pero te faltan otros (mostrando con precisión cuáles tienes y cuáles faltan).
* 🔴 **Faltantes (0%)**: No tienes nada de ese disco en digital.

---

## 🚀 Cómo Usar (Súper Sencillo)

### Método 1: Arrastrar y Soltar (Recomendado)
1. Descarga el CSV de tu Wishlist desde la extensión **Discogs Wishlist Matcher** (o desde la web de Discogs).
2. **Arrastra el archivo CSV y suéltalo encima de `iniciar_auditor.bat`**.
3. ¡Listo! El script escaneará tus carpetas y abrirá automáticamente el reporte interactivo en tu navegador (Brave/Chrome).

### Método 2: Doble Clic
1. Haz doble clic en **`iniciar_auditor.bat`**.
2. Si tienes un archivo CSV reciente en tu carpeta de *Descargas*, el script lo detectará automáticamente y te preguntará si quieres usarlo presionando `[ENTER]`.
3. También te preguntará si quieres agregar alguna carpeta adicional (ej: `D:\Musica`).

---

## ⚙️ Configuración (`scripts/config.json`)

Puedes editar `scripts/config.json` para personalizar tus rutas preferidas:

```json
{
  "consumer_key": "TU_KEY",
  "consumer_secret": "TU_SECRET",
  "music_directories": [
    "C:\\Users\\PERSONAL\\Music",
    "D:\\Musica"
  ],
  "fuzzy_threshold": 0.80
}
```

* `music_directories`: Lista de carpetas donde tienes tu música.
* `fuzzy_threshold`: Nivel de tolerancia para coincidencias de nombres (0.80 por defecto).
* `cache_file`: Almacena los tracklists de Discogs en local para no repetir llamadas a la API.

---

## 📋 Funciones del Reporte Interactivo (`reporte_wishlist_digital.html`)

* **Buscador en tiempo real**: Filtra instantáneamente por artista, título de disco o nombre de tema.
* **Filtros rápidos**: Botones para ver solo completos (🟢), con tracks sueltos (🟡), faltantes (🔴) o favoritos (★).
* **Desglose de temas**: Muestra cada track (A1, A2, B1...) con su nombre y si fue encontrado en tu PC (indicando el archivo coincidente).
* **Botón "Copiar Tracks Faltantes"**: Copia al portapapeles una lista limpia en formato `Artista - Tema` de todos los tracks que te faltan, ideal para pegar en Soulseek, Nicotine+ o listas de descarga.

