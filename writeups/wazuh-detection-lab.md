---
title: Wazuh Detection Engineering
category: Detection
date: Oct 11, 2026
summary: Custom Wazuh detection rules managed as code in Git, with documented test cases, automated CI checks and a scripted, rollback-safe deployment, built and verified in my home lab.
tags: Wazuh, Detection Engineering, Detection as Code, GitHub Actions, MITRE ATT&CK
---

## Objective
Writing one detection rule is easy. Keeping a set of rules correct, tested and deployable is the real job of a detection engineer. I wanted to work the way a security team does: every rule starts from a written requirement, lives in Git, has test cases, passes automated checks, and is deployed with a backup and a rollback.

This project is that workflow for Wazuh. I wrote custom rules for five attack behaviours, showed what Wazuh's default rules gave me **before** each one and what I got **after**, and wrapped it all in a small detection-as-code pipeline.

Deployment is manual on purpose. I explain why in the last section.

## Lab setup
- **Wazuh:** v4.14.8, single-node (manager, indexer and dashboard on one host)
- **Endpoint:** an Ubuntu VM on the same laptop, running the Wazuh agent
- **Attacker:** kali linux , attacking only the VM that I own

![Lab architecture](assets/ss_architecture.png)

I started this lab with Wazuh in Docker and later moved to a native install. Rule deployment got simpler: the rules folder is just a folder on disk, with no container to copy files into.

## The detection-as-code workflow
Every rule lives in a Git repository:

```
wazuh-detection-engineering/
├── rules/      # one XML file per detection rule.
├── tests/      # real log lines from endpoints before and afer the custom rules 
├── scripts/    # deploy.sh a script to deploy rule 
├── docs/       # detection requirements 
└── .github/workflows/   # CI checks
```

A rule goes through the same steps every time:

1. **Requirement.** A short document: the threat, the data source, the logic, the MITRE ATT&CK technique, expected false positives and known gaps.
2. **Rule.** Written in `rules/`. Custom rule IDs stay in the 100000-120000 range, and the default Wazuh ruleset is never edited.
3. **Test cases.** Real log lines (from end points ) saved in `tests/`.
4. **Deploy.** `scripts/deploy.sh` does the following:
   - validates the XML
   - backs up the current rules
   - copies in only my numbered rule files with the right owner and permissions
   - runs Wazuh's own config test (`wazuh-analysisd -t`)
   - restores the backup automatically if that test fails
   - restarts the manager and checks that it is running
5. **Test.** `wazuh-logtest` with the saved log lines, then a real attack against the VM.
6. **Commit and push.** CI then checks the rule files (explained below).

....

## The detections

| # | Rule ID | Detection | MITRE ATT&CK | Level |
|---|---|---|---|---|
| 1 | 100100 | SSH password-guessing burst | T1110.001 | 10 |
| 2 | 100110 | Root shell opened through sudo | T1548.003 | 8 |
| 3 | TODO | New privileged user account created | T1136.001 | TODO |
| 4 | TODO | SSH key or cron job added for persistence | T1098.004 / T1053.003 | TODO |
| 5 | TODO | Reverse-shell style command executed | T1059.004 | TODO |

## 1. SSH password-guessing burst (100100)

**Goal:** one failed login is noise, but several from one address in a minute is an attack.

**Attack:** Hydra from the laptop against the VM:

```bash
hydra -l testuser -P passwords.txt ssh://<VM_IP> -t 4
```

**Before.** With only default rules, every failed attempt became its own level 5 alert (rule `5760`, "sshd: authentication failed"). The only level 10 alert came from a generic syslog rule (`2502`, "User missed the password more than one time"). Nothing told me this was a brute-force attempt against SSH.

![Default rules before the custom SSH rule](<assets/SSH_Auth_Failed _Alert.png>)

**The rule:**

```xml
<group name="local,sshd,authentication_failures,">
  <rule id="100100" level="10" frequency="5" timeframe="60">
    <if_matched_sid>5760</if_matched_sid>
    <same_source_ip />
    <description>sshd: 5+ failed SSH password attempts from
     the same IP within 60s (custom, lower threshold)</description>
    <mitre>
      <id>T1110.001</id>
    </mitre>
  </rule>
</group>
```


**After.** The same attack now produces one dedicated level 10 alert, rule `100100`, tagged T1110.001.


![Rule 100100 firing after the attack](<assets/SSH Brute force Alert Custom.png>)

**Known gaps:** a slow attack (fewer than five attempts a minute) and an attack spread across many source addresses are both missed. An admin who mistypes a password repeatedly can trigger it. All of this is in the detection's requirement document.

I covered an earlier version of this SSH detection in [Detecting SSH Brute-Force with Wazuh](writeups.html#ssh-bruteforce-detection).


## 2. Root shell opened through sudo (100110)

**Goal:** `sudo apt update` and `sudo su` are very different events, but Wazuh treats them the same.

**Attack (on the VM):**

```bash
sudo whoami      # normal use, should not trigger the new rule
sudo su -        # root shell
sudo bash        # root shell
sudo -i          # root shell
```

**Before.** Every sudo to root produced the same generic alert: rule `5402`, "Successful sudo to ROOT executed", at level 3, plus PAM session noise (`5501` and `5502`). A harmless command and a full root shell looked identical.


![Genric sudo alert before the custom rule](<assets/Use of sudo Before Custom.png>)

**The rule:**

```xml
<group name="local,sudo,privilege_escalation,">
  <rule id="100110" level="8">
    <if_sid>5402</if_sid>
    <regex type="pcre2">COMMAND=(?:/usr)?/s?bin/(?:su|bash|sh|dash|zsh|ksh|fish)(?:\s|$)</regex>
    <description>sudo: root shell opened via sudo (su/bash/sh) - possible privilege escalation</description>
    <mitre>
      <id>T1548.003</id>
    </mitre>
  </rule>
</group>
```

**After.** Root shells now raise their own level 8 alert with the T1548 tag. `sudo whoami` still produces only the generic level 3 alert.


![Rule 10110 firing for a root shell](<assets/Use of Sudo after Custom.png>)

**Known false positives:** admins who legitimately use `sudo -i` or `sudo su`, and `sudo bash -c "..."` or `sudo sh -c "..."` used for ordinary tasks. Tuning would mean excluding known admin accounts.



## 3. SSH key or cron job added for persistence

**TODO:** write this rule, then fill in the sections below.

- **Goal:** detect changes to `authorized_keys` or to cron files, which attackers use to stay on a host.
- **Attack:** add a test key and a test cron job on the VM.
- **Before:** `![TODO](assets/ss_persist_before.png)`
- **Rule:** TODO (XML here)
- **After:** `![TODO](assets/ss_persist_after.png)`
- **Known false positives:** TODO

## 4. Reverse-shell style command executed

**TODO:** write this rule, then fill in the sections below.

- **Goal:** detect command patterns used for reverse shells.
- **Attack:** a harmless test command with a reverse-shell pattern against a listener on my own machine.
- **Before:** `![TODO](assets/ss_revshell_before.png)`
- **Rule:** TODO (XML here)
- **After:** `![TODO](assets/ss_revshell_after.png)`
- **Known false positives:** TODO

## How the CI pipeline works
Every push to `main` starts a GitHub Actions workflow. It runs on a GitHub-hosted runner, so it never touches my lab machine. The workflow is defined in `.github/workflows/detection-ci.yml`:

```yaml
on:
  push:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install XML validator
        run: sudo apt-get update && sudo apt-get install -y libxml2-utils
      - name: Validate XML
        run: |
          for f in rules/*.xml; do xmllint --noout "$f"; done
      # ...rule ID and MITRE checks follow
```

Three checks run in order:

1. **Valid XML.** Every rule file must parse. A missing closing tag would stop Wazuh from loading its rules.
2. **Unique IDs in range.** No duplicate rule IDs, and every ID must be in the custom range (100000-120000), so a custom rule can never collide with a default one.
3. **MITRE mapping.** Every rule file must contain a `mitre` tag, so no detection ships without an ATT&CK technique.

A green tick means the files are well-formed and follow my conventions. A red cross blocks me from treating the change as finished.

![Passing CI run](assets/ss_ci_pass.png)

To prove the gate works, I pushed a change with a duplicate rule ID on purpose. CI failed and named the duplicate:

![Failing CI run caused by a duplicate rule ID](assets/ss_ci_fail.png)

**What CI does not prove.** It checks that the files are well-formed, not that a rule detects anything. That is what the saved test logs, `wazuh-logtest` and the real attacks are for, and I run them myself. CI is one safety net, not the whole answer.

## Why deployment is manual
After CI passes, I deploy by running `scripts/deploy.sh` myself. That is a deliberate choice. Automatic deployment needs a GitHub runner on the same machine as my Wazuh manager, and that runner would have root-level access to my SIEM host. For a home lab I decided the safer option was to keep a human in the loop.

## Results and lessons
- **Default rules are noisy and context-free.** Wazuh sees every sudo as level 3 whether it is `ls` or a root shell. Most of the work was adding context, not writing more rules.
- **Frequency rules need repeated events to test.** In `wazuh-logtest`, a single pasted line never triggers a threshold rule. I had to paste the log line several times in the same session.
- **Names matter.** My VM's hostname matched my laptop's. The Wazuh manager refused to enrol an agent with the same name as the manager's own host, until I enrolled it under a different name.
- **File ownership matters.** Rule files must be owned by `root:wazuh` with mode 660, or Wazuh may not read them.
- **Test before you restart.** The `-t` config test catches broken rules before the manager restarts with them.

**Limits:** I have one Wazuh manager, so it is both staging and production. I commit straight to `main` with no second reviewer, and the log tests are run by hand.

## What I would improve
- **A runner for continuous deployment (CD).** Run a self-hosted GitHub runner on the Wazuh host, as a dedicated low-privilege user. The deployment script would be owned by root, and the runner's sudo permission would allow that one script only, never `rsync` or a shell. A deploy job would run only after the CI checks pass, and only on pushes to `main`, never on pull requests or forks. The repository would stay private.
- **Automated detection tests in CI.** Run the saved log lines through Wazuh in a test environment and fail the build if the expected rule does not fire.
- **Branches and pull requests,** so every change is reviewed before it reaches `main`.
- **A separate staging Wazuh manager** to test changes before production.
- **An ATT&CK coverage map** showing which techniques my rules cover and which they do not.
- **Connect it to alert triage.** These alerts could feed the enrichment pipeline from my [n8n SOC alert pipeline](writeups.html#n8n-soc-alert-pipeline) project.

The full repository is on GitHub: [wazuh-detection-engineering](https://github.com/mehran-sec/wazuh-detection-engineering). <!-- TODO: the repo must be public and free of secrets before this link goes live -->
