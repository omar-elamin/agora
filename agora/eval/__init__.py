EVAL_TASKS = {
    "sentiment_ood": {
        "task_type": "text_classification",
        "num_classes": 3,
        "labels": ["positive", "negative", "neutral"],
        "id_dataset": {
            "loader": "dynasent",
            "config": "dynasent-r1",
            "split": "test",
            "label_filter": "strict",
        },
        "ood_dataset": {
            "loader": "dynasent",
            "config": "dynasent-r2",
            "split": "test",
            "label_filter": "strict",
        },
        "primary_metric": "accuracy",
        "ood_metric": "accuracy_delta",
        "degradation_thresholds": {
            "low": 0.05,
            "high": 0.10,
        },
        "attribution": {
            "name": "DynaSent",
            "license": "CC BY 4.0",
            "citation": "Potts et al., ACL 2021",
        },
    },
}
