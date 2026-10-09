import re
import unicodedata

from app.shared.errors import InvalidSlugError


class Slug:
    """Identifiant sur pour un nom de fichier ou de dossier: a-z, 0-9, _ et -, 64 au plus.

    Les noms envoyes par l'agent (circuit, poste, run) ne sont jamais utilises tels quels dans un
    chemin: `from_untrusted` les nettoie, le constructeur refuse tout ce qui n'est pas deja sur.
    """

    MAX_LENGTH = 64
    _VALID = re.compile(r"[a-z0-9][a-z0-9_-]*")
    _INVALID_RUN = re.compile(r"[^a-z0-9_-]+")

    def __init__(self, value: str) -> None:
        if not value or len(value) > self.MAX_LENGTH or not self._VALID.fullmatch(value):
            raise InvalidSlugError(f"identifiant invalide: {value[:80]!r}")
        self._value = value

    @classmethod
    def from_untrusted(cls, raw: str, max_length: int = MAX_LENGTH) -> "Slug":
        folded = unicodedata.normalize("NFKD", raw).encode("ascii", "ignore").decode("ascii")
        cleaned = cls._INVALID_RUN.sub("_", folded.lower()).strip("_-")
        return cls(cleaned[:max_length].rstrip("_-"))

    @property
    def value(self) -> str:
        return self._value

    def __str__(self) -> str:
        return self._value

    def __repr__(self) -> str:
        return f"Slug({self._value!r})"

    def __eq__(self, other: object) -> bool:
        return isinstance(other, Slug) and other._value == self._value

    def __hash__(self) -> int:
        return hash(self._value)
