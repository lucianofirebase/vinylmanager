import os
import json
import time
import urllib.request
import urllib.error

USER_AGENT = "VinylWishlistScanner/1.0 (+https://github.com/vinyl-stock-manager)"

class DiscogsClient:
    def __init__(self, key, secret, cache_path="discogs_cache.json"):
        self.key = key
        self.secret = secret
        self.cache_path = cache_path
        self.cache = self._load_cache()
        self.last_request_time = 0.0

    def _load_cache(self):
        if os.path.exists(self.cache_path):
            try:
                with open(self.cache_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                print(f"[Aviso] No se pudo leer el archivo de caché ({e}). Se creará uno nuevo.")
        return {}

    def _save_cache(self):
        try:
            with open(self.cache_path, "w", encoding="utf-8") as f:
                json.dump(self.cache, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"[Error] No se pudo guardar la caché: {e}")

    def get_release(self, release_id):
        release_id_str = str(release_id).strip()
        if not release_id_str:
            return None

        # Check local cache first
        if release_id_str in self.cache:
            return self.cache[release_id_str]

        # Rate limiting: minimum 1.05s between calls (max 60 req/min for authenticated)
        now = time.time()
        elapsed = now - self.last_request_time
        if elapsed < 1.05:
            time.sleep(1.05 - elapsed)

        url = f"https://api.discogs.com/releases/{release_id_str}"
        headers = {
            "User-Agent": USER_AGENT,
            "Authorization": f"Discogs key={self.key}, secret={self.secret}"
        }

        req = urllib.request.Request(url, headers=headers)
        try:
            self.last_request_time = time.time()
            with urllib.request.urlopen(req, timeout=15) as res:
                if res.status == 200:
                    raw_data = json.loads(res.read().decode("utf-8"))
                    parsed = self._extract_release_info(raw_data)
                    self.cache[release_id_str] = parsed
                    self._save_cache()
                    return parsed
        except urllib.error.HTTPError as e:
            if e.code == 404:
                print(f"  [Discogs] Release {release_id_str} no encontrado (404).")
            elif e.code == 429:
                print(f"  [Discogs] Límite de tasa alcanzado (429). Esperando 10 segundos...")
                time.sleep(10)
                return self.get_release(release_id)
            else:
                print(f"  [Discogs] Error HTTP {e.code} para release {release_id_str}.")
        except Exception as e:
            print(f"  [Discogs] Error de conexión para release {release_id_str}: {e}")

        return None

    def _extract_release_info(self, data):
        # Extract tracklist filtering out section headers / empty items
        raw_tracklist = data.get("tracklist", [])
        tracks = []
        for t in raw_tracklist:
            # type_ is usually "track" or empty for tracks, "heading" for subtitles/sides
            t_type = t.get("type_", "track")
            title = (t.get("title") or "").strip()
            if not title or t_type == "heading":
                continue

            # Per-track artist if V/A compilation
            track_artists = []
            for art in t.get("artists", []):
                name = art.get("name", "").strip()
                if name:
                    track_artists.append(name)
            
            tracks.append({
                "position": t.get("position", ""),
                "title": title,
                "duration": t.get("duration", ""),
                "artists": track_artists
            })

        # Main artists
        artists = []
        for a in data.get("artists", []):
            name = a.get("name", "").strip()
            if name:
                artists.append(name)

        return {
            "id": data.get("id"),
            "title": data.get("title", ""),
            "artists": artists,
            "year": data.get("year", 0),
            "thumb": data.get("thumb", ""),
            "genres": data.get("genres", []),
            "styles": data.get("styles", []),
            "tracklist": tracks
        }

