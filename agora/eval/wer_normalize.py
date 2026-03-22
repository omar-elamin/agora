"""
Text normalization for WER (Word Error Rate) scoring.

Standardizes both reference and hypothesis text before WER comparison:
- Lowercase
- Expand common contractions
- Strip punctuation
- Convert digit numerals to word form

This prevents scoring artifacts where a model outputs "6" but the reference
says "six" — both are correct transcriptions, not errors.

Usage:
    from agora.eval.wer_normalize import normalize_for_wer
    import jiwer
    wer = jiwer.wer(normalize_for_wer(reference), normalize_for_wer(hypothesis))
"""

import re
from typing import Optional

NUMERAL_TO_WORD = {
    '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four',
    '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine',
    '10': 'ten', '11': 'eleven', '12': 'twelve', '13': 'thirteen',
    '14': 'fourteen', '15': 'fifteen', '16': 'sixteen', '17': 'seventeen',
    '18': 'eighteen', '19': 'nineteen', '20': 'twenty', '30': 'thirty',
    '40': 'forty', '50': 'fifty', '60': 'sixty', '70': 'seventy',
    '80': 'eighty', '90': 'ninety', '100': 'hundred',
}

_CONTRACTIONS = {
    "i'm": "i am", "don't": "do not", "we'll": "we will",
    "she'll": "she will", "he'll": "he will", "they'll": "they will",
    "he's": "he is", "she's": "she is", "it's": "it is",
    "can't": "cannot", "won't": "will not", "didn't": "did not",
    "doesn't": "does not", "isn't": "is not", "aren't": "are not",
    "wasn't": "was not", "weren't": "were not", "hasn't": "has not",
    "haven't": "have not", "couldn't": "could not", "wouldn't": "would not",
    "shouldn't": "should not", "that's": "that is", "there's": "there is",
    "we're": "we are", "they're": "they are", "you're": "you are",
    "i've": "i have", "you've": "you have", "we've": "we have",
    "they've": "they have", "i'd": "i would", "you'd": "you would",
    "he'd": "he would", "she'd": "she would", "we'd": "we would",
    "they'd": "they would", "let's": "let us",
}

# Pre-compile numeral pattern (longest first to match "100" before "10")
_NUMERAL_PATTERN = re.compile(
    r'\b(' + '|'.join(sorted(NUMERAL_TO_WORD.keys(), key=lambda x: -len(x))) + r')\b'
)


def normalize_for_wer(text: str) -> str:
    """
    Normalize text for fair WER comparison.
    
    Applies: lowercase → contraction expansion → punctuation removal →
    numeral-to-word conversion → whitespace normalization.
    """
    text = text.lower()
    
    # Expand contractions
    for contraction, expansion in _CONTRACTIONS.items():
        text = text.replace(contraction, expansion)
    
    # Strip punctuation (keep alphanumeric and whitespace)
    text = re.sub(r"[^\w\s]", '', text)
    
    # Convert numerals to words
    text = _NUMERAL_PATTERN.sub(lambda m: NUMERAL_TO_WORD[m.group()], text)
    
    # Normalize whitespace
    return ' '.join(text.split())


# Convenience alias
normalize = normalize_for_wer
