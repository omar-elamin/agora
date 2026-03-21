# GET /api/v1/vendors/{vendor_id}/ood-profile

Returns the out-of-distribution (OOD) robustness profile for a vendor, including per-dataset shift metrics and the PRS (Production Readiness Score) contribution from OOD evaluation.

## Authentication

Requires `x-api-key` header.

## Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `vendor_id` | string | ✅ | The vendor identifier (e.g. `deepgram`, `whisper-large-v3`) |

## Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `task_category` | string | `asr` | Task category for the evaluation (e.g. `asr`) |
| `use_case_profile` | string | `default` | PRS weight profile. One of: `default`, `high_stakes`, `commodity`, `multi_domain`. See [PRS Weight Profiles](./prs-weight-profiles.md). |

## Response (200)

```json
{
  "vendor_id": "deepgram",
  "task_category": "asr",
  "eval_date": "2026-03-20",
  "id_ece": 0.032,
  "id_accuracy": 0.94,
  "per_set_results": [
    {
      "set_name": "noisy-restaurant",
      "shift_type": "covariate",
      "n_ood": 500,
      "n_id": 500,
      "id_ece": 0.028,
      "ood_ece": 0.071,
      "ece_shift": 0.043,
      "id_accuracy": 0.95,
      "ood_accuracy": 0.82,
      "mean_conf_id": 0.93,
      "mean_conf_ood": 0.88,
      "cii": 0.15,
      "auroc": 0.87
    }
  ],
  "aggregates": {
    "mean_ece_shift": 0.043,
    "max_cii": 0.15,
    "ood_detection_auroc": 0.87
  },
  "prs_contribution": {
    "score": 72.5,
    "use_case_profile": "default",
    "weights_applied": {
      "trust": 0.30,
      "drift": 0.25,
      "cii": 0.25,
      "auroc": 0.20
    },
    "buyer_display": {
      "profile_label": "General (Default)"
    }
  }
}
```

## Error Responses

| Status | Body | When |
|--------|------|------|
| 401 | `{"error": "..."}` | Missing or invalid API key |
| 400 | `{"error": "Invalid use_case_profile '...'. Valid values: default, high_stakes, commodity, multi_domain"}` | Unknown profile name |
| 404 | `{"error": "No OOD profile found for vendor"}` | No OOD eval data exists for vendor + task category |

## Examples

### Basic request

```bash
curl -H "x-api-key: YOUR_KEY" \
  "https://agora.caretta.so/api/v1/vendors/deepgram/ood-profile"
```

### With custom profile

```bash
curl -H "x-api-key: YOUR_KEY" \
  "https://agora.caretta.so/api/v1/vendors/deepgram/ood-profile?use_case_profile=high_stakes&task_category=asr"
```

## Notes

- If no trust score exists for the vendor, it defaults to `0.5`.
- A trust floor applies: PRS is soft-capped at 70 when `trust_score_id < 0.60`, regardless of weight profile.
- See [PRS Weight Profiles](./prs-weight-profiles.md) for detailed weight descriptions.
