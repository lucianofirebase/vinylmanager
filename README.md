# Vinyl Stock Manager

Herramientas para coleccionistas de vinilos en Discogs:

1. **[Discogs Wishlist Matcher (Extensión de Navegador)](./discogs-match-extension)**:
   * Extensión para Chrome y Brave que analiza vendedores de Discogs en vivo para agrupar compras de tu lista de deseos (Wantlist) y ahorrar en envíos combinados.
   * Dashboard interactivo: filtros por país de destino, detección de ofertas disponibles, vinilos sin envío y vinilos agotados mundialmente.
   * Instalación: Cargar descomprimida la carpeta `discogs-match-extension` desde `chrome://extensions` o `brave://extensions`.

2. **[Auditor de Wishlist vs Biblioteca Digital](./scripts)**:
   * Script para PC (Python) que cruza tu archivo CSV exportado desde la extensión con tus carpetas de música (`.mp3`, `.flac`, `.wav`, `.aiff`).
   * Detecta si tienes el álbum completo, tracks sueltos o 0% en tu computadora.
   * Genera un reporte interactivo en HTML y permite copiar listas de búsqueda para Soulseek o descargas.
   * Ejecución: Arrastrar el archivo CSV sobre `iniciar_auditor.bat` o hacer doble clic.
