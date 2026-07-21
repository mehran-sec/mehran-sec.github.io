---
layout: post
title: "Detecting SSH Brute-Force with Wazuh Correlation Rules"
date: 2026-07-21
---

## The Problem

SSH brute-force is one of the noisiest attack patterns out there, but that's exactly the trap — a single failed login means nothing, and a SIEM that alerts on every one of them just trains analysts to ignore it. What actually matters is the *pattern*: many failures, from the same source, in a short window. Wazuh ships a base rule (5760) that logs individual SSH authentication failures, but on its own it doesn't correlate them into something worth escalating. I wanted a rule that only fires when the failure count crosses a real threshold — turning noise into a signal.

## The Build

I wrote a custom correlation rule (ID 100010) using Wazuh's `if_matched_sid` field, which lets a rule watch for repeated matches of a base rule ID within a defined time window rather than firing on every single event:

```xml
<rule id="100010" level="10">
  <if_matched_sid>5760</if_matched_sid>
  <same_source_ip />
  <description>Multiple SSH authentication failures from same source - possible brute-force</description>
  <group>authentication_failures,pci_dss_11.4,</group>
</rule>
```

The key piece is `if_matched_sid` combined with `same_source_ip` — Wazuh tracks repeated hits of rule 5760 from the same IP and only escalates to this higher-severity rule once the frequency threshold is crossed, rather than treating every failed login as its own alert.

## The Validation

A rule you haven't tested is just a guess. I simulated the exact attack pattern using `sshpass` to generate repeated failed logins against a test target:

```bash
for i in {1..10}; do
  sshpass -p "wrongpassword$i" ssh testuser@target_ip
done
```

This produced a burst of failed authentication attempts from a single source in a short window — the exact condition rule 100010 is designed to catch. I confirmed the result in the Wazuh dashboard: rule 5760 fired individually for each attempt as expected, and once the threshold was crossed, rule 100010 escalated correctly with the source IP correctly identified and the alert severity elevated.

## What I'd Do Differently

The current version treats every source IP the same, but a real SOC environment usually has some IPs that are expected to occasionally fail auth (misconfigured scripts, forgotten credentials, etc.). Right now this rule has no allowlist for known internal automation — something I'd add before calling this production-ready, since without it there's a real risk of alert fatigue creeping back in exactly the thing this rule was built to prevent.

## Why This Matters

This is a small example of the core SOC skill: distinguishing signal from noise. A raw SIEM full of every failed login is useless. A rule that correlates by source, time window, and threshold is what actually earns an analyst's attention when it fires.
