import difflib
from collections import defaultdict
from audio_scanner import normalize_text

class LibraryMatcher:
    def __init__(self, audio_files, fuzzy_threshold=0.80):
        self.audio_files = audio_files
        self.fuzzy_threshold = fuzzy_threshold
        self.index = defaultdict(set)
        self._build_index()

    def _build_index(self):
        # Index audio files by individual words for sub-millisecond candidate lookup
        for idx, af in enumerate(self.audio_files):
            words = set(af.norm_raw_filename.split() + af.norm_title.split())
            for w in words:
                if len(w) >= 3:
                    self.index[w].add(idx)

    def _find_candidate_indices(self, track_norm):
        words = [w for w in track_norm.split() if len(w) >= 3]
        if not words:
            # Short title (e.g. "Go", "DJ", "12") -> search all files
            return range(len(self.audio_files))

        candidates = set()
        for w in words:
            candidates.update(self.index.get(w, ()))
        return candidates

    def match_track(self, track_title, release_artists, track_artists=None):
        norm_track = normalize_text(track_title)
        if not norm_track:
            return None

        # Build list of normalized acceptable artists
        artists = track_artists if track_artists else release_artists
        norm_artists = [normalize_text(a) for a in artists if a]
        is_various = any(a in ("various", "various artists", "v a") for a in norm_artists)

        best_match = None
        best_score = 0.0

        candidates = self._find_candidate_indices(norm_track)

        for idx in candidates:
            af = self.audio_files[idx]
            
            # 1. Title Similarity
            # Check against normalized tag title
            sim_tag = difflib.SequenceMatcher(None, norm_track, af.norm_title).ratio() if af.norm_title else 0.0
            
            # Check against raw filename
            sim_fn = difflib.SequenceMatcher(None, norm_track, af.norm_raw_filename).ratio()
            
            # Substring match (e.g. filename is "Artist - Track Title - Remix")
            is_substring = norm_track in af.norm_raw_filename or (af.norm_title and norm_track in af.norm_title)
            
            title_score = max(sim_tag, sim_fn)
            if is_substring and title_score < 0.85:
                # Give a boost if the exact track title is inside the filename
                title_score = max(title_score, 0.88)

            if title_score < self.fuzzy_threshold:
                continue

            # 2. Artist Compatibility
            artist_score = 0.5  # Neutral default
            if not is_various and norm_artists:
                # Check if any artist is mentioned in artist tag or file path
                matched_art = False
                for art in norm_artists:
                    if not art:
                        continue
                    if art in af.norm_artist or art in af.norm_raw_filename or art in normalize_text(af.dir_name):
                        matched_art = True
                        break
                    # Fuzzy match artist
                    if af.norm_artist and difflib.SequenceMatcher(None, art, af.norm_artist).ratio() > 0.80:
                        matched_art = True
                        break

                artist_score = 1.0 if matched_art else 0.3
            else:
                artist_score = 0.9  # Compilations rely mostly on track title

            combined_score = (title_score * 0.7) + (artist_score * 0.3)

            if combined_score > best_score and combined_score >= self.fuzzy_threshold:
                best_score = combined_score
                best_match = {
                    "audio_file": af,
                    "score": round(combined_score, 2),
                    "matched_title": af.tag_title or af.guessed_title,
                    "matched_artist": af.tag_artist or af.guessed_artist,
                    "file_path": af.path,
                    "filename": af.filename
                }

        return best_match

    def match_release(self, release):
        tracklist = release.get("tracklist", [])
        artists = release.get("artists", [])
        
        matched_tracks = []
        found_count = 0

        for t in tracklist:
            t_title = t.get("title", "")
            t_pos = t.get("position", "")
            t_artists = t.get("artists", [])

            match = self.match_track(t_title, artists, t_artists)
            if match:
                found_count += 1
                matched_tracks.append({
                    "position": t_pos,
                    "title": t_title,
                    "found": True,
                    "score": match["score"],
                    "local_filename": match["filename"],
                    "local_path": match["file_path"]
                })
            else:
                matched_tracks.append({
                    "position": t_pos,
                    "title": t_title,
                    "found": False,
                    "score": 0.0,
                    "local_filename": None,
                    "local_path": None
                })

        total_tracks = len(tracklist)
        if total_tracks == 0:
            status = "empty_tracklist"
            pct = 0
        elif found_count == total_tracks:
            status = "full"
            pct = 100
        elif found_count > 0:
            status = "partial"
            pct = round((found_count / total_tracks) * 100)
        else:
            status = "missing"
            pct = 0

        return {
            "id": release.get("id"),
            "title": release.get("title", ""),
            "artists": artists,
            "artist_str": ", ".join(artists) if artists else "Varios Artistas",
            "year": release.get("year", 0),
            "thumb": release.get("thumb", ""),
            "status": status,
            "found_count": found_count,
            "total_tracks": total_tracks,
            "percentage": pct,
            "tracks": matched_tracks
        }

