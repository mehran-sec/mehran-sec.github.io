---
title: Detecting SSH Brute-Force with Wazuh
category: Detection
date: Oct 7, 2026
summary: Custom Wazuh correlation rules that catch SSH brute-force patterns, with threshold-based alerting and automated response triggers.
tags: Wazuh, Detection Rules, SSH, Linux
---

## Objective
[What are you detecting, and why does it matter to a SOC? One or two sentences.]

## Lab setup
[Which machines are involved (attacker, target, Wazuh manager and agent) and how they are connected.]

## Simulating the attack
[The tool or command you used to generate the brute-force traffic, and what the raw logs look like on the target.]

```bash
# [paste the command you ran, with real targets masked]
```

## Detection logic
[How the rule works: which base rule it builds on, the threshold, the time window, and why you chose those values.]

```xml
<!-- [paste your Wazuh rule here] -->
```

## Results
[Screenshots of the alert in the Wazuh dashboard, and what the automated response did.]

<!-- Screenshot example (put image in writeups/ or root):
![Wazuh alert](alert-screenshot.png) -->

## MITRE ATT&CK mapping

| Technique | ID | Why it applies |
|---|---|---|
| Brute Force | T1110 | [add the sub-technique that matches what you tested] |

## What I'd improve
[False positives you saw, tuning you'd do, and what you'd test next.]
