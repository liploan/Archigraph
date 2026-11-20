/**
 * Shared accessible interest-triggered tooltip & toggletip wiring for Archigraph.
 * Runs synchronously on parsed DOM before loading the `interestfor` polyfill so
 * screen readers have explicit ARIA relationships in browse mode immediately.
 */

const ownedToggletipTriggers = new Set();

function normalizeWhitespace(str) {
  return String(str || "").replace(/\s+/g, " ").trim();
}

function getAccessibleName(el) {
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const joined = labelledBy
      .split(/\s+/)
      .map(id => document.getElementById(id)?.textContent || "")
      .join(" ");
    const norm = normalizeWhitespace(joined);
    if (norm) return norm;
  }
  const ariaLabel = normalizeWhitespace(el.getAttribute("aria-label"));
  if (ariaLabel) return ariaLabel;

  let text = el.textContent || "";
  el.querySelectorAll("img[alt]").forEach(img => {
    text += " " + (img.getAttribute("alt") || "");
  });
  const normText = normalizeWhitespace(text);
  if (normText) return normText;

  return normalizeWhitespace(el.getAttribute("title"));
}

function isPopoverCurrentlyOpen(popoverEl) {
  try {
    if (popoverEl.matches(":popover-open")) return true;
  } catch (_) {
    // Older engines without :popover-open support
  }
  return popoverEl.classList.contains(":popover-open");
}

function opensHintOnActivation(trigger, hintId) {
  return (
    trigger.getAttribute("popovertarget") === hintId ||
    trigger.getAttribute("commandfor") === hintId
  );
}

export function wireInterestHints(root = document) {
  const scope = root && typeof root.querySelectorAll === "function" ? root : document;
  scope.querySelectorAll("[interestfor]").forEach(trigger => {
    const hintId = trigger.getAttribute("interestfor");
    if (!hintId) return;
    const hint = document.getElementById(hintId);
    if (!hint || hint.getAttribute("popover") !== "hint") return;

    const hintText = normalizeWhitespace(hint.textContent);
    const triggerName = getAccessibleName(trigger);
    if (hintText && hintText.toLowerCase() === triggerName.toLowerCase()) {
      return;
    }

    if (!hint.hasAttribute("role")) {
      hint.setAttribute("role", "tooltip");
    }

    if (!triggerName) {
      if (!trigger.hasAttribute("aria-labelledby")) {
        trigger.setAttribute("aria-labelledby", hintId);
      }
      return;
    }

    if (opensHintOnActivation(trigger, hintId)) {
      if (!trigger.hasAttribute("aria-expanded")) {
        trigger.setAttribute("aria-expanded", String(isPopoverCurrentlyOpen(hint)));
        ownedToggletipTriggers.add(trigger);
      }
    } else if (!trigger.hasAttribute("aria-describedby")) {
      trigger.setAttribute("aria-describedby", hintId);
    }
  });
}

window.wireInterestHints = wireInterestHints;

// 1. Wire ARIA relationships upfront before polyfills initialize
wireInterestHints(document);

// 2. Keep toggletip aria-expanded in sync from the popover's toggle event (capture phase)
document.addEventListener(
  "toggle",
  event => {
    const popoverEl = event.target;
    if (!(popoverEl instanceof HTMLElement) || !popoverEl.id) return;
    const expanded = String(event.newState === "open" || isPopoverCurrentlyOpen(popoverEl));
    ownedToggletipTriggers.forEach(trigger => {
      if (trigger.getAttribute("interestfor") === popoverEl.id) {
        trigger.setAttribute("aria-expanded", expanded);
      }
    });
  },
  true
);

// 3. Minimal fallback if CDN import of `interestfor` is unreachable offline
function installOfflineInterestFallback() {
  let activeHint = null;
  let showTimer = null;
  let hideTimer = null;

  const showForTrigger = trigger => {
    const hint = document.getElementById(trigger.getAttribute("interestfor") || "");
    if (!hint) return;
    clearTimeout(hideTimer);
    clearTimeout(showTimer);
    const delay = activeHint && activeHint !== hint ? 0 : 180;
    showTimer = setTimeout(() => {
      if (activeHint && activeHint !== hint) {
        try { activeHint.hidePopover?.(); } catch (_) {}
        document.querySelectorAll(".interest-source").forEach(el => el.classList.remove("interest-source"));
      }
      trigger.classList.add("interest-source");
      hint.classList.add("interest-target");
      try { hint.showPopover?.(); } catch (_) {}
      activeHint = hint;
    }, delay);
  };

  const scheduleHide = () => {
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (activeHint) {
        try { activeHint.hidePopover?.(); } catch (_) {}
        activeHint.classList.remove("interest-target");
        activeHint = null;
      }
      document.querySelectorAll(".interest-source").forEach(el => el.classList.remove("interest-source"));
    }, 120);
  };

  document.addEventListener("pointerover", e => {
    const trigger = e.target instanceof Element ? e.target.closest("[interestfor]") : null;
    if (trigger) {
      showForTrigger(trigger);
    } else if (activeHint && e.target instanceof Node && activeHint.contains(e.target)) {
      clearTimeout(hideTimer);
    }
  });

  document.addEventListener("pointerout", e => {
    const fromTrigger = e.target instanceof Element ? e.target.closest("[interestfor]") : null;
    const fromHint = activeHint && e.target instanceof Node && activeHint.contains(e.target);
    if (fromTrigger || fromHint) scheduleHide();
  });

  document.addEventListener("focusin", e => {
    const trigger = e.target instanceof Element ? e.target.closest("[interestfor]") : null;
    if (trigger) showForTrigger(trigger);
  });

  document.addEventListener("focusout", e => {
    const trigger = e.target instanceof Element ? e.target.closest("[interestfor]") : null;
    if (trigger) scheduleHide();
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && activeHint) {
      clearTimeout(showTimer);
      try { activeHint.hidePopover?.(); } catch (_) {}
      activeHint.classList.remove("interest-target");
      activeHint = null;
      document.querySelectorAll(".interest-source").forEach(el => el.classList.remove("interest-source"));
    }
  });
}

// 4. Load required platform polyfills conditionally via feature detection
async function initOverlayPolyfills() {
  if (!Object.hasOwn(HTMLElement.prototype, "popover")) {
    await import("https://unpkg.com/@oddbird/popover-polyfill@latest/dist/popover.min.js").catch(() => {});
  }

  // Upgrade click-activated toggletips from `hint` -> `auto` where `popover="hint"` falls back to `manual`
  if (Object.hasOwn(HTMLElement.prototype, "popover")) {
    const probe = document.createElement("div");
    probe.popover = "hint";
    if (probe.popover !== "hint") {
      document.addEventListener(
        "beforetoggle",
        ({ target, newState }) => {
          if (!(target instanceof HTMLElement) || !target.id) return;
          const isToggletip =
            target.getAttribute("popover") === "hint" &&
            document.querySelector(`[popovertarget="${CSS.escape(target.id)}"]`);
          if (newState === "open" && isToggletip) {
            target.popover = "auto";
          }
        },
        true
      );
    }
  }

  if (!CSS.supports("anchor-name: --a")) {
    import("https://unpkg.com/@oddbird/css-anchor-positioning").catch(() => {});
  }

  if (!("interestForElement" in HTMLButtonElement.prototype)) {
    await import("https://unpkg.com/interestfor@latest").catch(() => {
      installOfflineInterestFallback();
    });
  }
}

initOverlayPolyfills();

// 5. Two-state Light / Dark Theme Toggle (syncs <meta name="color-scheme"> + localStorage)
function getSchemeMeta() {
  return document.querySelector('meta[name="color-scheme"]');
}

function getSystemScheme() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getRenderedScheme() {
  const metaVal = getSchemeMeta()?.content?.trim();
  if (metaVal === "light" || metaVal === "dark") return metaVal;
  try {
    const stored = localStorage.getItem("color-scheme");
    if (stored === "light" || stored === "dark") return stored;
  } catch {}
  return getSystemScheme();
}

function toggleColorScheme() {
  const current = getRenderedScheme();
  const target = current === "dark" ? "light" : "dark";
  const system = getSystemScheme();
  const nextMeta = target === system ? "light dark" : target;

  const meta = getSchemeMeta();
  if (meta) meta.content = nextMeta;

  try {
    if (target === system) {
      localStorage.removeItem("color-scheme");
    } else {
      localStorage.setItem("color-scheme", target);
    }
  } catch {}
}

document.addEventListener("click", event => {
  const btn = event.target instanceof Element ? event.target.closest("[data-theme-toggle]") : null;
  if (!btn) return;
  toggleColorScheme();
});

window.addEventListener("storage", event => {
  if (event.key !== "color-scheme") return;
  const meta = getSchemeMeta();
  if (!meta) return;
  const val = event.newValue;
  meta.content = val === "light" || val === "dark" ? val : "light dark";
});
