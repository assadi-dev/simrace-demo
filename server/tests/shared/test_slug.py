import pytest

from app.shared.errors import InvalidSlugError
from app.shared.slug import Slug


@pytest.mark.parametrize("value", ["monza", "sim-1", "a_b", "x" * 64])
def test_accepts_safe_identifiers(value):
    assert str(Slug(value)) == value


@pytest.mark.parametrize("value", ["", "..", "a/b", "a\\b", "Monza", "-x", "_x", "a b", "x" * 65])
def test_rejects_unsafe_identifiers(value):
    with pytest.raises(InvalidSlugError):
        Slug(value)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("Nürburgring", "nurburgring"),
        ("Spa-Francorchamps", "spa-francorchamps"),
        ("../../etc/passwd", "etc_passwd"),
        ("A b/c", "a_b_c"),
        ("  Monza  ", "monza"),
    ],
)
def test_from_untrusted_cleans_names(raw, expected):
    assert str(Slug.from_untrusted(raw)) == expected


def test_from_untrusted_truncates():
    assert str(Slug.from_untrusted("abcdefghij", max_length=4)) == "abcd"


@pytest.mark.parametrize("raw", ["", "///", "   ", "..", "日本"])
def test_from_untrusted_refuses_names_with_nothing_usable(raw):
    with pytest.raises(InvalidSlugError):
        Slug.from_untrusted(raw)


def test_value_object_equality():
    assert Slug("monza") == Slug("monza")
    assert Slug("monza") != Slug("spa")
    assert len({Slug("monza"), Slug("monza")}) == 1
