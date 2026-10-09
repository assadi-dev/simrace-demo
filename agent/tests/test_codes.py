from simrace_agent import codes


def test_known_codes_have_a_readable_name():
    assert codes.describe_flag(2) == "jaune"
    assert "coupure de piste" in codes.describe_penalty(2)
    assert "exces de vitesse" in codes.describe_penalty(8)


def test_unknown_code_is_kept_not_lost():
    assert codes.describe_flag(42) == "inconnu (42)"
    assert codes.describe_penalty(99) == "inconnue (99)"


def test_missing_value_is_not_available():
    assert codes.describe_flag(None) == "n.d."
    assert codes.describe_penalty(None) == "n.d."


def test_tables_are_contiguous_from_zero():
    assert sorted(codes.FLAGS) == list(range(len(codes.FLAGS)))
    assert sorted(codes.PENALTIES) == list(range(len(codes.PENALTIES)))
