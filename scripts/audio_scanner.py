import os
import re
import unicodedata

try:
    import mutagen
    from mutagen.easyid3 import EasyID3
    MUTAGEN_AVAILABLE = True
except ImportError:
    MUTAGEN_AVAILABLE = False

COMMON_AUDIO_EXTENSIONS = {".mp3", ".flac", ".wav", ".aiff", ".aif", ".m4a", ".ogg", ".wma", ".aac"}

# Clean noise words frequently appended to filenames
NOISE_PATTERNS = [
    r"\([^\)]*(?:original|extended|club|dub|radio|instrumental|remix|mix|edit|master|djmaster|dj master|re-master|-6db|-3db|pistas|rip|vinyl)[^\)]*\)",
    r"\[[^\]]*(?:original|extended|club|dub|radio|instrumental|remix|mix|edit|master|djmaster|dj master|re-master|-6db|-3db|pistas|rip|vinyl)[^\]]*\]",
    r"\b(?:original mix|extended mix|radio edit|dub mix|club mix|vocal mix|instrumental|remastered|dj master|-6db)\b",
]

def strip_accents(text):
    if not text:
        return ""
    text = unicodedata.normalize("NFD", text)
    return "".join(c for c in text if unicodedata.category(c) != "Mn")

def normalize_text(text):
    if not text:
        return ""
    s = strip_accents(text).lower()
    for pattern in NOISE_PATTERNS:
        s = re.sub(pattern, " ", s, flags=re.IGNORECASE)
    # Remove track positions like A1, A2, B1, 01, 12 at beginning
    s = re.sub(r"^[a-d]?[0-9]{1,2}[\s\.\-_]+", " ", s)
    # Remove special characters
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    # Collapse multiple whitespaces
    s = re.sub(r"\s+", " ", s).strip()
    return s

class AudioFile:
    def __init__(self, full_path):
        self.path = full_path
        self.filename = os.path.basename(full_path)
        self.basename, self.ext = os.path.splitext(self.filename)
        self.dir_name = os.path.basename(os.path.dirname(full_path))
        
        self.tag_title = ""
        self.tag_artist = ""
        self.tag_album = ""
        
        self._read_tags()
        self._guess_from_filename()
        
        # Normalized versions for matching
        self.norm_title = normalize_text(self.tag_title or self.guessed_title)
        self.norm_artist = normalize_text(self.tag_artist or self.guessed_artist)
        self.norm_raw_filename = normalize_text(self.basename)

    def _read_tags(self):
        if not MUTAGEN_AVAILABLE:
            return

        try:
            f = mutagen.File(self.path, easy=True)
            if f and f.tags:
                self.tag_title = f.tags.get("title", [""])[0] if f.tags.get("title") else ""
                self.tag_artist = f.tags.get("artist", [""])[0] if f.tags.get("artist") else ""
                self.tag_album = f.tags.get("album", [""])[0] if f.tags.get("album") else ""
        except Exception:
            pass

    def _guess_from_filename(self):
        # Look for "Artist - Title" or "01 - Artist - Title" or "Title - Artist"
        name = self.basename
        # Strip leading track numbers like "01. " or "A1 - "
        name = re.sub(r"^[a-d]?[0-9]{1,2}[\s\.\-_]+", "", name).strip()
        
        parts = [p.strip() for p in re.split(r"\s+-\s+", name) if p.strip()]
        if len(parts) >= 2:
            self.guessed_artist = parts[0]
            self.guessed_title = parts[1]
        else:
            self.guessed_artist = ""
            self.guessed_title = name

class AudioScanner:
    def __init__(self, directories=None, extensions=None):
        self.directories = directories or []
        self.extensions = set(ext.lower() for ext in (extensions or COMMON_AUDIO_EXTENSIONS))
        self.files = []

    def scan(self, callback=None):
        self.files = []
        total_scanned = 0

        for directory in self.directories:
            if not os.path.exists(directory):
                continue
            
            for root, _, filenames in os.walk(directory):
                for fname in filenames:
                    ext = os.path.splitext(fname)[1].lower()
                    if ext in self.extensions:
                        full_path = os.path.join(root, fname)
                        try:
                            audio = AudioFile(full_path)
                            self.files.append(audio)
                            total_scanned += 1
                            if callback and total_scanned % 50 == 0:
                                callback(total_scanned, fname)
                        except Exception:
                            continue

        return self.files

