---
title: PCAP Analysis & Phishing Investigation
category: Investigation
date: Oct 7, 2026
summary: How I take a suspicious email and a packet capture and work out whether someone was phished, using tshark and email headers.
tags: Wireshark, tcpdump, PCAP, Phishing
---

## Scenario
A user forwards an email that "looks off". It says their account will be suspended unless they log in now. A capture from their machine covers the time they were online.

Two questions, in this order:

1. Is the email actually malicious?
2. Did the user click, and did anything leave their machine?

<!-- ADD: one line on where your sample came from (your own lab email, a training PCAP, etc.) -->

## Tools and approach
I start with the email, because it tells me what to look for in the capture. Then I go to the packets.

**Step 1: the email headers.** The display name lies easily. The headers don't.

- Does `From` match `Return-Path` and `Reply-To`? A bank that replies to a free webmail address is not a bank.
- What do SPF, DKIM and DMARC say in `Authentication-Results`? Fails are a strong hint.
- Where does the link really go? I hover or view the source, because the text and the actual `href` are often different.

**Step 2: the capture.** Rather than scrolling through thousands of packets, I ask narrow questions.

```bash
# What is in this capture at all?
tshark -r capture.pcap -q -z io,phs

# Every domain the machine looked up
tshark -r capture.pcap -Y "dns.flags.response==0" \
  -T fields -e frame.time -e ip.src -e dns.qry.name

# Web requests: where, what, and using which browser
tshark -r capture.pcap -Y "http.request" \
  -T fields -e ip.src -e http.host -e http.request.uri -e http.user_agent

# Anything sent out with a form POST (this is where stolen passwords go)
tshark -r capture.pcap -Y "http.request.method==POST"

# HTTPS sites, even when the content is encrypted
tshark -r capture.pcap -Y "tls.handshake.type==1" \
  -T fields -e ip.dst -e tls.handshake.extensions_server_name
```

The last one is the useful trick. HTTPS hides the content, but the site name is still visible in the handshake.

## Findings
The pattern I look for is a short story told in order:

- The phishing domain shows up in DNS lookups right after the email arrived. That means a click.
- A GET to the fake login page, followed by a POST. That means the user typed something in.
- The POST goes to a domain that has nothing to do with the brand in the email.

<!-- ADD: your real observations with timestamps, e.g. "10:42:07 DNS lookup for ... / 10:42:09 POST to ..." -->

## Indicators of compromise
Always defanged, so nobody clicks them by accident.

| Type | Value | Notes |
|---|---|---|
| Domain | <!-- ADD, e.g. login-update[.]example --> | The lookalike site the link pointed to |
| IP | <!-- ADD --> | Where that domain resolved |
| Sender | <!-- ADD --> | The real `Return-Path`, not the display name |
| URL | <!-- ADD, e.g. hxxps://... --> | Full link from the email body |

## Verdict and next steps
If the capture shows the POST, I'd call it a **credential-harvesting phish with a confirmed click**, not just a suspicious email. That changes the response:

1. **Reset the user's password** and kill active sessions. This comes first because the credentials are already gone.
2. **Block** the domain and IP at the DNS or proxy layer.
3. **Search for other victims:** who else looked up that domain? One DNS query across the logs answers it.
4. **Pull the email** from every other mailbox it reached.
5. **Tell the user**, kindly. Nobody should feel stupid for clicking. The email was built to work.

If there is no POST, it is still a phish, but a blocked one. Same blocks, no reset.
