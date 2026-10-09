from app.features.ingestion.validation import SampleValidator
from tests.support import sample


def test_valid_samples_pass():
    outcome = SampleValidator().validate([sample(), sample()])
    assert (len(outcome.valid), outcome.rejected) == (2, 0)


def test_each_invalid_sample_is_rejected_alone_with_its_reason():
    samples = [sample(), sample(speed_kmh=900), sample(lap_time_ms=-5), sample(track_pos=0.9)]
    outcome = SampleValidator().validate(samples)
    assert (len(outcome.valid), outcome.rejected) == (2, 2)
    assert set(outcome.reasons) == {"speed_kmh:less_than_equal", "lap_time_ms:greater_than_equal"}


def test_missing_field_has_a_reason():
    incomplete = sample()
    del incomplete["rpm"]
    outcome = SampleValidator().validate([incomplete])
    assert outcome.reasons == {"rpm:missing": 1}


def test_garbage_does_not_raise():
    outcome = SampleValidator().validate([{}, {"x": "abc"}])
    assert outcome.rejected == 2
