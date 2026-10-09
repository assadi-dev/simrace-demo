class DomainError(Exception):
    """Erreur metier. La couche API la traduit en reponse HTTP (voir shared/api.py)."""


class NotFoundError(DomainError):
    """La ressource demandee n'existe pas."""


class ConflictError(DomainError):
    """L'operation entre en conflit avec l'etat existant."""


class InvalidInputError(DomainError):
    """Une valeur fournie est refusee."""


class InvalidSlugError(InvalidInputError):
    """Un identifiant ne peut pas servir de nom de fichier ou de dossier."""
