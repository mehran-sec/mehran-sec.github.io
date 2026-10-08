/**
 * chatbot.js — Mehran AI Portfolio Assistant Widget with Ghost Mascot
 * Self-contained vanilla JS widget matching dark cyber portfolio theme.
 * Features animated cursor-tracking Ghost Buddy launcher + full chat capabilities.
 */

(function () {
  'use strict';

  // Configurable backend URL
  // In local dev (localhost/127.0.0.1), connects to http://localhost:8000
  // In production (GitHub Pages), connects to your deployed backend URL
  //const PRODUCTION_BACKEND_URL = window.MEHRAN_AI_BACKEND_URL || "https://mehran-ai-backend.onrender.com";
   const PRODUCTION_BACKEND_URL = window.MEHRAN_AI_BACKEND_URL || "https://emit-clay-baggy.ngrok-free.dev";
  const IS_LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const BACKEND_URL = IS_LOCAL ? "http://localhost:8000" : PRODUCTION_BACKEND_URL;

  // 4 Suggested Questions for recruiters & visitors
  const SUGGESTED_QUESTIONS = [
    "What does Mehran know about SOC?",
    "Tell me about his Wazuh project.",
    "Is Mehran a cute boy? 👀",
    "Is Mehran actually a hacker? 😎?"
  ];

  // Built-in Markdown Formatter
  function renderMarkdown(rawText) {
    if (!rawText) return '';

    // If marked.js is loaded on page, use it
    if (typeof window.marked !== 'undefined' && typeof window.marked.parse === 'function') {
      try {
        return window.marked.parse(rawText);
      } catch (e) {
        console.warn('[Mehran AI] marked.js error, falling back to internal parser:', e);
      }
    }

    // Built-in lightweight Markdown parser
    const lines = rawText.split('\n');
    const html = [];
    let inList = false;
    let inOrderedList = false;
    let inCodeBlock = false;
    let codeBuffer = [];

    function formatInline(str) {
      let out = str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
      out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
      out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

      return out;
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          html.push('<pre><code>' + formatInline(codeBuffer.join('\n')) + '</code></pre>');
          codeBuffer = [];
          inCodeBlock = false;
        } else {
          if (inList) { html.push('</ul>'); inList = false; }
          if (inOrderedList) { html.push('</ol>'); inOrderedList = false; }
          inCodeBlock = true;
        }
        continue;
      }

      if (inCodeBlock) {
        codeBuffer.push(line);
        continue;
      }

      const trimmed = line.trim();

      if (!trimmed) {
        if (inList) { html.push('</ul>'); inList = false; }
        if (inOrderedList) { html.push('</ol>'); inOrderedList = false; }
        continue;
      }

      if (trimmed.startsWith('### ')) {
        if (inList) { html.push('</ul>'); inList = false; }
        if (inOrderedList) { html.push('</ol>'); inOrderedList = false; }
        html.push('<h4 class="ai-heading">' + formatInline(trimmed.slice(4)) + '</h4>');
        continue;
      }
      if (trimmed.startsWith('## ')) {
        if (inList) { html.push('</ul>'); inList = false; }
        if (inOrderedList) { html.push('</ol>'); inOrderedList = false; }
        html.push('<h3 class="ai-heading">' + formatInline(trimmed.slice(3)) + '</h3>');
        continue;
      }
      if (trimmed.startsWith('# ')) {
        if (inList) { html.push('</ul>'); inList = false; }
        if (inOrderedList) { html.push('</ol>'); inOrderedList = false; }
        html.push('<h3 class="ai-heading">' + formatInline(trimmed.slice(2)) + '</h3>');
        continue;
      }

      const bulletMatch = line.match(/^\s*[-*]\s+(.*)$/);
      if (bulletMatch) {
        if (inOrderedList) { html.push('</ol>'); inOrderedList = false; }
        if (!inList) { html.push('<ul>'); inList = true; }
        html.push('<li>' + formatInline(bulletMatch[1]) + '</li>');
        continue;
      }

      const numMatch = line.match(/^\s*\d+\.\s+(.*)$/);
      if (numMatch) {
        if (inList) { html.push('</ul>'); inList = false; }
        if (!inOrderedList) { html.push('<ol>'); inOrderedList = true; }
        html.push('<li>' + formatInline(numMatch[1]) + '</li>');
        continue;
      }

      if (inList) { html.push('</ul>'); inList = false; }
      if (inOrderedList) { html.push('</ol>'); inOrderedList = false; }
      html.push('<p>' + formatInline(trimmed) + '</p>');
    }

    if (inList) html.push('</ul>');
    if (inOrderedList) html.push('</ol>');
    if (inCodeBlock) html.push('<pre><code>' + formatInline(codeBuffer.join('\n')) + '</code></pre>');

    return html.join('');
  }

  // Inject widget CSS styles
  const styles = `
    /* Widget Master Container */
    #mehran-ai-widget {
      position: fixed;
      bottom: 1rem;
      right: 1.25rem;
      z-index: 9999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      --ai-bg: #0B0B0F;
      --ai-surface: #14141A;
      --ai-elevated: #1C1C24;
      --ai-text-primary: #EDEDEB;
      --ai-text-secondary: #9B9B9B;
      --ai-text-muted: #7C7C7C;
      --ai-accent: #A8C66C;
      --ai-accent-hover: #BDDA84;
      --ai-border: #252530;
      --ai-danger: #E55B5B;
      --ai-radius: 6px;
    }

    /* Mascot Launcher Wrap */
    #buddy-launcher-wrap {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
      cursor: pointer;
      user-select: none;
    }

    /* Floating Pill Badge */
    .buddy-ask-tag {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      background: var(--ai-surface);
      color: var(--ai-text-primary);
      border: 1px solid var(--ai-border);
      border-radius: 9999px;
      padding: 0.38rem 0.85rem;
      font-size: 0.8125rem;
      font-weight: 600;
      box-shadow: 0 4px 18px rgba(0, 0, 0, 0.45);
      transition: all 0.2s ease;
      cursor: pointer;
    }
    #buddy-launcher-wrap:hover .buddy-ask-tag {
      border-color: var(--ai-accent);
      color: var(--ai-accent);
      transform: translateY(-2px);
    }
    .mehran-ai-sparkle {
      color: var(--ai-accent);
      font-size: 0.95rem;
      line-height: 1;
    }

    /* Mascot Art & Geometry */
    #buddy {
      /* theme tokens */
      --ghost-body:    #ffffff;
      --ghost-outline: #0b1020;
      --ghost-hem:     #d9efff;
      --ghost-blush:   rgba(168, 198, 108, 0.55);
      --ghost-eye:     #0b1020;
      --ghost-shield:  #A8C66C;

      width: 108px;
      height: 124px;
      cursor: pointer;
      position: relative;
      -webkit-tap-highlight-color: transparent;
      filter: drop-shadow(0 6px 16px rgba(0,0,0,0.4));
      transition: transform 0.35s ease;
    }
    #buddy-launcher-wrap:hover #buddy {
      transform: scale(1.03);
    }
    #buddy svg { width: 100%; height: 100%; overflow: visible; display: block; }
    #buddy:focus-visible { outline: 3px solid var(--ai-accent); outline-offset: 6px; border-radius: 16px; }

    /* --- layers: #float (css bob) > #lean (JS tilt) > #sway (css sway) > art --- */
    #buddy #float { animation: bd-float 4.5s ease-in-out infinite; }
    #buddy #lean  { transform-origin: 100px 200px; }
    #buddy #sway  { transform-origin: 100px 200px; animation: bd-sway 5s ease-in-out infinite; }
    #buddy .shadow { transform-box: fill-box; transform-origin: center; animation: bd-shadow 4.5s ease-in-out infinite; }

    /* --- eyes: .eye (blink) > .eye-look (JS tracking) > .eye-shape (mood scale) --- */
    #buddy .eye { transform-box: fill-box; transform-origin: center; animation: bd-blink 5.5s infinite; }
    #buddy .eye.right { animation-delay: .05s; }
    #buddy .eye-shape { transform-box: fill-box; transform-origin: center; transition: transform .25s ease; }
    #buddy .shine { transition: opacity .2s; }

    /* --- face / extras --- */
    #buddy .blush { transform-box: fill-box; transform-origin: center; transition: transform .25s ease; }
    #buddy #mouth { transition: opacity .2s; }

    /* --- arms --- */
    #buddy .arm { transform-origin: 46px 86px; transition: transform .35s ease; }

    /* --- shield (guard mood) --- */
    #buddy #shield { transform-box: fill-box; transform-origin: center; transform: scale(0);
                     transition: transform .35s cubic-bezier(.3,1.6,.5,1); }

    /* --- zzz (sleepy mood) --- */
    #buddy .zzz text { opacity: 0; font: 700 15px system-ui, sans-serif; fill: #A8C66C;
                       transform-box: fill-box; transform-origin: center; }

    /* ===== moods ===== */
    #buddy[data-mood="happy"] .blush { transform: scale(1.3); }
    #buddy[data-mood="happy"] .arm   { animation: bd-wave .5s ease-in-out 3; }

    #buddy[data-mood="alert"] .eye-shape { transform: scale(1.15); }
    #buddy[data-mood="alert"] .arm       { transform: rotate(22deg); }

    #buddy[data-mood="guard"] .eye-shape { transform: scaleY(.85); }
    #buddy[data-mood="guard"] .arm       { transform: rotate(24deg); }
    #buddy[data-mood="guard"] #shield    { transform: scale(1); }

    #buddy[data-mood="sleepy"] .eye       { animation: none; }
    #buddy[data-mood="sleepy"] .eye-shape { transform: scaleY(.1); }
    #buddy[data-mood="sleepy"] .shine     { opacity: 0; }
    #buddy[data-mood="sleepy"] .arm       { transform: rotate(-4deg); }
    #buddy[data-mood="sleepy"] #sway      { animation-duration: 8s; }
    #buddy[data-mood="sleepy"] .zzz text  { animation: bd-zzz 2.6s ease-out infinite; }
    #buddy[data-mood="sleepy"] .zzz text:nth-child(2) { animation-delay: .85s; }
    #buddy[data-mood="sleepy"] .zzz text:nth-child(3) { animation-delay: 1.7s; }

    /* --- speech bubble (disabled) --- */
    #buddy .buddy-bubble { display: none !important; }

    /* --- keyframes --- */
    @keyframes bd-float  { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
    @keyframes bd-shadow { 0%,100% { transform: scale(1);   opacity: .25; } 50% { transform: scale(.82); opacity: .12; } }
    @keyframes bd-sway   { 0%,100% { transform: rotate(-1.6deg) scaleY(1); } 50% { transform: rotate(1.6deg) scaleY(1.025); } }
    @keyframes bd-blink  { 0%,93%,100% { transform: scaleY(1); } 96% { transform: scaleY(.08); } }
    @keyframes bd-wave   { 0%,100% { transform: rotate(18deg); } 50% { transform: rotate(50deg); } }
    @keyframes bd-zzz    { 0% { opacity: 0; transform: translate(0,6px) scale(.7); }
                           30% { opacity: 1; }
                           100% { opacity: 0; transform: translate(8px,-14px) scale(1.1); } }

    /* Chat Panel Window */
    .mehran-ai-panel {
      display: none;
      flex-direction: column;
      position: absolute;
      bottom: 0;
      right: 0;
      width: 400px;
      max-width: calc(100vw - 2rem);
      height: 560px;
      max-height: calc(100vh - 4rem);
      background: var(--ai-surface);
      border: 1px solid var(--ai-border);
      border-radius: 8px;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.65);
      overflow: hidden;
      z-index: 10000;
      animation: mehranFadeIn 0.22s ease-out;
    }
    .mehran-ai-panel.open {
      display: flex;
    }

    @keyframes mehranFadeIn {
      from { opacity: 0; transform: translateY(12px) scale(0.97); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    /* Panel Header */
    .mehran-ai-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.85rem 1rem;
      background: var(--ai-elevated);
      border-bottom: 1px solid var(--ai-border);
    }
    .mehran-ai-title-wrap {
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
    }
    .mehran-ai-title {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--ai-text-primary);
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }
    .mehran-ai-subtitle {
      font-size: 0.75rem;
      color: var(--ai-text-muted);
      font-family: ui-monospace, monospace;
    }
    .mehran-ai-close {
      background: transparent;
      border: none;
      color: var(--ai-text-muted);
      cursor: pointer;
      font-size: 1.25rem;
      line-height: 1;
      padding: 0.25rem 0.5rem;
      border-radius: var(--ai-radius);
      transition: color 0.15s ease;
    }
    .mehran-ai-close:hover {
      color: var(--ai-text-primary);
    }

    /* Messages Area */
    .mehran-ai-messages {
      flex: 1;
      padding: 1rem;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
      background: var(--ai-bg);
      font-size: 0.875rem;
      line-height: 1.6;
    }
    .mehran-ai-messages::-webkit-scrollbar {
      width: 5px;
    }
    .mehran-ai-messages::-webkit-scrollbar-thumb {
      background: var(--ai-border);
      border-radius: 4px;
    }

    /* Message Bubbles */
    .mehran-msg {
      max-width: 90%;
      padding: 0.75rem 0.95rem;
      border-radius: var(--ai-radius);
      word-break: break-word;
    }
    .mehran-msg-bot {
      align-self: flex-start;
      background: var(--ai-surface);
      border: 1px solid var(--ai-border);
      color: var(--ai-text-primary);
    }

    .mehran-msg-bot p {
      margin: 0 0 0.55rem 0;
    }
    .mehran-msg-bot p:last-child {
      margin-bottom: 0;
    }
    .mehran-msg-bot h3, .mehran-msg-bot .ai-heading {
      font-size: 0.93rem;
      font-weight: 600;
      color: var(--ai-accent);
      margin: 0.75rem 0 0.35rem 0;
      border-bottom: 1px solid var(--ai-border);
      padding-bottom: 0.2rem;
    }
    .mehran-msg-bot h3:first-child, .mehran-msg-bot h4:first-child {
      margin-top: 0;
    }
    .mehran-msg-bot h4 {
      font-size: 0.88rem;
      font-weight: 600;
      color: var(--ai-accent);
      margin: 0.6rem 0 0.25rem 0;
    }
    .mehran-msg-bot ul, .mehran-msg-bot ol {
      margin: 0.35rem 0 0.6rem 1.15rem;
      padding: 0;
    }
    .mehran-msg-bot li {
      margin-bottom: 0.3rem;
      color: var(--ai-text-secondary);
      line-height: 1.5;
    }
    .mehran-msg-bot strong {
      color: var(--ai-text-primary);
      font-weight: 600;
    }
    .mehran-msg-bot a {
      color: var(--ai-accent);
      text-decoration: underline;
      text-underline-offset: 2px;
      word-break: break-all;
    }
    .mehran-msg-bot a:hover {
      color: var(--ai-accent-hover);
    }
    .mehran-msg-bot code {
      font-family: ui-monospace, monospace;
      font-size: 0.82em;
      background: var(--ai-elevated);
      padding: 0.15rem 0.35rem;
      border-radius: 3px;
      border: 1px solid var(--ai-border);
      color: var(--ai-accent);
    }
    .mehran-msg-bot pre {
      background: var(--ai-bg);
      border: 1px solid var(--ai-border);
      border-radius: 4px;
      padding: 0.5rem;
      overflow-x: auto;
      margin: 0.4rem 0;
    }

    .mehran-msg-user {
      align-self: flex-end;
      background: var(--ai-elevated);
      border: 1px solid rgba(168, 198, 108, 0.3);
      color: var(--ai-accent);
    }
    .mehran-msg-error {
      align-self: center;
      background: rgba(229, 91, 91, 0.1);
      border: 1px solid rgba(229, 91, 91, 0.3);
      color: var(--ai-danger);
      font-size: 0.8125rem;
      text-align: center;
      width: 90%;
    }

    /* Suggested Chips */
    .mehran-ai-suggestions {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      margin-top: 0.65rem;
    }
    .mehran-ai-chip {
      text-align: left;
      font-size: 0.78rem;
      padding: 0.45rem 0.65rem;
      background: var(--ai-surface);
      border: 1px solid var(--ai-border);
      border-radius: var(--ai-radius);
      color: var(--ai-text-secondary);
      cursor: pointer;
      transition: all 0.15s ease;
      font-family: ui-monospace, monospace;
    }
    .mehran-ai-chip:hover {
      border-color: var(--ai-accent);
      color: var(--ai-accent);
      background: var(--ai-elevated);
    }

    /* Animated Typing Dots */
    .mehran-typing {
      display: inline-flex;
      gap: 0.3rem;
      align-items: center;
      padding: 0.6rem 0.85rem;
    }
    .mehran-dot {
      width: 6px;
      height: 6px;
      background: var(--ai-accent);
      border-radius: 50%;
      animation: mehranPulse 1.2s infinite ease-in-out;
    }
    .mehran-dot:nth-child(2) { animation-delay: 0.2s; }
    .mehran-dot:nth-child(3) { animation-delay: 0.4s; }

    @keyframes mehranPulse {
      0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
      40% { opacity: 1; transform: scale(1.1); }
    }

    /* Footer Input Area */
    .mehran-ai-footer {
      padding: 0.75rem 1rem;
      background: var(--ai-surface);
      border-top: 1px solid var(--ai-border);
    }
    .mehran-ai-input-form {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .mehran-ai-input {
      flex: 1;
      background: var(--ai-bg);
      border: 1px solid var(--ai-border);
      color: var(--ai-text-primary);
      padding: 0.6rem 0.75rem;
      font-size: 0.875rem;
      border-radius: var(--ai-radius);
      outline: none;
      transition: border-color 0.15s ease;
    }
    .mehran-ai-input:focus {
      border-color: var(--ai-accent);
    }
    .mehran-ai-input::placeholder {
      color: var(--ai-text-muted);
    }
    .mehran-ai-send {
      background: var(--ai-accent);
      color: var(--ai-bg);
      border: none;
      padding: 0.6rem 0.85rem;
      font-size: 0.875rem;
      font-weight: 600;
      border-radius: var(--ai-radius);
      cursor: pointer;
      transition: background 0.15s ease, opacity 0.15s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .mehran-ai-send:hover:not(:disabled) {
      background: var(--ai-accent-hover);
    }
    .mehran-ai-send:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Mobile Responsive */
    @media (max-width: 600px) {
      #mehran-ai-widget {
        bottom: 0.75rem;
        right: 0.75rem;
      }
      #buddy {
        width: 84px;
        height: 98px;
      }
      .buddy-ask-tag {
        font-size: 0.75rem;
        padding: 0.3rem 0.7rem;
      }
      .mehran-ai-panel {
        width: calc(100vw - 1.5rem);
        height: calc(100vh - 3rem);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      #buddy *, #buddy { animation: none !important; transition: none !important; }
    }
  `;

  // Inject Styles
  const styleEl = document.createElement('style');
  styleEl.textContent = styles;
  document.head.appendChild(styleEl);

  // Build DOM Structure
  const widgetContainer = document.createElement('div');
  widgetContainer.id = 'mehran-ai-widget';

  widgetContainer.innerHTML = `
    <!-- Mascot Launcher Wrap -->
    <div id="buddy-launcher-wrap">
      <div class="buddy-ask-tag" id="buddy-ask-tag" aria-label="Open Mehran AI chat">
        <span class="mehran-ai-sparkle">✦</span>
        <span>Ask Mehran AI</span>
      </div>

      <div id="buddy" role="button" aria-label="Friendly Mehran AI ghost assistant. Click to chat." tabindex="0">
        <svg viewBox="0 0 200 230" aria-hidden="true">
          <defs>
            <clipPath id="bd-body-clip">
              <path d="M44 80C44 40 68 14 100 14C132 14 156 40 156 80C158 100 166 120 170 138C175 155 178 168 178 182C178 194 170 200 158 198C146 196 138 190 124 194C114 197 110 208 100 208C90 208 86 197 76 194C62 190 54 199 42 197C28 195 22 190 22 182C22 168 26 152 30 138C34 120 44 100 44 80Z"/>
            </clipPath>
          </defs>

          <!-- ground shadow -->
          <ellipse class="shadow" cx="100" cy="222" rx="42" ry="5" fill="#0b1020"/>

          <g id="float">
            <g id="lean">
              <g id="sway">

                <!-- body fill -->
                <path d="M44 80C44 40 68 14 100 14C132 14 156 40 156 80C158 100 166 120 170 138C175 155 178 168 178 182C178 194 170 200 158 198C146 196 138 190 124 194C114 197 110 208 100 208C90 208 86 197 76 194C62 190 54 199 42 197C28 195 22 190 22 182C22 168 26 152 30 138C34 120 44 100 44 80Z"
                      fill="var(--ghost-body)"/>
                <!-- hem shading -->
                <g clip-path="url(#bd-body-clip)">
                  <path d="M10 172C30 182 48 170 72 174C88 177 90 190 102 190C114 190 118 176 134 172C152 168 166 180 190 172V230H10Z"
                        fill="var(--ghost-hem)"/>
                </g>
                <!-- body outline -->
                <path d="M44 80C44 40 68 14 100 14C132 14 156 40 156 80C158 100 166 120 170 138C175 155 178 168 178 182C178 194 170 200 158 198C146 196 138 190 124 194C114 197 110 208 100 208C90 208 86 197 76 194C62 190 54 199 42 197C28 195 22 190 22 182C22 168 26 152 30 138C34 120 44 100 44 80Z"
                      fill="none" stroke="var(--ghost-outline)" stroke-width="4.5" stroke-linejoin="round"/>

                <!-- left arm -->
                <g class="arm left">
                  <path d="M46 84C30 92 10 100 8 116C6 130 16 138 28 136C36 134 40 128 44 122Z" fill="var(--ghost-body)"/>
                  <path d="M46 84C30 92 10 100 8 116C6 130 16 138 28 136C36 134 40 128 44 122"
                        fill="none" stroke="var(--ghost-outline)" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
                </g>
                <!-- right arm (mirror) -->
                <g transform="translate(200 0) scale(-1 1)">
                  <g class="arm right">
                    <path d="M46 84C30 92 10 100 8 116C6 130 16 138 28 136C36 134 40 128 44 122Z" fill="var(--ghost-body)"/>
                    <path d="M46 84C30 92 10 100 8 116C6 130 16 138 28 136C36 134 40 128 44 122"
                          fill="none" stroke="var(--ghost-outline)" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
                  </g>
                </g>

                <!-- face blush -->
                <ellipse class="blush" cx="62"  cy="89" rx="12" ry="6.5" fill="var(--ghost-blush)"/>
                <ellipse class="blush" cx="138" cy="89" rx="12" ry="6.5" fill="var(--ghost-blush)"/>

                <g class="eye left">
                  <g class="eye-look">
                    <ellipse class="eye-shape" cx="74" cy="67" rx="13" ry="16" fill="var(--ghost-eye)"/>
                    <circle  class="shine" cx="69" cy="62" r="4.6" fill="#fff"/>
                    <ellipse class="shine" cx="79" cy="76" rx="3" ry="1.7" fill="#d9efff"/>
                  </g>
                </g>
                <g class="eye right">
                  <g class="eye-look">
                    <ellipse class="eye-shape" cx="126" cy="67" rx="13" ry="16" fill="var(--ghost-eye)"/>
                    <circle  class="shine" cx="121" cy="62" r="4.6" fill="#fff"/>
                    <ellipse class="shine" cx="131" cy="76" rx="3" ry="1.7" fill="#d9efff"/>
                  </g>
                </g>

                <!-- mouth -->
                <path id="mouth" d="M92 80Q100 90 108 80" fill="none" stroke="var(--ghost-outline)"
                      stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>

                <!-- shield (guard mood) -->
                <g id="shield">
                  <path d="M100 132L118 138V152C118 164 110 170 100 174C90 170 82 164 82 152V138Z"
                        fill="var(--ghost-shield)" stroke="var(--ghost-outline)" stroke-width="3.5" stroke-linejoin="round"/>
                  <path d="M92 153l6 6 11-12" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
                </g>

                <!-- zzz (sleepy mood) -->
                <g class="zzz">
                  <text x="142" y="40">z</text>
                  <text x="150" y="28">z</text>
                  <text x="158" y="16">Z</text>
                </g>

              </g>
            </g>
          </g>
        </svg>
      </div>
    </div>

    <!-- Chat Panel -->
    <div class="mehran-ai-panel" id="mehran-ai-panel" role="dialog" aria-modal="true" aria-label="Mehran AI Chat">
      <!-- Header -->
      <div class="mehran-ai-header">
        <div class="mehran-ai-title-wrap">
          <span class="mehran-ai-title"><span class="mehran-ai-sparkle">✦</span> Mehran AI</span>
          <span class="mehran-ai-subtitle">Portfolio Assistant</span>
        </div>
        <button class="mehran-ai-close" id="mehran-ai-close" aria-label="Close chat">×</button>
      </div>

      <!-- Messages Stream -->
      <div class="mehran-ai-messages" id="mehran-ai-messages">
        <!-- Initial Greeting -->
        <div class="mehran-msg mehran-msg-bot">
          <p>Hi! I'm Mehran's portfolio assistant.</p>
          <p>Ask me about his SOC skills, homelab, detection rules, or career goals:</p>
          <div class="mehran-ai-suggestions" id="mehran-ai-suggestions"></div>
        </div>
      </div>

      <!-- Input Form -->
      <div class="mehran-ai-footer">
        <form class="mehran-ai-input-form" id="mehran-ai-form">
          <input 
            type="text" 
            class="mehran-ai-input" 
            id="mehran-ai-input" 
            placeholder="Ask a question..." 
            autocomplete="off" 
            maxlength="500"
            required
          />
          <button type="submit" class="mehran-ai-send" id="mehran-ai-send" aria-label="Send question">
            ➤
          </button>
        </form>
      </div>
    </div>
  `;

  document.body.appendChild(widgetContainer);

  // References
  const buddyWrap = document.getElementById('buddy-launcher-wrap');
  const buddy = document.getElementById('buddy');
  const lean = buddy.querySelector('#lean');
  const mouth = buddy.querySelector('#mouth');
  const bubble = buddy.querySelector('.buddy-bubble');
  const looks = [...buddy.querySelectorAll('.eye-look')];
  const shines = [...buddy.querySelectorAll('.shine')];
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const panel = document.getElementById('mehran-ai-panel');
  const closeBtn = document.getElementById('mehran-ai-close');
  const messagesEl = document.getElementById('mehran-ai-messages');
  const form = document.getElementById('mehran-ai-form');
  const inputEl = document.getElementById('mehran-ai-input');
  const sendBtn = document.getElementById('mehran-ai-send');
  const suggestionsBox = document.getElementById('mehran-ai-suggestions');

  let isOpen = false;
  let isLoading = false;

  /* ---------- Ghost Moods ---------- */
  const MOODS = {
    idle:   { d: 'M92 80Q100 90 108 80',                       fill: 'none' },
    happy:  { d: 'M90 79Q100 99 110 79Z',                      fill: '#ff6b8a' },
    alert:  { d: 'M96 84a4 5 0 1 0 8 0a4 5 0 1 0 -8 0Z',       fill: '#0b1020' },
    guard:  { d: 'M94 82Q100 87 106 82',                       fill: 'none' },
    sleepy: { d: 'M95 84Q100 86 105 84',                       fill: 'none' }
  };
  let mood = 'idle', moodTimer;

  function setMood(name, ms) {
    if (!MOODS[name]) name = 'idle';
    mood = name;
    buddy.dataset.mood = name;
    mouth.setAttribute('d', MOODS[name].d);
    mouth.setAttribute('fill', MOODS[name].fill);
    clearTimeout(moodTimer);
    if (name !== 'idle' && ms) moodTimer = setTimeout(() => setMood('idle'), ms);
  }

  /* ---------- Speech bubble (disabled) ---------- */
  function say(text, ms) {
    // Disabled per user preference - emotions/moods only
  }

  /* ---------- Cursor tracking ---------- */
  const target = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
  let lastMove = performance.now(), raf = 0;

  function aim(px, py) {
    const r = buddy.getBoundingClientRect();
    const dx = px - (r.left + r.width / 2);
    const dy = py - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, len / 280);
    target.x = (dx / len) * k;
    target.y = (dy / len) * k;
    lastMove = performance.now();
    kick();
  }

  function frame() {
    raf = 0;
    const ease = calm ? 1 : .12;
    cur.x += (target.x - cur.x) * ease;
    cur.y += (target.y - cur.y) * ease;

    const ex = cur.x * 3.5, ey = cur.y * 4;
    looks.forEach(l => l.style.transform = `translate(${ex}px, ${ey}px)`);
    const sx = cur.x * 1.5, sy = cur.y * 1.5;
    shines.forEach(s => s.style.transform = `translate(${sx}px, ${sy}px)`);

    if (!calm) lean.style.transform =
      `translate(${cur.x * 3}px, ${cur.y * 2}px) rotate(${cur.x * 5}deg)`;

    if (Math.abs(target.x - cur.x) > .002 || Math.abs(target.y - cur.y) > .002) kick();
  }
  function kick() { if (!raf && !document.hidden) raf = requestAnimationFrame(frame); }
  document.addEventListener('visibilitychange', kick);

  addEventListener('pointermove', e => { aim(e.clientX, e.clientY); activity(); }, { passive: true });

  setInterval(() => {
    if (performance.now() - lastMove > 3500) {
      if (mood === 'sleepy') { target.x = 0; target.y = 0; }
      else {
        target.x = Math.random() < .5 ? 0 : (Math.random() * 2 - 1) * .7;
        target.y = Math.random() < .5 ? 0 : (Math.random() * 2 - 1) * .4;
      }
      kick();
    }
  }, 2500);

  /* ---------- Sleep and wake ---------- */
  const SLEEP_AFTER = 30000;
  let sleepTimer;
  function armSleep() { clearTimeout(sleepTimer); sleepTimer = setTimeout(() => { if (!isOpen) setMood('sleepy'); }, SLEEP_AFTER); }
  function activity() {
    if (mood === 'sleepy') setMood('alert', 900);
    armSleep();
  }
  ['scroll', 'keydown', 'pointerdown'].forEach(t => addEventListener(t, activity, { passive: true }));
  armSleep();

  /* ---------- Click/Poke handler ---------- */
  function poke() {
    setMood('happy', 1500);
    togglePanel();
    // Only bounce when closing — opening uses the CSS slide animation
    if (!calm && !isOpen) buddy.animate(
      [{ transform: 'translateY(0) scale(1)' },
       { transform: 'translateY(-14px) scale(1.08,.94)' },
       { transform: 'translateY(0) scale(.96,1.04)' },
       { transform: 'translateY(0) scale(1)' }],
      { duration: 420, easing: 'ease-out' });
  }

  buddyWrap.addEventListener('click', (e) => {
    // Only poke if not clicking inside the open panel
    if (!panel.contains(e.target)) poke();
  });

  buddy.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); poke(); }
  });

  // Section scroll reactions (emotions/moods only, no speech popups)
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      if (!en.isIntersecting) return;
      const d = en.target.dataset;
      if (d.buddyMood) setMood(d.buddyMood, 3000);
    }), { threshold: .6 });
    document.querySelectorAll('[data-buddy-mood]').forEach(el => io.observe(el));
  }

  // Render Suggested Chips
  SUGGESTED_QUESTIONS.forEach(q => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'mehran-ai-chip';
    chip.textContent = q;
    chip.addEventListener('click', () => {
      inputEl.value = q;
      handleSend(q);
    });
    suggestionsBox.appendChild(chip);
  });

  // Toggle Panel
  const askTag = document.getElementById('buddy-ask-tag');

  function togglePanel(open) {
    isOpen = typeof open === 'boolean' ? open : !isOpen;
    const isMobile = window.innerWidth <= 600;
    if (isOpen) {
      panel.classList.add('open');
      askTag.style.display = 'none';
      if (isMobile) {
        // On mobile, hide ghost (panel fills screen)
        buddy.style.display = 'none';
      } else {
        // On desktop, slide ghost to the left of the panel
        buddy.style.transform = 'translateX(-412px)';
      }
      inputEl.focus();
      setMood('happy', 1200);
    } else {
      panel.classList.remove('open');
      // Reset ghost to original position
      buddy.style.transform = '';
      buddy.style.display = '';
      askTag.style.display = '';
      setMood('idle');
    }
  }

  closeBtn.addEventListener('click', () => togglePanel(false));

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) {
      togglePanel(false);
    }
  });

  // Scroll messages to bottom
  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // Append a message bubble
  function appendMessage(content, type) {
    const msg = document.createElement('div');
    msg.className = `mehran-msg mehran-msg-${type}`;
    if (type === 'bot') {
      msg.innerHTML = renderMarkdown(content);
    } else {
      msg.textContent = content;
    }
    messagesEl.appendChild(msg);
    scrollToBottom();
    return msg;
  }

  let wakeupTimer = null;

  // Show typing indicator
  function showTypingIndicator() {
    const typing = document.createElement('div');
    typing.id = 'mehran-typing-indicator';
    typing.className = 'mehran-msg mehran-msg-bot mehran-typing';
    typing.innerHTML = `
      <span class="mehran-dot"></span>
      <span class="mehran-dot"></span>
      <span class="mehran-dot"></span>
      <span class="mehran-typing-status" id="mehran-typing-status" style="margin-left: 0.5rem; font-size: 0.78rem; color: var(--ai-text-muted);"></span>
    `;
    messagesEl.appendChild(typing);
    scrollToBottom();

    // If waiting more than 4.5 seconds (cold start wake-up), display notice
    wakeupTimer = setTimeout(() => {
      const statusEl = document.getElementById('mehran-typing-status');
      if (statusEl) {
        statusEl.textContent = 'Waking up server...';
      }
    }, 4500);
  }

  // Remove typing indicator
  function removeTypingIndicator() {
    if (wakeupTimer) {
      clearTimeout(wakeupTimer);
      wakeupTimer = null;
    }
    const indicator = document.getElementById('mehran-typing-indicator');
    if (indicator) indicator.remove();
  }

  // Send Question to FastAPI Backend
  async function handleSend(userQuestion) {
    const query = (userQuestion || inputEl.value).trim();
    if (!query || isLoading) return;

    // Reset input
    inputEl.value = '';
    isLoading = true;
    sendBtn.disabled = true;

    // Append user message
    appendMessage(query, 'user');

    // Show loading dots and put mascot in defensive guard mood (shield up!)
    showTypingIndicator();
    setMood('guard');

    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), 70000);

    try {
      const response = await fetch(`${BACKEND_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ message: query }),
        signal: controller.signal
      });

      clearTimeout(timeoutTimer);
      removeTypingIndicator();

      if (response.ok) {
        const data = await response.json();
        appendMessage(data.answer || "I received an empty answer.", 'bot');
        setMood('happy', 2500); // wave & smile when answer arrives!
      } else if (response.status === 429) {
        appendMessage("Rate limit exceeded. Please wait a minute before asking another question.", 'error');
        setMood('alert', 2000);
      } else {
        const errorData = await response.json().catch(() => ({}));
        const detail = errorData.detail || `Server returned error ${response.status}.`;
        appendMessage(`Error: ${detail}`, 'error');
        setMood('alert', 2000);
      }
    } catch (err) {
      clearTimeout(timeoutTimer);
      removeTypingIndicator();
      console.error("[Mehran AI]", err);
      setMood('alert', 2000);
      if (err.name === 'AbortError') {
        appendMessage("Request timed out after 70 seconds. The service took too long to respond.", 'error');
      } else {
        appendMessage("Unable to connect to Mehran AI. Make sure the backend server is running.", 'error');
      }
    } finally {
      isLoading = false;
      sendBtn.disabled = false;
      inputEl.focus();
    }
  }

  // Submit form handler
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSend();
  });

  setMood('idle');
  kick();

  // Public API exposed for page scripts
  window.buddy = { setMood, say, poke };
})();
