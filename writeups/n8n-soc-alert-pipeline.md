---
title: Building an AI-Assisted SOC Alert Pipeline in n8n
category: Automation
date: Oct 8, 2026
summary: How I wired Wazuh, threat intel lookups and an LLM together in n8n so every alert arrives with context and a verdict, plus the things that broke along the way.
tags: n8n, Wazuh, SOAR, Automation, LLM
---

## The problem
A SOC analyst's first five minutes with any alert are the same. Copy the IP. Paste it into AbuseIPDB. Paste it into VirusTotal. Read a bit. Decide. Do that a hundred times a day and the boring part eats the thinking part.

I wanted the machine to do those five minutes, so a human only sees the alert once it already has context.

## How it flows  
![Architecture of the n8n SOC alert pipeline](assets/n8n-architechture.png)

In plain words: Wazuh raises an alert, n8n checks the IP against threat intel, an LLM writes a verdict, and the result lands in Slack (and in Jira if it is serious).

Each step does one small job. That is on purpose: when something breaks, I know which box to open.

### What each piece does
- **Wazuh** sends alerts to an n8n webhook as they happen.
- **Custom Script** A custom python script ships logs toward n8n webhook
- **Webhook** Recieves  alerts from  python script
- **Normalization and Deduplication** Alerts gets Normalized into a fixed fields and Duplicate alerts gets dropped 
- **AbuseIPDB and VirusTotal** answer one question: has anyone seen this address doing bad things?
- **Scoring Logic** The most important and complex part of this project is the scring logic that calculates a score based on IOCs and other 
other things like wazuh rule level and the alerts that gets scored higher (>20) gets analysed with ai 
- **The LLM** (via Groq) gets the alert and the lookup results, and returns a short structured verdict: what happened, how worried to be, what to do next.
- **A Switch node** reads the severity in that verdict and decides where it goes.
- **Slack and Jira** are where a human actually sees it.

The LLM never closes or deletes anything. It writes a recommendation and a person decides.

## n8n Workflow 
![The n8n workflow canvas](assets/n8n-workflow.png)

This is the finished workflow on the n8n canvas, from the webhook on the left to Slack and Jira on the right:



## Results

![Slack Notification](assets/Slack_notification.png)

The team gets notified when an alert is true positive along with Suggested action according to NIST Picerl and investigation query for further investigation.



## What broke (and what it taught me)
This is the part I learned the most from.

**The LLM kept breaking my parser.** I asked for JSON, and the model wrapped it in markdown code fences. My Structured Output Parser choked on the fences. Fix: tell the model explicitly to return raw JSON only, and strip fences before parsing as a safety net.

**Groq rate limits arrived early.** The token-per-minute limit counts `max_tokens` up front, not just what the model actually uses. Setting it high "to be safe" burned my quota on requests that returned a few lines. Fix: set `max_tokens` close to the real size of the answer.

**Jira rejected the ticket for a field that looked right.** The priority field wants a numeric ID, not the word "High". Fix: map severity to the ID once, in one place.

**The Switch node was fussy.** Rules mode wants the value, the operator and the comparison set up in a precise shape. Getting it right once and reusing it saved a lot of guessing.


## What I'd improve
- **Cache IP lookups.** The same noisy address shouldn't cost an API call every time.
- **Keep a human in the loop for anything severe.** Right now the LLM recommends. I'd like an approve button in Slack before any action runs.
- **Track when the LLM is wrong.** If analysts keep overriding its verdicts, that is data I should be reading.
- **Feed it more context,** like asset info and previous alerts for the same host, so its verdicts depend less on the IP alone.
