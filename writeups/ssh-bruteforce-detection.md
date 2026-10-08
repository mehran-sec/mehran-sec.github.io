---
title: Detecting SSH Brute-Force with Wazuh
category: Detection
date: Oct 7, 2026
summary: A custom Wazuh rule that turns a pile of failed SSH logins into one clear alert, tested with a simulated attack in my home lab.
tags: Wazuh, Detection Rules, SSH, Linux
---

## Objective
One failed SSH login means nothing. Fifty in a minute from the same address means someone is guessing passwords. Wazuh logs every single failure, but out of the box you get a stream of small alerts and nothing that says "this is an attack". I wanted one alert that does.

## Lab setup
Everything runs on my Lenovo T490 (Ubuntu, 16 GB RAM).

- **Wazuh manager:** v4.14.5, single-node, running in Docker
- **Target:** a separate Linux machine with `sshd` and the Wazuh agent
- **Attacker:** the T490 itself, running Hydra against the target

The target has to be a different machine. I learned the hard way that the Wazuh agent and manager refuse to live on the same OS.

<!-- CHECK: confirm what the target machine actually is (VM or physical) and edit the line above -->

## Simulating the attack
I used **Hydra**, a popular password-guessing tool. Give it a username and a wordlist, and it hammers the SSH login with one password after another, much like a real bot would.

```bash
hydra -l fakeuser -P passwords.txt -t 4 ssh://<TARGET_IP>
```

- `-l fakeuser` is the account being attacked
- `-P passwords.txt` is the list of passwords to try
- `-t 4` runs four attempts at a time, which is about the most SSH tolerates before it starts dropping connections

![Hydra running against the SSH target](assets/ssh-hydra-attack.png)

On the target, every attempt leaves a line like this in `/var/log/auth.log`:

```
sshd[1234]: Failed password for invalid user fakeuser from <ATTACKER_IP> port 51514 ssh2
```

Wazuh already knows this line. It matches built-in rule **5760** ("authentication failed") and raises a low-level alert every time. Hydra tries passwords quickly, so the alerts pile up fast, which is exactly the noise problem.

## Detection logic
My rule, **100010**, doesn't read logs itself. It watches for rule 5760 and fires only when it has seen it enough times, fast enough, from the same place.

```xml
<group name="local,sshd,authentication_failures,">
  <rule id="100010" level="10" frequency="6" timeframe="60">
    <if_matched_sid>5760</if_matched_sid>
    <same_source_ip />
    <description>SSH brute-force: repeated failed logins from one source</description>
    <mitre>
      <id>T1110.001</id>
    </mitre>
  </rule>
</group>
```

- **`if_matched_sid` 5760:** build on the existing failure rule instead of re-parsing logs.
- **`frequency` and `timeframe`:** 6 failures inside 60 seconds. A real person mistyping a password rarely does that. Hydra does it in a second.
- **`same_source_ip`:** keeps two unrelated people's typos from adding up to a fake attack.
- **Level 10:** high enough that it stands out from the level 5 noise.

<!-- CHECK: replace frequency / timeframe / level with the exact values in your real rule 100010 -->

I edit the rule file straight through the Docker volume (`.../single-node_wazuh_etc/_data/`) instead of exec'ing into the container. It is faster, and changes survive restarts.

## Results
Running Hydra produced the stream of 5760 alerts, then one **rule 100010** alert at level 10 once the threshold was crossed. Here it is in the Wazuh dashboard:

![Wazuh dashboard showing rule 100010 firing](assets/ssh-wazuh-alert.png)

## MITRE ATT&CK mapping

| Technique | ID | Why it applies |
|---|---|---|
| Brute Force: Password Guessing | T1110.001 | The simulation tries one wrong password after another against a single account, which is guessing. |

## What I'd improve
- **Tune the threshold.** Six in a minute works in a quiet lab. On a real server, an admin with a flaky password manager could trip it, so I'd add an allowlist for known admin IPs.
- **Slow attacks slip through.** Someone guessing one password every two minutes stays under the window. A second rule with a longer timeframe would catch that.
- **Spraying slips through too.** `same_source_ip` means a botnet using a different address per attempt looks like harmless one-offs. Grouping by target account would help.
- **Respond, not just alert.** Next I want to test Wazuh active response to block the source IP automatically, and then feed this alert into my n8n pipeline for enrichment.
