from __future__ import annotations

# E.164 country code → derived BCP-47 locale (for phone_proxy fallback)
PHONE_COUNTRY_LOCALE_MAP = {
    # North America / Oceania — Native EN
    '+1':   'en-US',
    '+44':  'en-GB',
    '+61':  'en-AU',
    '+64':  'en-NZ',
    '+353': 'en-IE',
    # Germanic
    '+49':  'de-DE',
    '+43':  'de-AT',
    '+41':  'de-CH',
    '+31':  'nl-NL',
    '+32':  'nl-BE',
    # High-T: Arabic
    '+966': 'ar-SA',
    '+971': 'ar-AE',
    '+20':  'ar-EG',
    '+962': 'ar-JO',
    '+961': 'ar-LB',
    '+974': 'ar-QA',
    '+965': 'ar-KW',
    '+968': 'ar-OM',
    '+212': 'ar-MA',
    # High-T: South Asian
    '+91':  'hi-IN',
    '+92':  'ur-PK',
    '+880': 'bn-BD',
    # Farsi
    '+98':  'fa-IR',
    # Standard
    '+81':  'ja-JP',
    '+82':  'ko-KR',
    '+86':  'zh-CN',
    '+886': 'zh-TW',
    '+33':  'fr-FR',
    '+34':  'es-ES',
    '+52':  'es-MX',
    '+55':  'pt-BR',
    '+351': 'pt-PT',
}

NATIVE_EN_REGIONS = {'US', 'GB', 'AU', 'NZ', 'CA', 'IE'}
GERMANIC_LANG_CODES = {'de', 'nl', 'af'}
HIGH_T_LANG_CODES = {'ar', 'hi', 'ur'}
DRAVIDIAN_LANG_CODES = {'ta', 'te'}
FARSI_LANG_CODE = 'fa'

T_MAP = {
    'native_en': 1.0,
    'low_t_germanic': 2.0,
    'low_t_farsi': 1.5,
    'standard': 4.0,
    'dravidian': 3.25,
    'high_t': 6.5,
    'south_asian_en': 5.0,
}


def _phone_proxy_confidence(prefix: str, derived_locale: str) -> tuple[str, str | None]:
    if prefix == '+1':
        return 'medium', 'US and CA share +1; locale may be en-CA instead of en-US'
    if prefix == '+41':
        return 'medium', 'Switzerland is trilingual (de/fr/it); caller may not speak German'
    if prefix == '+32':
        return 'medium', 'Belgium is split Dutch/French; caller may speak fr-BE'
    if prefix == '+91':
        return 'medium', 'India is multilingual; caller may speak en-IN or a regional language instead of hi-IN'

    lang = derived_locale.split('-')[0].lower()

    if lang == 'en':
        return 'high', 'approximately 15–20% of callers from this region may be L2 English speakers'

    if lang in {'de', 'nl', 'fa', 'ar', 'ur'}:
        return 'high', None

    return 'medium', 'locale derived from phone country code; actual language may differ'


def derive_locale_from_phone(caller_phone: str) -> dict | None:
    for length in (4, 3, 2):
        prefix = caller_phone[:length]
        if prefix in PHONE_COUNTRY_LOCALE_MAP:
            derived_locale = PHONE_COUNTRY_LOCALE_MAP[prefix]
            confidence, caveat = _phone_proxy_confidence(prefix, derived_locale)
            result = {
                'derived_locale': derived_locale,
                'locale_source': 'phone_proxy',
                'phone_proxy_confidence': confidence,
            }
            if caveat:
                result['phone_proxy_caveat'] = caveat
            return result
    return None


def route_speaker_locale(
    speaker_locale: str | None,
    caller_phone: str | None = None,
    whisper_lang: str = None,
) -> dict:
    result = {
        'wer_tier': 'LOW',
        'model_recommendation': 'baseline_ok',
        'locale_source': 'customer' if speaker_locale else 'default',
    }

    if speaker_locale:
        parts = speaker_locale.split('-')
        lang = parts[0].lower()
        region = parts[1].upper() if len(parts) > 1 else None

        if lang == 'en' and region in NATIVE_EN_REGIONS:
            result.update({'t_class': 'native_en', 'optimal_T': T_MAP['native_en']})
            return result

        if lang == 'en' and region == 'IN':
            result.update({'t_class': 'south_asian_en', 'optimal_T': T_MAP['south_asian_en']})
            return result

        if lang == FARSI_LANG_CODE:
            result.update({'t_class': 'low_t_farsi', 'optimal_T': T_MAP['low_t_farsi']})
            return result

        if lang in GERMANIC_LANG_CODES:
            result.update({'t_class': 'low_t_germanic', 'optimal_T': T_MAP['low_t_germanic']})
            return result

        if lang in HIGH_T_LANG_CODES:
            result.update({'t_class': 'high_t', 'optimal_T': T_MAP['high_t']})
            return result

        if lang in DRAVIDIAN_LANG_CODES:
            result.update({
                't_class': 'dravidian',
                'optimal_T': T_MAP['dravidian'],
                'wer_tier': 'HIGH',
                'model_recommendation': 'upgrade',
                'model_recommendation_note': (
                    'base.en shows 16–22% WER on Dravidian-accented English. '
                    'Upgrading to large-v3 may reduce WER to <5% and change calibration requirements.'
                ),
            })
            return result

    # Phone proxy fallback
    if not speaker_locale and caller_phone:
        proxy = derive_locale_from_phone(caller_phone)
        if proxy:
            derived_locale = proxy['derived_locale']
            proxy_result = route_speaker_locale(
                speaker_locale=derived_locale,
                caller_phone=None,
                whisper_lang=whisper_lang,
            )
            proxy_result['locale_source'] = 'phone_proxy'
            proxy_result['phone_proxy_confidence'] = proxy['phone_proxy_confidence']
            if proxy.get('phone_proxy_caveat'):
                proxy_result['phone_proxy_caveat'] = proxy['phone_proxy_caveat']
            return proxy_result

    # whisper_lang fallback
    if whisper_lang and whisper_lang in ('de', 'nl'):
        result.update({
            't_class': 'low_t_germanic',
            'optimal_T': T_MAP['low_t_germanic'],
            'locale_source': 'whisper_lang',
        })
        return result

    if whisper_lang and whisper_lang in ('ar', 'hi', 'ur'):
        result.update({
            't_class': 'high_t',
            'optimal_T': T_MAP['high_t'],
            'locale_source': 'whisper_lang',
        })
        return result

    # Default
    result.update({'t_class': 'standard', 'optimal_T': T_MAP['standard']})
    return result
