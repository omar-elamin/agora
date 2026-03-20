import pytest

from agora.eval.calibration.speaker_locale import (
    derive_locale_from_phone,
    route_speaker_locale,
)


class TestPhoneProxyRouting:
    def test_nanp_us(self):
        result = route_speaker_locale(speaker_locale=None, caller_phone="+12125551234")
        assert result['t_class'] == 'native_en'
        assert result['optimal_T'] == 1.0
        assert result['locale_source'] == 'phone_proxy'
        assert result['phone_proxy_confidence'] == 'medium'

    def test_germany(self):
        result = route_speaker_locale(speaker_locale=None, caller_phone="+4930123456")
        assert result['t_class'] == 'low_t_germanic'
        assert result['optimal_T'] == 2.0
        assert result['locale_source'] == 'phone_proxy'
        assert result['phone_proxy_confidence'] == 'high'
        assert 'phone_proxy_caveat' not in result

    def test_india(self):
        result = route_speaker_locale(speaker_locale=None, caller_phone="+912222000000")
        assert result['t_class'] == 'high_t'
        assert result['optimal_T'] == 6.5
        assert result['locale_source'] == 'phone_proxy'
        assert result['phone_proxy_confidence'] == 'medium'

    def test_switzerland(self):
        result = route_speaker_locale(speaker_locale=None, caller_phone="+41446681800")
        assert result['t_class'] == 'low_t_germanic'
        assert result['optimal_T'] == 2.0
        assert result['locale_source'] == 'phone_proxy'
        assert result['phone_proxy_confidence'] == 'medium'
        assert 'phone_proxy_caveat' in result

    def test_belgium(self):
        result = route_speaker_locale(speaker_locale=None, caller_phone="+3225551234")
        assert result['t_class'] == 'low_t_germanic'
        assert result['optimal_T'] == 2.0
        assert result['locale_source'] == 'phone_proxy'
        assert result['phone_proxy_confidence'] == 'medium'
        assert 'phone_proxy_caveat' in result

    def test_unmapped_number(self):
        result = route_speaker_locale(speaker_locale=None, caller_phone="+8501234567")
        assert result['t_class'] == 'standard'
        assert result['optimal_T'] == 4.0
        assert result['locale_source'] == 'default'

    def test_speaker_locale_takes_precedence(self):
        result = route_speaker_locale(speaker_locale="de-DE", caller_phone="+12125551234")
        assert result['locale_source'] == 'customer'
        assert result['t_class'] == 'low_t_germanic'

    def test_no_locale_no_phone(self):
        result = route_speaker_locale(speaker_locale=None)
        assert result['t_class'] == 'standard'
        assert result['locale_source'] == 'default'

    def test_ireland_four_digit_prefix(self):
        result = route_speaker_locale(speaker_locale=None, caller_phone="+35312345678")
        assert result['t_class'] == 'native_en'
