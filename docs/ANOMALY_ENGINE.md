# Explainable anomaly detection

Deterministic intake, duplicate and identity rules run independently of Isolation Forest. The statistical service aggregates real database enrolments per institution/year into utilization, supernumerary ratio, NRI ratio and flagged-record ratio. IsolationForest uses 160 estimators, contamination 0.06 and random_state 26263. decision_function scores rank patterns; they are not probabilities of misconduct.

Findings retain all feature values, model name, score, institution, academic year, explanation and review outcome. Reviewers can request clarification, mark expected, confirm discrepancy or resolve. The model is fitted on the current synthetic peer set when an authorized central user runs it.

scripts/evaluate.py fits a separate 500-row synthetic training distribution and predicts a labelled 240-row hold-out set. The hold-out set is not used for fitting. It measures precision, recall, F1, confusion matrix and execution time. The original measured 0.80 precision and 1.00 recall are reproducible for the deterministic seed; only current evaluation.json is authoritative. This exercise does not establish accuracy on real AICTE submissions or demonstrate a national production baseline.
