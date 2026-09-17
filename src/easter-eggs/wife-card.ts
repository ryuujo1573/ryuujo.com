// Rikka wife-card easter egg. This module is fetched via dynamic import only
// after the page's click predicate fires (see src/pages/index.astro), so it
// must stay self-contained: it injects its own style and markup.
// The card reuses the shared `.card` styles from src/styles/global.css to stay
// visually identical to the GitHub card.

const CARD_ID = 'wife-card';
export const STORAGE_KEY = 'wife-card-unlocked';

const STYLE = `
#${CARD_ID} { display: flex; animation: wife-card-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1); }
#${CARD_ID} .card-avatar { flex: none; width: 40px; height: 40px; border-radius: 50%; box-shadow: 0 0 0 1px rgb(var(--gray-light)); }
#${CARD_ID} .card-badge { margin-left: 0.5em; padding: 0.05em 0.55em; border-radius: 999px; background: #ffe3ec; color: #d63384; font-size: 0.7em; font-weight: 700; vertical-align: 0.1em; }
@keyframes wife-card-pop { from { opacity: 0; transform: translateY(10px) scale(0.96); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { #${CARD_ID} { animation: none; } }
`;

const CARD_HTML = `
<a id="${CARD_ID}" class="card" href="https://rikka.cc/" target="_blank" rel="noopener noreferrer">
	<img class="card-avatar" src="/rikka-avatar.png" width="40" height="40" alt="Rikka's avatar" />
	<span class="card-text">
		<span class="card-label">Rikka<span class="card-badge">老婆</span></span>
		<span class="card-handle">rikka.cc</span>
	</span>
	<svg class="card-arrow" viewBox="0 0 16 16" aria-hidden="true" width="16" height="16"><path fill="currentColor" d="M3.25 1a.75.75 0 0 0 0 1.5h8.19L1.97 12.03a.75.75 0 1 0 1.06 1.06L12.5 4.56v8.19a.75.75 0 0 0 1.5 0V2.5A1.5 1.5 0 0 0 12.5 1H3.25Z"></path></svg>
</a>`;

export function isUnlocked(): boolean {
	try {
		return localStorage.getItem(STORAGE_KEY) === '1';
	} catch {
		return false;
	}
}

export function activate(): void {
	try {
		localStorage.setItem(STORAGE_KEY, '1');
	} catch {
		/* storage unavailable */
	}
	if (document.getElementById(CARD_ID)) return;
	const style = document.createElement('style');
	style.textContent = STYLE;
	document.head.appendChild(style);
	const template = document.createElement('template');
	template.innerHTML = CARD_HTML;
	document.querySelector('main')?.appendChild(template.content);
}
