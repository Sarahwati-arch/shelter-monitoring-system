# WIDER FACE Threshold Tuning Report
**Date:** 2026-05-28 11:26
**Sample dir:** `D:\shelter-monitoring-system\face_recognition\data\environment_frames\samples\wider`
**Thresholds tested:** [0.7, 0.8, 0.9]

---

## Ground Truth Mapping

| Category | Expected alert_flag | Meaning |
|----------|--------------------|-----------------------------------------|
| angled   | False              | Face present but rotated — should pass  |
| occluded | True               | Partially hidden — alert should fire    |
| noface   | True               | No usable face — alert should fire      |

---

## Results by Threshold

### Threshold = 0.7

| Metric    | Value |
|-----------|-------|
| Accuracy  | 0.375 |
| Precision | 0.0 |
| Recall    | 0.0 |
| F1 Score  | 0 |
| TP        | 0 |
| FP        | 1 |
| FN        | 4 |
| TN        | 3 |

| Image | Category | Expected Alert | Actual Alert | Top Conf | Result |
|-------|----------|---------------|--------------|----------|--------|
| angled_00_49_Greeting_peoplegreeting_49_307.jpg         | angled   | False         | False        | 0.999    | ✓ correct |
| angled_01_12_Group_Large_Group_12_Group_Large_Group_12_354.jpg | angled   | False         | False        | 0.999    | ✓ correct |
| angled_02_0_Parade_marchingband_1_78.jpg                | angled   | False         | True         | 0.000    | ✗ WRONG |
| angled_03_6_Funeral_Funeral_6_696.jpg                   | angled   | False         | False        | 1.000    | ✓ correct |
| occluded_00_26_Soldier_Drilling_Soldiers_Drilling_26_307.jpg | occluded | True          | False        | 1.000    | ✗ WRONG |
| occluded_01_23_Shoppers_Shoppers_23_65.jpg              | occluded | True          | False        | 0.990    | ✗ WRONG |
| occluded_02_21_Festival_Festival_21_378.jpg             | occluded | True          | False        | 1.000    | ✗ WRONG |
| occluded_03_2_Demonstration_Political_Rally_2_5.jpg     | occluded | True          | False        | 0.999    | ✗ WRONG |

### Threshold = 0.8

| Metric    | Value |
|-----------|-------|
| Accuracy  | 0.375 |
| Precision | 0.0 |
| Recall    | 0.0 |
| F1 Score  | 0 |
| TP        | 0 |
| FP        | 1 |
| FN        | 4 |
| TN        | 3 |

| Image | Category | Expected Alert | Actual Alert | Top Conf | Result |
|-------|----------|---------------|--------------|----------|--------|
| angled_00_49_Greeting_peoplegreeting_49_307.jpg         | angled   | False         | False        | 0.999    | ✓ correct |
| angled_01_12_Group_Large_Group_12_Group_Large_Group_12_354.jpg | angled   | False         | False        | 0.999    | ✓ correct |
| angled_02_0_Parade_marchingband_1_78.jpg                | angled   | False         | True         | 0.000    | ✗ WRONG |
| angled_03_6_Funeral_Funeral_6_696.jpg                   | angled   | False         | False        | 1.000    | ✓ correct |
| occluded_00_26_Soldier_Drilling_Soldiers_Drilling_26_307.jpg | occluded | True          | False        | 1.000    | ✗ WRONG |
| occluded_01_23_Shoppers_Shoppers_23_65.jpg              | occluded | True          | False        | 0.990    | ✗ WRONG |
| occluded_02_21_Festival_Festival_21_378.jpg             | occluded | True          | False        | 1.000    | ✗ WRONG |
| occluded_03_2_Demonstration_Political_Rally_2_5.jpg     | occluded | True          | False        | 0.999    | ✗ WRONG |

### Threshold = 0.9

| Metric    | Value |
|-----------|-------|
| Accuracy  | 0.375 |
| Precision | 0.0 |
| Recall    | 0.0 |
| F1 Score  | 0 |
| TP        | 0 |
| FP        | 1 |
| FN        | 4 |
| TN        | 3 |

| Image | Category | Expected Alert | Actual Alert | Top Conf | Result |
|-------|----------|---------------|--------------|----------|--------|
| angled_00_49_Greeting_peoplegreeting_49_307.jpg         | angled   | False         | False        | 0.999    | ✓ correct |
| angled_01_12_Group_Large_Group_12_Group_Large_Group_12_354.jpg | angled   | False         | False        | 0.999    | ✓ correct |
| angled_02_0_Parade_marchingband_1_78.jpg                | angled   | False         | True         | 0.000    | ✗ WRONG |
| angled_03_6_Funeral_Funeral_6_696.jpg                   | angled   | False         | False        | 1.000    | ✓ correct |
| occluded_00_26_Soldier_Drilling_Soldiers_Drilling_26_307.jpg | occluded | True          | False        | 1.000    | ✗ WRONG |
| occluded_01_23_Shoppers_Shoppers_23_65.jpg              | occluded | True          | False        | 0.990    | ✗ WRONG |
| occluded_02_21_Festival_Festival_21_378.jpg             | occluded | True          | False        | 1.000    | ✗ WRONG |
| occluded_03_2_Demonstration_Political_Rally_2_5.jpg     | occluded | True          | False        | 0.999    | ✗ WRONG |

---

## Summary Comparison

| Threshold | Accuracy | Precision | Recall | F1 Score |
|-----------|----------|-----------|--------|----------|
| 0.7       | 0.375 | 0.0 | 0.0 | 0 |
| 0.8       | 0.375 | 0.0 | 0.0 | 0 |
| 0.9       | 0.375 | 0.0 | 0.0 | 0 |

---

## Recommendation

**Best threshold by F1 score: `0.7` (F1 = 0.000)**

> Update `CONFIDENCE_THRESHOLD` in `src/stage1/stage1_face_detect.py`
> and record the rationale in `logs/confidence_threshold_log.md`.

### Decision notes
- If **FN > 0** (missed alerts): lower the threshold — masked/occluded faces are slipping through undetected.
- If **FP > 0** (false alerts on angled faces): acceptable for a shelter security context; angled faces are less common at entry points.
- Prioritise **Recall** over Precision — missing a real threat is worse than a false alarm.