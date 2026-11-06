import os
import sys
import csv
import json
import time

from discogs_client import DiscogsClient
from audio_scanner import AudioScanner
from matcher import LibraryMatcher
from html_reporter import generate_report

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config.json")

def load_config():
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {
        "consumer_key": "kTXBUunaWzBTXwJZlRga",
        "consumer_secret": "uZxBlMTEDrEMcPblPAoQChIrhlZivIwz",
        "music_directories": [
            os.path.join(os.path.expanduser("~"), "Music")
        ],
        "cache_file": "discogs_cache.json",
        "fuzzy_threshold": 0.80
    }

def save_config(cfg):
    try:
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(cfg, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"[Aviso] No se pudo actualizar config.json: {e}")

def find_default_csv():
    # 1. Current workspace directory
    for f in os.listdir("."):
        if f.lower().endswith(".csv") and ("discogs" in f.lower() or "want" in f.lower() or "wishlist" in f.lower()):
            return os.path.abspath(f)
    # 2. User Desktop directory
    desktop = os.path.join(os.path.expanduser("~"), "Desktop")
    if os.path.exists(desktop):
        candidates = [
            os.path.join(desktop, f) for f in os.listdir(desktop)
            if f.lower().endswith(".csv") and ("discogs" in f.lower() or "want" in f.lower() or "wishlist" in f.lower())
        ]
        if candidates:
            candidates.sort(key=os.path.getmtime, reverse=True)
            return candidates[0]
    # 3. User Downloads directory
    downloads = os.path.join(os.path.expanduser("~"), "Downloads")
    if os.path.exists(downloads):
        candidates = [
            os.path.join(downloads, f) for f in os.listdir(downloads)
            if f.lower().endswith(".csv") and ("discogs" in f.lower() or "want" in f.lower() or "wishlist" in f.lower())
        ]
        if candidates:
            candidates.sort(key=os.path.getmtime, reverse=True)
            return candidates[0]
    return None

def parse_wishlist_csv(csv_path):
    items = []
    encodings = ["utf-8-sig", "utf-8", "latin-1"]
    content = None
    for enc in encodings:
        try:
            with open(csv_path, "r", encoding=enc) as f:
                content = f.read()
                break
        except Exception:
            continue

    if not content:
        raise ValueError(f"No se pudo leer el archivo CSV: {csv_path}")

    first_line = content.splitlines()[0] if content.splitlines() else ""
    delimiter = "\t" if "\t" in first_line else ","
    reader = csv.DictReader(content.splitlines(), delimiter=delimiter)

    for row in reader:
        # Detect release ID
        release_id = None
        for key in ["Discogs ID", "release_id", "id", "Release ID", "ReleaseId"]:
            if key in row and row[key].strip():
                release_id = row[key].strip()
                break
        
        # If release_id is only present inside a URL
        if not release_id and "URL Discogs" in row:
            url_part = row["URL Discogs"].strip().rstrip("/").split("/")[-1]
            if url_part.isdigit():
                release_id = url_part

        # Detect Artist & Title
        artist = row.get("Artista") or row.get("Artist") or ""
        title = row.get("Título") or row.get("Titulo") or row.get("Title") or ""
        year = row.get("Año") or row.get("Released") or row.get("Year") or ""
        is_priority = (row.get("Prioritario (★)") or row.get("Priority") or "").upper() in ("SÍ", "SI", "YES", "TRUE", "1")

        if release_id or title:
            items.append({
                "id": release_id,
                "artist": artist.strip(),
                "title": title.strip(),
                "year": year.strip(),
                "is_priority": is_priority
            })

    return items

def main():
    print("==========================================================")
    print("   💿 AUDITOR DE WISHLIST VS BIBLIOTECA DIGITAL (DISCOGS)  ")
    print("==========================================================\n")

    cfg = load_config()
    cache_path = os.path.join(os.path.dirname(__file__), cfg.get("cache_file", "discogs_cache.json"))
    client = DiscogsClient(cfg["consumer_key"], cfg["consumer_secret"], cache_path=cache_path)

    # --- 1. SELECCIÓN DE ARCHIVO CSV ---
    csv_path = None
    if len(sys.argv) > 1 and os.path.exists(sys.argv[1]):
        csv_path = sys.argv[1]
    else:
        detected = find_default_csv()
        if detected:
            print(f"Se detectó un archivo CSV reciente en Descargas:")
            print(f"  📄 {os.path.basename(detected)}")
            print(f"Presiona [ENTER] para usarlo, o arrastra otro archivo CSV aquí:")
            user_choice = input("> ").strip().strip('"').strip("'")
            if user_choice and os.path.exists(user_choice):
                csv_path = user_choice
            else:
                csv_path = detected
        else:
            print("Arrastra y suelta tu archivo CSV de Discogs aquí y presiona [ENTER]:")
            user_choice = input("> ").strip().strip('"').strip("'")
            if user_choice and os.path.exists(user_choice):
                csv_path = user_choice
            else:
                print("\n[Error] No se seleccionó ningún archivo CSV. Saliendo.")
                return

    print(f"\n[1/4] Procesando Wishlist desde: {os.path.basename(csv_path)}")
    try:
        items = parse_wishlist_csv(csv_path)
    except Exception as e:
        print(f"[Error] Falló la lectura del archivo CSV: {e}")
        return

    print(f"      -> Se encontraron {len(items)} discos en tu lista.")
    if not items:
        print("[Aviso] El archivo CSV está vacío.")
        return

    # --- 2. CONFIGURACIÓN DE CARPETAS DE MÚSICA ---
    configured_dirs = cfg.get("music_directories", [])
    valid_dirs = [os.path.abspath(d) for d in configured_dirs if os.path.exists(d)]

    if not valid_dirs:
        default_music = os.path.join(os.path.expanduser("~"), "Music")
        if os.path.exists(default_music):
            valid_dirs.append(default_music)

    print(f"\n[2/4] Carpetas de música configuradas para escanear:")
    for d in valid_dirs:
        print(f"      📁 {d}")

    # Prompt if user wants to add an extra folder
    print("\n¿Deseas agregar otra carpeta a escanear (ej: D:\\Musica)?")
    print("Escribe la ruta o presiona [ENTER] para continuar con las actuales:")
    extra_dir = input("> ").strip().strip('"').strip("'")
    if extra_dir:
        if os.path.exists(extra_dir):
            abs_extra = os.path.abspath(extra_dir)
            if abs_extra not in valid_dirs:
                valid_dirs.append(abs_extra)
                cfg["music_directories"] = valid_dirs
                save_config(cfg)
                print(f"      -> Agregada y guardada en config: {abs_extra}")
        else:
            print(f"      [Aviso] La ruta '{extra_dir}' no existe. Se omitirá.")

    print(f"\n      Iniciando escaneo de audio...")
    scanner = AudioScanner(directories=valid_dirs, extensions=cfg.get("audio_extensions"))
    
    def on_progress(count, last_file):
        print(f"\r      Escaneados {count} archivos de audio...", end="", flush=True)

    audio_files = scanner.scan(callback=on_progress)
    print(f"\r      Total de archivos de audio encontrados: {len(audio_files)} archivos.           \n")

    # --- 3. COMPARACIÓN CON DISCOGS ---
    print(f"[3/4] Obteniendo tracklists de Discogs y buscando coincidencias en tu biblioteca...")
    matcher = LibraryMatcher(audio_files, fuzzy_threshold=cfg.get("fuzzy_threshold", 0.80))

    results = []
    full_count = 0
    partial_count = 0
    missing_count = 0

    for i, it in enumerate(items, 1):
        rel_id = it.get("id")
        artist = it.get("artist") or "Varios Artistas"
        title = it.get("title") or "Sin Título"
        priority = it.get("is_priority", False)

        tag_prio = "★ " if priority else ""
        print(f"  [{i}/{len(items)}] {tag_prio}{artist} - {title} ... ", end="", flush=True)

        rel_data = None
        if rel_id:
            rel_data = client.get_release(rel_id)

        if not rel_data:
            # Fallback if release details couldn't be fetched
            rel_data = {
                "id": rel_id or "N/A",
                "title": title,
                "artists": [artist] if artist else [],
                "year": it.get("year", ""),
                "thumb": "",
                "tracklist": [{"position": "1", "title": title, "artists": [artist] if artist else []}]
            }

        matched = matcher.match_release(rel_data)
        matched["is_priority"] = priority

        if matched["status"] == "full":
            full_count += 1
            print(f"🟢 COMPLETO ({matched['found_count']}/{matched['total_tracks']})")
        elif matched["status"] == "partial":
            partial_count += 1
            print(f"🟡 PARCIAL ({matched['found_count']}/{matched['total_tracks']})")
        else:
            missing_count += 1
            print(f"🔴 FALTANTE (0/{matched['total_tracks']})")

        results.append(matched)

    # --- 4. GENERACIÓN DE REPORTE HTML ---
    print(f"\n[4/4] Generando reporte visual interactivo...")
    summary = {
        "total_releases": len(results),
        "full_count": full_count,
        "partial_count": partial_count,
        "missing_count": missing_count,
        "total_audio_files": len(audio_files)
    }

    report_dir = os.path.dirname(os.path.abspath(csv_path))
    report_path = os.path.join(report_dir, "reporte_wishlist_digital.html")
    generate_report(results, summary, output_path=report_path, auto_open=True)

    print("\n==========================================================")
    print("   ¡Auditoría finalizada con éxito!")
    print(f"   🟢 Álbumes completos en digital:  {full_count}")
    print(f"   🟡 Discos con tracks sueltos:    {partial_count}")
    print(f"   🔴 Discos que no tienes aún:      {missing_count}")
    print(f"   🌐 Reporte interactivo abierto en tu navegador.")
    print("==========================================================\n")

if __name__ == "__main__":
    main()
