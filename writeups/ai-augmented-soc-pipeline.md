---
title: AI-Augmented SOC Alert Triage Pipeline
category: Security Automation
date: Oct 2026
summary: I built a system that automatically reads security alerts, checks them against threat intel databases, asks an AI for its opinion, and sends the ones that matter to the right people .
tags: n8n, Wazuh, SOAR, AI, VirusTotal, AbuseIPDB, Jira, Slack
---

## The Problem

A SOC analyst's first five minutes with any alert are the same. Copy the IP. Paste it into AbuseIPDB. Paste it into VirusTotal. Read a bit. Decide. Do that a hundred times a day and the boring part eats the thinking part.

I wanted the automation to do those five minutes, so a human only sees the alert once it already has context.

---

## What I Built

An automated pipeline that sits between Wazuh and the team. When Wazuh detects something, the pipeline:

1. Receives the alert
2. Cleans it up into a consistent format
3. Drops duplicates (so one brute-force attack doesn't generate 50 identical tickets)
4. Looks up any suspicious IPs, file hashes, domains, or URLs in AbuseIPDB and VirusTotal
5. Decides whether the alert is worth sending to AI
6. Asks an AI model to read the alert and give a verdict
7. Routes the result: real threats go to Slack and Jira, false positives go to an audit log

---

## Architecture


<img src="assets/soc-architecture.svg" alt="Pipeline architecture diagram" style="max-width:600px; width:100%; display:block; margin:0 auto;">

The whole pipeline runs in **n8n**, an automation tool I self-host with Docker. Wazuh runs natively on the same machine. A small Python script bridges the two.

---



## What each piece does
- **Wazuh** sends alerts to an n8n webhook as they happen.
- **Custom Script** A custom python script ships logs toward n8n webhook
- **Webhook** Recieves  alerts from  python script
- **Normalization and Deduplication** Alerts gets Normalized into a fixed fields and Duplicate alerts gets dropped 
- **AbuseIPDB and VirusTotal** answer one question: has anyone seen this address doing bad things?
- **Gate** Not every alert gets sent to the AI. That would be slow and expensive. The gate decides which alerts deserve it.
- **The LLM** (via Groq) gets the alert and the lookup results, and returns a structured response with veridict , Confidence , Justification suggested Action   and Investigation Query
- **Routing and Notification**  `true_positive` and `needs_review` ---> Slack message + Jira ticket + audit row
 `false_positive` → audit row only
- **Audit Log** Every alert — escalated or not — writes one row to a Google Sheet. Columns include the timestamp, outcome, rule details, agent name, indicators found, enrichment results, AI verdict, and suppressed duplicate count. This makes the whole system auditable. 


## Simulated ATTack:

![alt text](assets/ssh-hydra-attack.png)

The attack is simulated against a monitered endpoint. 

## Wazuh Alerts :
![alt text](<assets/SSH Brute force Alert Custom.png>)

Alert gets generated in wazuh which is then shipped via python script to n8n  webhook and it triggers the wrokflow 


## Deduplication

![Suppressed duplicate count in the audit sheet](assets/soc-suppressed-count.png)

The dedup step creates a fingerprint for each alert using a combination of fields: rule ID, agent name, username, source IP, command, file path, and so on. If the same fingerprint arrives within **120 seconds**, it's dropped. The count of suppressed duplicates is attached to the next alert that gets through, so the responder can see "this happened 14 times in the last two minutes."



---

## AI Triage

![AI verdict output for a true positive alert](assets/soc-ai-output.png)


Alerts that pass the gate go to a language model with the cleaned-up alert data. The model returns a structured response:

- Verdict
- Confidence
- Evidence
- Justification
- Primary driver
- Suggested action 
- Investigation query

If the model returns something unexpected —  the alert automatically becomes `needs_review`. Nothing is ever silently lost.

---

## Routing and Notification


![Slack notification for a true positive](assets/soc-slack-notify.png)

The Slack message includes the AI's verdict, confidence, justification, suggested action, and investigation query. 

---

## Audit Log

![Alert logged in the audit sheet](assets/soc-logged.png)

Every alert — escalated or not — writes one row to a Google Sheet. Columns include the timestamp, outcome, rule details, agent name, indicators found, enrichment results, AI verdict, and suppressed duplicate count.

---



## Testing

I tested the pipeline with 28 test cases before considering it done. Some examples:

| Test | What I checked |
|---|---|
| SSH brute force from a public IP with AbuseIPDB score 100 | AI verdict true_positive, Slack and Jira created |
| Same SSH alert repeated at 0, 30, 90, and 150 seconds | Pass, dropped, dropped, pass with `suppressed_prior = 2` |
| Windows login failure with the IP buried inside the raw alert | IP extracted from the nested field and looked up |
| FIM alert on /etc/passwd at level 12, AI says false positive | Floor kicks in, verdict raised to `needs_review` |
| Alert with prompt injection text in the log | AI handles it; pipeline doesn't break |
| VirusTotal returns rate-limit error (429) | Recorded as a lookup failure, alert still processed |
| AI returns garbage output | Treated as `needs_review`, nothing lost |
| Private IPs, loopback, link-local addresses | Zero lookups, as expected |

---

## Configuration

Everything tunable is in one place — a single Config node at the start of the n8n workflow. Nothing is buried inside individual nodes.

| Setting | Default |
|---|---|
| Gate level (min Wazuh severity to reach AI) | 7 |
| Floor level (AI can't downgrade above this) | 12 |
| AbuseIPDB threshold for "malicious" | confidence ≥ 50 |
| VirusTotal threshold for "malicious" | 3 or more engines |
| Dedup window | 120 seconds |

---

## Tech Stack

| Layer | Tool |
|---|---|
| SIEM / Detection | Wazuh |
| Automation | n8n (self-hosted via Docker) |
| Threat Intel | AbuseIPDB, VirusTotal |
| AI Model | Gemini (any LLM works via n8n credential) |
| Alerting | Slack |
| Ticketing | Jira Cloud |
| Audit Log | Google Sheets |
| Integration Script | Python 3 (standard library only) |

---

## What I Learned

**"No lookups" doesn't mean "no verdict."** An alert can have no public indicators at all and still be serious. The gate handles this — rule severity and MITRE technique alone can send an alert to the AI.

**The verdict floor changed how I think about AI in security.** An AI model shouldn't have the final say on a critical alert. The floor is a small thing technically, but it's the right call architecturally. The model helps; it doesn't decide.

---

## Known Limitations

- The pipeline analyses each alert on its own. A brute force followed by a successful login looks like two unrelated events unless Wazuh's correlation rules connect them first.
- There's no lookup caching. The same IP gets re-queried on every alert.
- Suppressed duplicate counts are stored in n8n's in-process memory, so they reset if the container restarts.

---

## Repository

[github.com/mehran-sec/Ai_Augmented_SOC](https://github.com/mehran-sec/Ai_Augmented_SOC)
