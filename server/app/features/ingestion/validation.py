from collections import Counter
from collections.abc import Iterable
from dataclasses import dataclass, field

from pydantic import ValidationError

from app.shared.contract import Sample


@dataclass(frozen=True)
class ValidationOutcome:
    valid: list[Sample] = field(default_factory=list)
    rejected: int = 0
    reasons: Counter[str] = field(default_factory=Counter)


class SampleValidator:
    """Le serveur ne fait pas confiance a l'agent: chaque echantillon est valide seul.

    Un rejet est compte avec sa raison ("champ:type") et ne fait jamais echouer le lot.
    """

    def validate(self, raw_samples: Iterable[dict]) -> ValidationOutcome:
        valid: list[Sample] = []
        reasons: Counter[str] = Counter()
        rejected = 0
        for raw in raw_samples:
            try:
                valid.append(Sample.model_validate(raw))
            except ValidationError as exc:
                rejected += 1
                first = exc.errors()[0]
                reasons[f"{'.'.join(map(str, first['loc']))}:{first['type']}"] += 1
        return ValidationOutcome(valid, rejected, reasons)
