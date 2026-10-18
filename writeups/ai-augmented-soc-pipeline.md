---
title: AI-Augmented SOC Alert Triage Pipeline
category: Security Automation
date: Oct 2026
summary: I built a system that automatically reads security alerts, checks them against threat intel databases, asks an AI for its opinion, and sends the ones that matter to the right people — so nobody has to do that manually.
tags: n8n, Wazuh, SOAR, AI, VirusTotal, AbuseIPDB, Jira, Slack
---

## The Problem

Security monitoring tools like Wazuh generate a lot of alerts. Most of them are noise. A few are real. A SOC analyst's job, at the first level, is to look at each alert, look up the suspicious IP or file, decide if it's worth worrying about, and pass it on.

That cycle — copy the IP, check AbuseIPDB, check VirusTotal, read the result, write a summary — can take five minutes per alert. Do that a hundred times a day and the repetitive part swallows the thinking part.

I wanted a system that does that five-minute cycle automatically, so a human only sees an alert once it already comes with context and a recommendation.

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

## How Each Part Works

### Receiving the Alert

Wazuh calls a custom Python script whenever it detects something matching the integration rule. The script reads the alert file Wazuh writes to disk, adds a few helper fields, and POSTs it to an n8n webhook.

The webhook is protected by a token — no token, no entry.

---

### Normalisation

Wazuh alerts don't all have the same shape. A Windows login failure looks different from a Linux SSH alert, which looks different from a file integrity alert. The normalisation step extracts a consistent set of fields from all of them:

- Source IP
- Username
- Command
- File path and hash
- Domain
- URL

If a field isn't present, it's set to null. n8n never crashes on a missing key because every field is always there.

---

### Deduplication

During a brute-force attack, Wazuh can fire the same alert dozens of times a minute. Without deduplication, every one of those would become a Jira ticket and a Slack message.

The dedup step creates a fingerprint for each alert using a combination of fields: rule ID, agent name, username, source IP, command, file path, and so on. If the same fingerprint arrives within **120 seconds**, it's dropped. The count of suppressed duplicates is attached to the next alert that gets through, so the responder can see "this happened 14 times in the last two minutes."

The window is fixed, not sliding — it doesn't reset on each new duplicate. That detail matters during sustained attacks.

![Suppressed duplicate count in the audit sheet](assets/soc-suppressed-count.png)

---

### Threat Intel Enrichment

For each alert, the pipeline looks up any indicators it found:

| What | Where |
|---|---|
| Public IP addresses | AbuseIPDB and VirusTotal |
| File hashes (SHA-256, SHA-1, or MD5) | VirusTotal |
| Domains | VirusTotal |
| URLs | VirusTotal |

Private IPs (10.x.x.x, 192.168.x.x, etc.), loopback, link-local, and documentation ranges are skipped — there's no point sending those to a public threat intel service.

The results are stored on the alert. If a lookup fails (VirusTotal returns a rate-limit error, for example), that's recorded too so nothing silently disappears.

---

### The Gate: Who Gets to See the AI

Not every alert gets sent to the AI. That would be slow and expensive. The gate decides which alerts deserve it.

An alert passes the gate if **any** of these are true:

- The Wazuh rule severity is 7 or above (out of 15)
- The rule ID is on a manually maintained escalation list
- The alert maps to a specific MITRE ATT&CK technique (T1110 brute force, T1003 credential dumping, T1021 remote services, T1078 valid accounts)
- A threat intel lookup came back malicious (AbuseIPDB confidence ≥ 50, or VirusTotal flagged by 3 or more engines)

Anything that doesn't meet these criteria is written to the audit sheet with the label `below_gate` and a note explaining why. It doesn't disappear — it's just handled without the AI step.

---

### AI Triage

Alerts that pass the gate go to a language model with the cleaned-up alert data. The model returns a structured response:

- **Verdict:** `true_positive`, `false_positive`, or `needs_review`
- **Confidence:** how sure it is
- **Evidence:** which fields led to the verdict
- **Justification:** a short explanation in plain language
- **Primary driver:** what the main indicator of concern was
- **Suggested action:** what to do next
- **Investigation query:** a ready-made search query for further investigation

If the model returns something unexpected — garbled output, missing fields, a verdict it invented — the alert automatically becomes `needs_review`. Nothing is ever silently lost.

![AI verdict output for a true positive alert](assets/soc-ai-output.png)

---

### The Verdict Floor (Safety Rule)

The AI can mark an alert as a false positive. But if the alert has a Wazuh severity of 12 or above, or the threat intel came back malicious, or it's on the escalation list — the pipeline overrides the AI's verdict and raises it to `needs_review`.

The reasoning: a model should never be able to wave through a high-severity alert on its own. A human has to look at it. The floor is a hard rule, not a recommendation.

---

### Routing and Notification

- `true_positive` and `needs_review` → Slack message + Jira ticket + audit row
- `false_positive` → audit row only

![Slack notification for a true positive](assets/soc-slack-notify.png)

The Slack message includes the AI's verdict, confidence, justification, suggested action, and investigation query. The responder has everything they need without opening another tool.

---

### Audit Log

Every alert — escalated or not — writes one row to a Google Sheet. Columns include the timestamp, outcome, rule details, agent name, indicators found, enrichment results, AI verdict, and suppressed duplicate count.

This makes the whole system auditable. You can look back and see exactly what happened to every alert.

![Alert logged in the audit sheet](assets/soc-logged.png)

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
