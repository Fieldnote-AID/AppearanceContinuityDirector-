/* === Appearance Continuity Director ===
   Paste near the END of library.js, below Inner Self.
   Compatible with Questline-style wrappers.

   WHAT IT DOES:
   - Tracks appearance continuity for configured characters
   - Scans latest AI output for outfit / condition / appearance changes
   - Updates one story card per tracked character
   - Keeps live state in state.AppearanceDirector, not in Plot Essentials / Story Summary

   OPTIONAL CONSOLE / SCRIPT CONTROLS:
   - AppearanceDirector.refresh()
   - AppearanceDirector.reset()                  // reset all tracked characters
   - AppearanceDirector.reset("margo")         // reset one character
   - AppearanceDirector.note("margo", "Outfit: black silk dress. Condition: rain-soaked.")
   - AppearanceDirector.clear("margo", "condition")
*/

(function installAppearanceContinuityDirector() {
  "use strict";

  const APPEARANCE_CONFIG = {
    stateKey: "AppearanceDirector_Characters",
    cardType: "class",
    maxFragmentsPerBucket: 4,
    maxLastObservations: 8,
    maxScanWindowChars: 220,
    runOnHooks: ["output"],
    pinCards: false,

    characters: [
      {
        id: "seth",
        name: "Seth Vaelis",
        aliases: ["Seth", "Seth Vaelis"],
        cardTitle: "Appearance — Seth Vaelis",
        cardKeys: "Seth, Seth Vaelis, appearance, outfit, clothes"
      },
      {
        id: "margo",
        name: "Margo Hanson",
        aliases: ["Margo", "Margo Hanson"],
        cardTitle: "Appearance — Margo Hanson",
        cardKeys: "Margo, Margo Hanson, appearance, outfit, clothes"
      },
      {
        id: "eliot",
        name: "Eliot Waugh",
        aliases: ["Eliot", "Eliot Waugh"],
        cardTitle: "Appearance — Eliot Waugh",
        cardKeys: "Eliot, Eliot Waugh, appearance, outfit, clothes"
      },
      {
        id: "quentin",
        name: "Quentin Coldwater",
        aliases: ["Quentin", "Quentin Coldwater", "Q"],
        cardTitle: "Appearance — Quentin Coldwater",
        cardKeys: "Quentin, Quentin Coldwater, Q, appearance, outfit, clothes"
      },
      {
        id: "alice",
        name: "Alice Quinn",
        aliases: ["Alice", "Alice Quinn"],
        cardTitle: "Appearance — Alice Quinn",
        cardKeys: "Alice, Alice Quinn, appearance, outfit, clothes"
      },
      {
        id: "penny",
        name: "Penny",
        aliases: ["Penny"],
        cardTitle: "Appearance — Penny",
        cardKeys: "Penny, appearance, outfit, clothes"
      }
    ],

    bucketLabels: {
      outfit: "Outfit",
      condition: "Condition",
      details: "Visible details",
      recent: "Recent updates"
    },

    garmentWords: [
      "coat", "jacket", "blazer", "suit", "shirt", "dress shirt", "tee", "t-shirt", "sweater", "cardigan", "hoodie",
      "vest", "waistcoat", "tie", "bow tie", "scarf", "cloak", "robe", "dress", "gown", "skirt", "pants", "trousers",
      "jeans", "leggings", "shorts", "boots", "heels", "shoes", "sneakers", "loafers", "sandals", "gloves", "stockings",
      "corset", "bodice", "uniform", "pajamas", "pyjamas", "nightgown", "jumpsuit", "belt", "sleeves", "cuffs"
    ],

    accessoryWords: [
      "ring", "rings", "necklace", "pendant", "earring", "earrings", "bracelet", "bracelets", "watch", "crown", "tiara",
      "glasses", "spectacles", "mask", "hat", "cap", "hood", "bag", "satchel", "flask", "cane", "staff"
    ],

    conditionWords: [
      "dirty", "filthy", "muddy", "dusty", "dust-streaked", "dust coated", "bloodied", "bloody", "blood-soaked", "soaked",
      "rain-soaked", "wet", "damp", "sweaty", "sweat-soaked", "smudged", "smeared", "stained", "wine-stained", "rumpled",
      "wrinkled", "torn", "ripped", "singed", "burned", "charred", "soot-streaked", "ash-streaked", "bruised", "cut",
      "scratched", "bandaged", "disheveled", "dishevelled", "unkempt", "clean", "fresh", "freshly changed"
    ],

    resetOutfitSignals: [
      "changed into", "changes into", "now wearing", "now wears", "dressed in", "clad in", "wearing", "wears", "wore",
      "into a fresh", "into clean", "fresh clothes", "freshly changed", "slipped into", "pulls on", "pulled on", "buttoned into"
    ],

    clearConditionSignals: [
      "washed off", "washed away", "cleaned up", "cleaned off", "changed clothes", "changed into", "showered", "bathed",
      "scrubbed clean", "fresh clothes", "freshly changed", "no longer dirty", "clean again"
    ]
  };

  function safeString(v) {
    return typeof v === "string" ? v : "";
  }

  function escapeRegex(text) {
    return safeString(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function normalizeSpace(text) {
    return safeString(text)
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/\s+/g, " ")
      .trim();
  }

  function lower(text) {
    return normalizeSpace(text).toLowerCase();
  }

  function ensureCardsArray() {
    globalThis.storyCards ??= [];
    return storyCards;
  }

  function ensureState() {
    globalThis.state ??= {};
    state[APPEARANCE_CONFIG.stateKey] ??= {
      characters: {},
      processedTextHash: ""
    };
    return state[APPEARANCE_CONFIG.stateKey];
  }

  function configById(id) {
    return APPEARANCE_CONFIG.characters.find(c => c.id === id) || null;
  }

  function findCard(title) {
    const target = lower(title);
    return ensureCardsArray().find(card => lower(card?.title) === target) || null;
  }

  function upsertCard(cardConfig) {
    const cards = ensureCardsArray();
    let card = findCard(cardConfig.title);

    if (!card && typeof addStoryCard === "function") {
      addStoryCard("%@%");
      card = cards.find(c => c.title === "%@%") || null;
    }

    if (!card) {
      card = { title: "%@%", keys: "", entry: "", description: "", type: APPEARANCE_CONFIG.cardType };
      cards.unshift(card);
    }

    card.type = APPEARANCE_CONFIG.cardType;
    card.title = cardConfig.title;
    card.keys = cardConfig.keys;
    card.entry = cardConfig.entry;
    card.description = cardConfig.description || "";

    if (cardConfig.pinned) {
      const index = cards.indexOf(card);
      if (index > 0) {
        cards.splice(index, 1);
        cards.unshift(card);
      }
    }

    return card;
  }

  function getLatestText() {
    if (normalizeSpace(globalThis.text)) return globalThis.text;
    const last = Array.isArray(globalThis.history) ? history[history.length - 1] : null;
    return safeString(last?.text || last?.rawText);
  }

  function simpleHash(text) {
    const body = safeString(text);
    let hash = 0;
    for (let i = 0; i < body.length; i++) {
      hash = ((hash << 5) - hash + body.charCodeAt(i)) | 0;
    }
    return String(hash);
  }

  function uniquePush(list, value, limit) {
    const clean = normalizeSpace(value);
    if (!clean) return list;
    const target = lower(clean);
    const next = Array.isArray(list) ? list.filter(Boolean) : [];
    if (!next.some(item => lower(item) === target)) {
      next.unshift(clean);
    }
    return next.slice(0, limit);
  }

  function dedupeList(list, limit) {
    const next = [];
    const seen = new Set();
    for (const item of Array.isArray(list) ? list : []) {
      const clean = normalizeSpace(item);
      if (!clean) continue;
      const key = lower(clean);
      if (seen.has(key)) continue;
      seen.add(key);
      next.push(clean);
      if (next.length >= limit) break;
    }
    return next;
  }


  function dedupeSpecific(list, limit) {
    const sorted = dedupeList(list, 50).sort((a, b) => b.length - a.length);
    const kept = [];
    for (const item of sorted) {
      const key = lower(item);
      if (kept.some(existing => lower(existing).includes(key) && lower(existing) !== key)) continue;
      kept.push(item);
      if (kept.length >= limit) break;
    }
    return kept;
  }

  function removeListItems(list, predicate) {
    return (Array.isArray(list) ? list : []).filter(item => !predicate(lower(item), item));
  }

  function splitIntoSegments(text) {
    return safeString(text)
      .split(/(?<=[.!?\n])\s+|[\n\r]+/)
      .map(normalizeSpace)
      .filter(Boolean);
  }

  function aliasRegexes(aliases) {
    return (Array.isArray(aliases) ? aliases : [])
      .map(alias => normalizeSpace(alias))
      .filter(Boolean)
      .map(alias => new RegExp(`\\b${escapeRegex(alias)}\\b`, "i"));
  }

  function segmentMentionsCharacter(segment, character) {
    return aliasRegexes(character.aliases).some(rx => rx.test(segment));
  }

  function textHasAny(text, terms) {
    const body = lower(text);
    return (Array.isArray(terms) ? terms : []).some(term => body.includes(lower(term)));
  }

  function normalizeFragment(text) {
    let value = normalizeSpace(text)
      .replace(/^[,;:()\-\s]+/, "")
      .replace(/[,;:()\-\s]+$/, "")
      .replace(/^\b(?:and|with|while|as|but)\b\s+/i, "")
      .replace(/^\b(?:is|was|looks|looks like|looked|appears|appeared|stands|stood|remains|seems|wearing|wears|wore|dressed in|clad in|changed into|changes into|slipped into|pulls on|pulled on)\b\s+/i, "")
      .replace(/^\b(?:still|now|currently)\b\s+/i, "");

    if (!value) return "";
    if (/^[a-z]$/.test(value)) return "";
    return value;
  }

  function hasLexiconWord(text, words) {
    const body = lower(text);
    return (Array.isArray(words) ? words : []).some(word => body.includes(lower(word)));
  }

  function sortWordsByLength(words) {
    return (Array.isArray(words) ? words : []).slice().sort((a, b) => b.length - a.length);
  }

  function extractOutfitPhrases(segment) {
    const phrases = [];
    const garmentPattern = sortWordsByLength(APPEARANCE_CONFIG.garmentWords)
      .map(escapeRegex)
      .join("|");
    const rx = new RegExp(`(?:\\b(?:[a-zA-Z][a-zA-Z\'’\\-]*\\s+){0,4}(?:${garmentPattern})\\b(?:\\s+(?:and|,|with)\\s+(?:[a-zA-Z][a-zA-Z\'’\\-]*\\s+){0,4}(?:${garmentPattern})\\b)*)`, "gi");
    let match;
    while ((match = rx.exec(segment))) {
      let phrase = normalizeFragment(match[0])
        .replace(/\b(?:dirty|filthy|muddy|dusty|bloodied|bloody|blood-soaked|soaked|rain-soaked|wet|damp|sweaty|smudged|smeared|stained|wine-stained|rumpled|wrinkled|torn|ripped|singed|burned|charred|soot-streaked|ash-streaked|bruised|cut|scratched|bandaged|disheveled|dishevelled|unkempt|clean|fresh|freshly changed)\b/gi, "")
        .replace(/\s{2,}/g, " ")
        .replace(/^\b(?:a|an|the)\b\s+/i, "")
        .replace(/\s+(?:and|with|,)\s*$/i, "")
        .replace(/^[A-Z][A-Za-z\'’\\-]*[\'’]s\s+/g, "")
        .trim();
      if (phrase && hasLexiconWord(phrase, APPEARANCE_CONFIG.garmentWords)) {
        phrases.push(phrase);
      }
    }
    return dedupeList(phrases, APPEARANCE_CONFIG.maxFragmentsPerBucket);
  }

  function extractConditionPhrases(segment) {
    const phrases = [];
    const body = normalizeSpace(segment);
    for (const term of sortWordsByLength(APPEARANCE_CONFIG.conditionWords)) {
      const rx = new RegExp(`\\b${escapeRegex(term)}\\b`, "i");
      if (rx.test(body)) phrases.push(term);
    }

    const patterned = body.match(/\b(?:blood|mud|dirt|soot|ash|wine)\s+(?:on|at|across|down)\s+[^,.;!?]{1,40}/gi) || [];
    phrases.push(...patterned);

    return dedupeSpecific(phrases.map(normalizeFragment), APPEARANCE_CONFIG.maxFragmentsPerBucket);
  }

  function extractDetailPhrases(segment) {
    const phrases = [];
    const body = normalizeSpace(segment);
    const matches = body.match(/\b(?:barefoot|shirtless|gloved|ungloved|masked|unmasked)\b/gi) || [];
    phrases.push(...matches);

    const detailPatterns = [
      /\b(?:hair|face|eyes|makeup|lipstick|mascara|stubble|beard|posture|stance|expression|scar|tattoo)\b[^,.;!?]{0,60}/gi,
      /[^,.;!?]{0,30}\b(?:scar|tattoo|bruise|cut)\b[^,.;!?]{0,30}/gi
    ];
    for (const pattern of detailPatterns) {
      const found = body.match(pattern) || [];
      phrases.push(...found);
    }

    return dedupeList(phrases.map(normalizeFragment), APPEARANCE_CONFIG.maxFragmentsPerBucket);
  }

  function extractPatternFragments(segment, aliases) {
    const found = [];
    for (const alias of aliases) {
      const a = escapeRegex(alias);
      const patterns = [
        new RegExp(`\\b${a}\\b[^.!?\\n]{0,70}\\b(?:is|was|looks|looked|appears|appeared|stands|stood|remains|seems)\\b([^.!?\\n]{0,120})`, "i"),
        new RegExp(`\\b${a}\\b[^.!?\\n]{0,70}\\b(?:wearing|wears|wore|dressed in|clad in|now wearing|now wears|changed into|changes into|slipped into|pulls on|pulled on)\\b([^.!?\\n]{0,140})`, "i"),
        new RegExp(`\\b${a}\\b[^.!?\\n]{0,70}\\b(?:with)\\b([^.!?\\n]{0,120})`, "i"),
        new RegExp(`\\b${a}'s\\b([^.!?\\n]{0,140})`, "i")
      ];
      for (const pattern of patterns) {
        const match = segment.match(pattern);
        if (match && match[1]) {
          found.push(match[1]);
        }
      }
    }
    return dedupeList(found.map(normalizeFragment).filter(Boolean), 6);
  }

  function bucketForFragment(fragment) {
    const body = lower(fragment);

    if (hasLexiconWord(body, APPEARANCE_CONFIG.conditionWords)) {
      return "condition";
    }

    if (hasLexiconWord(body, APPEARANCE_CONFIG.garmentWords) || hasLexiconWord(body, APPEARANCE_CONFIG.accessoryWords)) {
      return "outfit";
    }

    if (
      /\b(?:hair|face|eyes|makeup|lipstick|mascara|stubble|beard|smile|posture|stance|expression|scar|tattoo|bruise|blood at|blood on|mud on|dirt on|barefoot|shirtless)\b/i.test(fragment)
    ) {
      return "details";
    }

    return null;
  }

  function shouldTreatSegmentAsAppearance(segment) {
    return (
      hasLexiconWord(segment, APPEARANCE_CONFIG.garmentWords)
      || hasLexiconWord(segment, APPEARANCE_CONFIG.accessoryWords)
      || hasLexiconWord(segment, APPEARANCE_CONFIG.conditionWords)
      || /\b(?:wearing|wears|wore|dressed|clad|changed into|looks|looked|appears|appeared|barefoot|shirtless)\b/i.test(segment)
    );
  }

  function getCharacterState(characterId) {
    const root = ensureState();
    root.characters[characterId] ??= {
      outfit: [],
      condition: [],
      details: [],
      recent: [],
      lastSnippet: ""
    };
    return root.characters[characterId];
  }

  function clearEphemeralCondition(stateEntry) {
    stateEntry.condition = removeListItems(stateEntry.condition, key => {
      return /(dirty|filthy|muddy|dusty|dust-streaked|bloodied|bloody|blood-soaked|soaked|wet|damp|sweaty|smudged|smeared|stained|rumpled|wrinkled|torn|ripped|singed|charred|soot-streaked|ash-streaked|disheveled|dishevelled|unkempt)/i.test(key);
    });
  }

  function replaceBucket(stateEntry, bucket, values) {
    stateEntry[bucket] = dedupeList(values, APPEARANCE_CONFIG.maxFragmentsPerBucket);
  }

  function mergeBucket(stateEntry, bucket, values) {
    let next = Array.isArray(stateEntry[bucket]) ? stateEntry[bucket].slice() : [];
    for (const value of values) {
      next = uniquePush(next, value, APPEARANCE_CONFIG.maxFragmentsPerBucket);
    }
    stateEntry[bucket] = dedupeList(next, APPEARANCE_CONFIG.maxFragmentsPerBucket);
  }

  function buildCharacterCardEntry(character, stateEntry) {
    const lines = [];

    if (stateEntry.outfit.length) {
      lines.push(`- ${APPEARANCE_CONFIG.bucketLabels.outfit}: ${stateEntry.outfit.join("; ")}.`);
    }
    if (stateEntry.condition.length) {
      lines.push(`- ${APPEARANCE_CONFIG.bucketLabels.condition}: ${stateEntry.condition.join("; ")}.`);
    }
    if (stateEntry.details.length) {
      lines.push(`- ${APPEARANCE_CONFIG.bucketLabels.details}: ${stateEntry.details.join("; ")}.`);
    }
    if (stateEntry.recent.length) {
      lines.push(`- ${APPEARANCE_CONFIG.bucketLabels.recent}: ${stateEntry.recent.join(" | ")}.`);
    }

    if (!lines.length) {
      lines.push(`- ${APPEARANCE_CONFIG.bucketLabels.recent}: no tracked appearance changes yet.`);
    }

    return lines.join("\n");
  }

  function refreshCharacterCard(character) {
    const stateEntry = getCharacterState(character.id);
    return upsertCard({
      title: character.cardTitle || `Appearance — ${character.name}`,
      keys: character.cardKeys || [character.name].concat(character.aliases || []).join(", "),
      entry: buildCharacterCardEntry(character, stateEntry),
      description: "Auto-managed appearance continuity card.",
      pinned: !!APPEARANCE_CONFIG.pinCards
    });
  }

  function refreshAllCards() {
    for (const character of APPEARANCE_CONFIG.characters) {
      refreshCharacterCard(character);
    }
  }

  function inferObservations(segment, character) {
    const observations = {
      outfit: [],
      condition: [],
      details: [],
      resetOutfit: false,
      clearCondition: false
    };

    const normalizedSegment = normalizeSpace(segment).slice(0, APPEARANCE_CONFIG.maxScanWindowChars);
    const fragments = extractPatternFragments(normalizedSegment, character.aliases);

    observations.resetOutfit = textHasAny(normalizedSegment, APPEARANCE_CONFIG.resetOutfitSignals);
    observations.clearCondition = textHasAny(normalizedSegment, APPEARANCE_CONFIG.clearConditionSignals);

    observations.outfit.push(...extractOutfitPhrases(normalizedSegment));
    observations.condition.push(...extractConditionPhrases(normalizedSegment));
    observations.details.push(...extractDetailPhrases(normalizedSegment));

    if (!observations.outfit.length && !observations.condition.length && !observations.details.length) {
      for (const fragment of fragments) {
        const bucket = bucketForFragment(fragment);
        if (!bucket) continue;
        const clean = normalizeFragment(fragment);
        if (!clean) continue;
        observations[bucket].push(clean);
      }
    }

    observations.outfit = dedupeList(observations.outfit, APPEARANCE_CONFIG.maxFragmentsPerBucket);
    observations.condition = dedupeList(observations.condition, APPEARANCE_CONFIG.maxFragmentsPerBucket);
    observations.details = dedupeList(observations.details, APPEARANCE_CONFIG.maxFragmentsPerBucket);

    return observations;
  }

  function applyObservations(character, observations, snippet) {
    const stateEntry = getCharacterState(character.id);
    let changed = false;

    if (observations.clearCondition) {
      const before = JSON.stringify(stateEntry.condition);
      clearEphemeralCondition(stateEntry);
      changed ||= (before !== JSON.stringify(stateEntry.condition));
    }

    if (observations.outfit.length) {
      const before = JSON.stringify(stateEntry.outfit);
      if (observations.resetOutfit) {
        replaceBucket(stateEntry, "outfit", observations.outfit);
      } else {
        mergeBucket(stateEntry, "outfit", observations.outfit);
      }
      changed ||= (before !== JSON.stringify(stateEntry.outfit));
    }

    if (observations.condition.length) {
      const before = JSON.stringify(stateEntry.condition);
      mergeBucket(stateEntry, "condition", observations.condition);
      changed ||= (before !== JSON.stringify(stateEntry.condition));
    }

    if (observations.details.length) {
      const before = JSON.stringify(stateEntry.details);
      mergeBucket(stateEntry, "details", observations.details);
      changed ||= (before !== JSON.stringify(stateEntry.details));
    }

    const snippetText = normalizeSpace(snippet).slice(0, 150);
    if (changed && snippetText) {
      stateEntry.recent = uniquePush(stateEntry.recent, snippetText, APPEARANCE_CONFIG.maxLastObservations);
      stateEntry.lastSnippet = snippetText;
    }

    return changed;
  }

  function scanCharacter(character, text) {
    const segments = splitIntoSegments(text);
    let changed = false;

    for (const segment of segments) {
      if (!segmentMentionsCharacter(segment, character)) continue;
      if (!shouldTreatSegmentAsAppearance(segment)) continue;
      const observations = inferObservations(segment, character);
      if (!observations.outfit.length && !observations.condition.length && !observations.details.length && !observations.clearCondition) {
        continue;
      }
      changed = applyObservations(character, observations, segment) || changed;
    }

    if (changed) {
      refreshCharacterCard(character);
    }

    return changed;
  }

  function scanLatestText(text) {
    const body = normalizeSpace(text);
    if (!body) return false;

    const root = ensureState();
    const hash = simpleHash(body);
    if (root.processedTextHash === hash) {
      return false;
    }
    root.processedTextHash = hash;

    let anyChanged = false;
    for (const character of APPEARANCE_CONFIG.characters) {
      anyChanged = scanCharacter(character, body) || anyChanged;
    }

    if (!anyChanged) {
      refreshAllCards();
    }

    return anyChanged;
  }

  function parseManualNote(noteText) {
    const note = normalizeSpace(noteText);
    const observations = {
      outfit: [],
      condition: [],
      details: [],
      resetOutfit: false,
      clearCondition: false
    };
    if (!note) return observations;

    const parts = note.split(/\s*\|\s*/);
    for (const part of parts) {
      const match = part.match(/^\s*(Outfit|Condition|Details?)\s*:\s*(.+)$/i);
      if (match) {
        const bucket = /^outfit$/i.test(match[1]) ? "outfit" : /^condition$/i.test(match[1]) ? "condition" : "details";
        const values = match[2].split(/\s*;\s*/).map(normalizeFragment).filter(Boolean);
        observations[bucket].push(...values);
      } else if (/^\s*clear\s+condition\s*$/i.test(part)) {
        observations.clearCondition = true;
      } else if (/^\s*reset\s+outfit\s*$/i.test(part)) {
        observations.resetOutfit = true;
      }
    }

    observations.outfit = dedupeList(observations.outfit, APPEARANCE_CONFIG.maxFragmentsPerBucket);
    observations.condition = dedupeList(observations.condition, APPEARANCE_CONFIG.maxFragmentsPerBucket);
    observations.details = dedupeList(observations.details, APPEARANCE_CONFIG.maxFragmentsPerBucket);
    return observations;
  }

  function resetCharacter(characterId) {
    const root = ensureState();
    if (!characterId) {
      root.characters = {};
      refreshAllCards();
      return true;
    }
    const character = configById(characterId);
    if (!character) return false;
    delete root.characters[character.id];
    refreshCharacterCard(character);
    return true;
  }

  function clearCharacterBucket(characterId, bucket) {
    const character = configById(characterId);
    if (!character) return false;
    const stateEntry = getCharacterState(character.id);
    if (!["outfit", "condition", "details", "recent"].includes(bucket)) return false;
    stateEntry[bucket] = [];
    if (bucket === "recent") {
      stateEntry.lastSnippet = "";
    }
    refreshCharacterCard(character);
    return true;
  }

  function addManualNote(characterId, noteText) {
    const character = configById(characterId);
    if (!character) return false;
    const observations = parseManualNote(noteText);
    const changed = applyObservations(character, observations, `Manual note: ${noteText}`);
    refreshCharacterCard(character);
    return changed;
  }

  function run(hook) {
    if (!APPEARANCE_CONFIG.runOnHooks.includes(hook)) return;
    scanLatestText(getLatestText());
  }

  globalThis.AppearanceDirector = {
    config: APPEARANCE_CONFIG,
    run,
    refresh() {
      refreshAllCards();
    },
    reset(characterId) {
      return resetCharacter(characterId || "");
    },
    clear(characterId, bucket) {
      return clearCharacterBucket(characterId, bucket);
    },
    note(characterId, noteText) {
      return addManualNote(characterId, noteText);
    },
    scan(textOverride) {
      return scanLatestText(safeString(textOverride));
    }
  };

  if (typeof globalThis.InnerSelf === "function" && !globalThis.InnerSelf.__appearanceDirectorWrapped) {
    const original = globalThis.InnerSelf;
    const wrapped = function(hook) {
      const result = original(hook);
      try {
        globalThis.AppearanceDirector.run(hook);
      } catch (_) {}
      return result;
    };
    wrapped.__appearanceDirectorWrapped = true;
    globalThis.InnerSelf = wrapped;
  } else if (typeof globalThis.InnerSelf !== "function") {
    try {
      globalThis.AppearanceDirector.refresh();
    } catch (_) {}
  }
})();
