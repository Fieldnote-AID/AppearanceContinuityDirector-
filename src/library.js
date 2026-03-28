/* === Appearance Continuity Director ===
   Paste this in Library BELOW Inner Self (and below Questline if you use it).

   PURPOSE
   - Tracks live appearance continuity for configured characters
   - Updates one compact Story Card per tracked character
   - Keeps card text small to avoid wasting Story Card context

   MANUAL CONTROLS
   - AppearanceDirector.refresh()
   - AppearanceDirector.refresh("margo")
   - AppearanceDirector.reset()
   - AppearanceDirector.reset("margo")
   - AppearanceDirector.note("margo", "Outfit: black silk dress | Condition: rain-soaked | Details: barefoot")
   - AppearanceDirector.clear("margo", "condition")
   - AppearanceDirector.scan("Margo steps in wearing a black silk dress, rain-soaked and barefoot.")
*/

(function installAppearanceContinuityDirector() {
  "use strict";

  const APPEARANCE_CONFIG = {
    stateKey: "AppearanceDirector_Characters",
    cardType: "class",

    // Context safety / card size
    createEmptyCards: false,
    pinCards: false,
    maxFragmentsPerBucket: 2,
    maxLastObservations: 1,
    includeRecent: false,
    recentLabelMax: 40,
    maxScanWindowChars: 180,
    maxCardChars: 260,

    // Hooking
    runOnHooks: ["output"],

    characters: [
      {
        id: "seth",
        name: "Seth Vaelis",
        aliases: ["Seth", "Seth Vaelis"],
        cardTitle: "Appearance — Seth Vaelis",
        cardKeys: "Seth, Seth Vaelis"
      },
      {
        id: "margo",
        name: "Margo Hanson",
        aliases: ["Margo", "Margo Hanson"],
        cardTitle: "Appearance — Margo Hanson",
        cardKeys: "Margo, Margo Hanson"
      },
      {
        id: "eliot",
        name: "Eliot Waugh",
        aliases: ["Eliot", "Eliot Waugh"],
        cardTitle: "Appearance — Eliot Waugh",
        cardKeys: "Eliot, Eliot Waugh"
      },
      {
        id: "quentin",
        name: "Quentin Coldwater",
        aliases: ["Quentin", "Quentin Coldwater", "Q"],
        cardTitle: "Appearance — Quentin Coldwater",
        cardKeys: "Quentin, Quentin Coldwater, Q"
      },
      {
        id: "alice",
        name: "Alice Quinn",
        aliases: ["Alice", "Alice Quinn"],
        cardTitle: "Appearance — Alice Quinn",
        cardKeys: "Alice, Alice Quinn"
      },
      {
        id: "penny",
        name: "Penny",
        aliases: ["Penny"],
        cardTitle: "Appearance — Penny",
        cardKeys: "Penny"
      }
    ],

    bucketLabels: {
      outfit: "Outfit",
      condition: "Condition",
      details: "Details",
      recent: "Recent"
    },

    garmentWords: [
      "coat", "jacket", "blazer", "suit", "shirt", "dress shirt", "tee", "t-shirt",
      "sweater", "cardigan", "hoodie", "vest", "waistcoat", "tie", "bow tie", "scarf",
      "cloak", "robe", "dress", "gown", "skirt", "pants", "trousers", "jeans",
      "leggings", "shorts", "boots", "heels", "shoes", "sneakers", "loafers",
      "sandals", "gloves", "stockings", "corset", "bodice", "uniform", "pajamas",
      "pyjamas", "nightgown", "jumpsuit", "belt", "sleeves", "cuffs"
    ],

    accessoryWords: [
      "ring", "rings", "necklace", "pendant", "earring", "earrings", "bracelet",
      "bracelets", "watch", "crown", "tiara", "glasses", "spectacles", "mask",
      "hat", "cap", "hood", "bag", "satchel", "flask", "cane", "staff"
    ],

    conditionWords: [
      "dirty", "filthy", "muddy", "dusty", "bloodied", "bloody", "blood-soaked",
      "soaked", "rain-soaked", "wet", "damp", "sweaty", "smudged", "smeared",
      "stained", "wine-stained", "rumpled", "wrinkled", "torn", "ripped", "singed",
      "burned", "charred", "soot-streaked", "ash-streaked", "bruised", "cut",
      "scratched", "bandaged", "disheveled", "dishevelled", "unkempt", "clean",
      "fresh", "freshly changed"
    ],

    resetOutfitSignals: [
      "changed into", "changes into", "now wearing", "now wears", "dressed in",
      "clad in", "fresh clothes", "freshly changed", "slipped into", "pulls on",
      "pulled on", "buttoned into"
    ],

    clearConditionSignals: [
      "washed off", "washed away", "cleaned up", "cleaned off", "changed clothes",
      "changed into", "showered", "bathed", "scrubbed clean", "fresh clothes",
      "freshly changed", "no longer dirty", "clean again"
    ]
  };

  function safeString(v) {
    return typeof v === "string" ? v : "";
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

  function escapeRegex(text) {
    return safeString(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function shorten(text, max) {
    const value = normalizeSpace(text);
    if (!value || value.length <= max) return value;
    return value.slice(0, Math.max(0, max - 1)).trimEnd() + "…";
  }

  function simpleHash(text) {
    const body = safeString(text);
    let hash = 0;
    for (let i = 0; i < body.length; i++) {
      hash = ((hash << 5) - hash + body.charCodeAt(i)) | 0;
    }
    return String(hash);
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
      if (typeof limit === "number" && next.length >= limit) break;
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
      if (typeof limit === "number" && kept.length >= limit) break;
    }

    return kept;
  }

  function compactList(list, maxItems, maxItemChars) {
    return dedupeList(list, maxItems)
      .slice(0, maxItems)
      .map(item => shorten(item, maxItemChars))
      .filter(Boolean);
  }

  function uniquePush(list, value, limit) {
    const clean = normalizeSpace(value);
    if (!clean) return Array.isArray(list) ? list : [];
    const next = Array.isArray(list) ? list.slice() : [];
    const exists = next.some(item => lower(item) === lower(clean));
    if (!exists) next.unshift(clean);
    return dedupeList(next, limit);
  }

  function removeListItems(list, predicate) {
    return (Array.isArray(list) ? list : []).filter(item => !predicate(lower(item), item));
  }

  function ensureCardsArray() {
    globalThis.storyCards ??= [];
    return storyCards;
  }

  function ensureState() {
    globalThis.state ??= {};
    state[APPEARANCE_CONFIG.stateKey] ??= {
      characters: {},
      processedTextHash: "",
      initialized: false
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

  function removeCard(title) {
    const cards = ensureCardsArray();
    const target = lower(title);
    for (let i = cards.length - 1; i >= 0; i--) {
      if (lower(cards[i]?.title) === target) {
        cards.splice(i, 1);
      }
    }
  }

  function upsertCard(cardConfig) {
    const cards = ensureCardsArray();
    let card = findCard(cardConfig.title);

    if (!card && typeof addStoryCard === "function") {
      try {
        addStoryCard("%@%");
        card = cards.find(c => c.title === "%@%") || null;
      } catch (_) {}
    }

    if (!card) {
      card = {
        title: "%@%",
        keys: "",
        entry: "",
        description: "",
        type: APPEARANCE_CONFIG.cardType
      };
      cards.unshift(card);
    }

    card.type = APPEARANCE_CONFIG.cardType;
    card.title = cardConfig.title;
    card.keys = cardConfig.keys;
    card.entry = cardConfig.entry;
    card.description = "";

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

  function sortWordsByLength(words) {
    return (Array.isArray(words) ? words : []).slice().sort((a, b) => b.length - a.length);
  }

  function normalizeFragment(text) {
    let value = normalizeSpace(text)
      .replace(/^[,;:()\-\s]+/, "")
      .replace(/[,;:()\-\s]+$/, "")
      .replace(/^\b(?:and|with|while|as|but)\b\s+/i, "")
      .replace(/^\b(?:is|was|looks|looks like|looked|appears|appeared|stands|stood|remains|seems|wearing|wears|wore|dressed in|clad in|changed into|changes into|slipped into|pulls on|pulled on)\b\s+/i, "")
      .replace(/^\b(?:still|now|currently)\b\s+/i, "");

    if (!value) return "";
    if (/^[a-z]$/i.test(value)) return "";
    return value;
  }

  function hasLexiconWord(text, words) {
    const body = lower(text);
    return (Array.isArray(words) ? words : []).some(word => body.includes(lower(word)));
  }

  function shouldTreatSegmentAsAppearance(segment) {
    return (
      hasLexiconWord(segment, APPEARANCE_CONFIG.garmentWords)
      || hasLexiconWord(segment, APPEARANCE_CONFIG.accessoryWords)
      || hasLexiconWord(segment, APPEARANCE_CONFIG.conditionWords)
      || /\b(?:wearing|wears|wore|dressed|clad|changed into|looks|looked|appears|appeared|barefoot|shirtless|gloved|masked)\b/i.test(segment)
    );
  }

  function extractOutfitPhrases(segment) {
    const phrases = [];
    const body = normalizeSpace(segment);

    const capturePatterns = [
      /\b(?:wearing|wears|wore|dressed in|clad in|changed into|changes into|slipped into|pulls on|pulled on|buttoned into)\b([^.!?\n]{0,80})/gi
    ];

    for (const pattern of capturePatterns) {
      let match;
      while ((match = pattern.exec(body))) {
        const clean = normalizeFragment(match[1])
          .replace(/^(?:a|an|the)\s+/i, "")
          .replace(/\b(?:still|now)\b\s*/gi, "")
          .replace(/\s{2,}/g, " ")
          .trim();
        if (clean && hasLexiconWord(clean, APPEARANCE_CONFIG.garmentWords.concat(APPEARANCE_CONFIG.accessoryWords))) {
          phrases.push(clean);
        }
      }
    }

    const garmentPattern = sortWordsByLength(APPEARANCE_CONFIG.garmentWords)
      .map(escapeRegex)
      .join("|");

    const nounPhrase = new RegExp(
      `(?:\\b(?:[a-zA-Z][a-zA-Z'’\\-]*\\s+){0,3}(?:${garmentPattern})\\b(?:\\s+(?:and|with)\\s+(?:[a-zA-Z][a-zA-Z'’\\-]*\\s+){0,3}(?:${garmentPattern})\\b)*)`,
      "gi"
    );

    let match;
    while ((match = nounPhrase.exec(body))) {
      let phrase = normalizeFragment(match[0])
        .replace(/\b(?:dirty|filthy|muddy|dusty|bloodied|bloody|blood-soaked|soaked|rain-soaked|wet|damp|sweaty|smudged|smeared|stained|wine-stained|rumpled|wrinkled|torn|ripped|singed|burned|charred|soot-streaked|ash-streaked|bruised|cut|scratched|bandaged|disheveled|dishevelled|unkempt|clean|fresh|freshly changed)\b/gi, "")
        .replace(/\s{2,}/g, " ")
        .replace(/^(?:a|an|the)\s+/i, "")
        .trim();

      if (phrase && hasLexiconWord(phrase, APPEARANCE_CONFIG.garmentWords)) {
        phrases.push(phrase);
      }
    }

    return dedupeSpecific(phrases, APPEARANCE_CONFIG.maxFragmentsPerBucket);
  }

  function extractConditionPhrases(segment) {
    const phrases = [];
    const body = normalizeSpace(segment);

    for (const term of sortWordsByLength(APPEARANCE_CONFIG.conditionWords)) {
      const rx = new RegExp(`\\b${escapeRegex(term)}\\b`, "i");
      if (rx.test(body)) phrases.push(term);
    }

    const patterned = body.match(/\b(?:blood|mud|dirt|soot|ash|wine)\s+(?:on|at|across|down)\s+[^,.;!?]{1,35}/gi) || [];
    phrases.push(...patterned);

    return dedupeSpecific(phrases.map(normalizeFragment), APPEARANCE_CONFIG.maxFragmentsPerBucket);
  }

  function extractDetailPhrases(segment) {
    const phrases = [];
    const body = normalizeSpace(segment);

    const direct = body.match(/\b(?:barefoot|shirtless|gloved|ungloved|masked|unmasked)\b/gi) || [];
    phrases.push(...direct);

    const detailPatterns = [
      /\b(?:hair|face|eyes|makeup|lipstick|mascara|stubble|beard|posture|stance|expression|scar|tattoo)\b[^,.;!?]{0,40}/gi,
      /[^,.;!?]{0,20}\b(?:scar|tattoo|bruise|cut)\b[^,.;!?]{0,20}/gi
    ];

    for (const pattern of detailPatterns) {
      const found = body.match(pattern) || [];
      phrases.push(...found);
    }

    return dedupeSpecific(phrases.map(normalizeFragment), 1);
  }

  function extractPatternFragments(segment, aliases) {
    const found = [];

    for (const alias of aliases) {
      const a = escapeRegex(alias);
      const patterns = [
        new RegExp(`\\b${a}\\b[^.!?\\n]{0,40}\\b(?:is|was|looks|looked|appears|appeared|stands|stood|remains|seems)\\b([^.!?\\n]{0,90})`, "i"),
        new RegExp(`\\b${a}\\b[^.!?\\n]{0,40}\\b(?:wearing|wears|wore|dressed in|clad in|now wearing|now wears|changed into|changes into|slipped into|pulls on|pulled on)\\b([^.!?\\n]{0,90})`, "i"),
        new RegExp(`\\b${a}'s\\b([^.!?\\n]{0,90})`, "i")
      ];

      for (const pattern of patterns) {
        const match = segment.match(pattern);
        if (match && match[1]) {
          found.push(match[1]);
        }
      }
    }

    return dedupeList(found.map(normalizeFragment).filter(Boolean), 4);
  }

  function bucketForFragment(fragment) {
    const body = lower(fragment);

    if (hasLexiconWord(body, APPEARANCE_CONFIG.conditionWords)) return "condition";
    if (hasLexiconWord(body, APPEARANCE_CONFIG.garmentWords) || hasLexiconWord(body, APPEARANCE_CONFIG.accessoryWords)) return "outfit";
    if (/\b(?:hair|face|eyes|makeup|lipstick|mascara|stubble|beard|scar|tattoo|bruise|cut|barefoot|shirtless)\b/i.test(fragment)) return "details";

    return null;
  }

  function buildRecentLabel(observations) {
    const bits = [];
    if (observations.outfit?.[0]) bits.push(`outfit ${shorten(observations.outfit[0], 18)}`);
    if (observations.condition?.[0]) bits.push(shorten(observations.condition[0], 18));
    if (observations.details?.[0]) bits.push(shorten(observations.details[0], 18));
    return shorten(bits.join(" | "), APPEARANCE_CONFIG.recentLabelMax);
  }

  function getCharacterState(characterId, create = true) {
    const root = ensureState();
    if (!root.characters[characterId] && create) {
      root.characters[characterId] = {
        outfit: [],
        condition: [],
        details: [],
        recent: [],
        lastSnippet: ""
      };
    }
    return root.characters[characterId] || null;
  }

  function hasMeaningfulState(stateEntry) {
    if (!stateEntry) return false;
    return Boolean(
      (stateEntry.outfit && stateEntry.outfit.length)
      || (stateEntry.condition && stateEntry.condition.length)
      || (stateEntry.details && stateEntry.details.length)
      || (APPEARANCE_CONFIG.includeRecent && stateEntry.recent && stateEntry.recent.length)
    );
  }

  function clearEphemeralCondition(stateEntry) {
    stateEntry.condition = removeListItems(stateEntry.condition, key => {
      return /(dirty|filthy|muddy|dusty|bloodied|bloody|blood-soaked|soaked|wet|damp|sweaty|smudged|smeared|stained|rumpled|wrinkled|torn|ripped|singed|charred|soot-streaked|ash-streaked|disheveled|dishevelled|unkempt)/i.test(key);
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

  function buildCharacterCardEntry(stateEntry) {
    const outfit = compactList(stateEntry.outfit, 2, 26);
    const condition = compactList(stateEntry.condition, 2, 24);
    const details = compactList(stateEntry.details, 1, 24);
    const recent = compactList(stateEntry.recent, 1, 32);

    const sections = [
      outfit.length ? `- ${APPEARANCE_CONFIG.bucketLabels.outfit}: ${outfit.join("; ")}.` : "",
      condition.length ? `- ${APPEARANCE_CONFIG.bucketLabels.condition}: ${condition.join("; ")}.` : "",
      details.length ? `- ${APPEARANCE_CONFIG.bucketLabels.details}: ${details.join("; ")}.` : "",
      APPEARANCE_CONFIG.includeRecent && recent.length ? `- ${APPEARANCE_CONFIG.bucketLabels.recent}: ${recent[0]}.` : ""
    ].filter(Boolean);

    let entry = sections.join("\n");

    if (!entry) entry = "- Appearance: no tracked changes yet.";

    if (entry.length > APPEARANCE_CONFIG.maxCardChars) {
      entry = sections.slice(0, 3).join("\n");
    }
    if (entry.length > APPEARANCE_CONFIG.maxCardChars && details.length) {
      entry = [
        outfit.length ? `- ${APPEARANCE_CONFIG.bucketLabels.outfit}: ${outfit.join("; ")}.` : "",
        condition.length ? `- ${APPEARANCE_CONFIG.bucketLabels.condition}: ${condition.join("; ")}.` : ""
      ].filter(Boolean).join("\n");
    }
    if (entry.length > APPEARANCE_CONFIG.maxCardChars) {
      entry = shorten(entry, APPEARANCE_CONFIG.maxCardChars);
    }

    return entry;
  }

  function refreshCharacterCard(character, options = {}) {
    const { allowEmpty = APPEARANCE_CONFIG.createEmptyCards } = options;
    const stateEntry = getCharacterState(character.id, false);

    if (!stateEntry || !hasMeaningfulState(stateEntry)) {
      if (!allowEmpty) {
        removeCard(character.cardTitle || `Appearance — ${character.name}`);
        return null;
      }
    }

    const entry = stateEntry
      ? buildCharacterCardEntry(stateEntry)
      : "- Appearance: no tracked changes yet.";

    return upsertCard({
      title: character.cardTitle || `Appearance — ${character.name}`,
      keys: character.cardKeys || [character.name].concat(character.aliases || []).join(", "),
      entry,
      pinned: !!APPEARANCE_CONFIG.pinCards
    });
  }

  function refreshAllTrackedCards() {
    for (const character of APPEARANCE_CONFIG.characters) {
      refreshCharacterCard(character, { allowEmpty: false });
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
    observations.details = dedupeList(observations.details, 1);

    return observations;
  }

  function applyObservations(character, observations) {
    const stateEntry = getCharacterState(character.id, true);
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

    if (changed && APPEARANCE_CONFIG.includeRecent) {
      const recentLabel = buildRecentLabel(observations);
      if (recentLabel) {
        stateEntry.recent = uniquePush(stateEntry.recent, recentLabel, APPEARANCE_CONFIG.maxLastObservations);
        stateEntry.lastSnippet = recentLabel;
      }
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
      if (
        !observations.outfit.length
        && !observations.condition.length
        && !observations.details.length
        && !observations.clearCondition
      ) {
        continue;
      }

      changed = applyObservations(character, observations) || changed;
    }

    if (changed) {
      refreshCharacterCard(character, { allowEmpty: false });
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
        const bucket = /^outfit$/i.test(match[1])
          ? "outfit"
          : /^condition$/i.test(match[1])
            ? "condition"
            : "details";

        const values = match[2]
          .split(/\s*;\s*/)
          .map(normalizeFragment)
          .filter(Boolean);

        observations[bucket].push(...values);
      } else if (/^\s*clear\s+condition\s*$/i.test(part)) {
        observations.clearCondition = true;
      } else if (/^\s*reset\s+outfit\s*$/i.test(part)) {
        observations.resetOutfit = true;
      }
    }

    observations.outfit = dedupeList(observations.outfit, APPEARANCE_CONFIG.maxFragmentsPerBucket);
    observations.condition = dedupeList(observations.condition, APPEARANCE_CONFIG.maxFragmentsPerBucket);
    observations.details = dedupeList(observations.details, 1);

    return observations;
  }

  function refreshCharacterById(characterId) {
    const character = configById(characterId);
    if (!character) return false;
    refreshCharacterCard(character, { allowEmpty: APPEARANCE_CONFIG.createEmptyCards });
    return true;
  }

  function resetCharacter(characterId) {
    const root = ensureState();

    if (!characterId) {
      root.characters = {};
      for (const character of APPEARANCE_CONFIG.characters) {
        removeCard(character.cardTitle || `Appearance — ${character.name}`);
      }
      return true;
    }

    const character = configById(characterId);
    if (!character) return false;

    delete root.characters[character.id];
    removeCard(character.cardTitle || `Appearance — ${character.name}`);
    return true;
  }

  function clearCharacterBucket(characterId, bucket) {
    const character = configById(characterId);
    if (!character) return false;
    if (!["outfit", "condition", "details", "recent"].includes(bucket)) return false;

    const stateEntry = getCharacterState(character.id, false);
    if (!stateEntry) return false;

    stateEntry[bucket] = [];
    if (bucket === "recent") stateEntry.lastSnippet = "";

    if (!hasMeaningfulState(stateEntry)) {
      removeCard(character.cardTitle || `Appearance — ${character.name}`);
    } else {
      refreshCharacterCard(character, { allowEmpty: false });
    }

    return true;
  }

  function addManualNote(characterId, noteText) {
    const character = configById(characterId);
    if (!character) return false;

    const observations = parseManualNote(noteText);
    const changed = applyObservations(character, observations);
    refreshCharacterCard(character, { allowEmpty: false });
    return changed;
  }

  function run(hook) {
    if (!APPEARANCE_CONFIG.runOnHooks.includes(hook)) return;
    scanLatestText(getLatestText());
  }

  globalThis.AppearanceDirector = {
    config: APPEARANCE_CONFIG,
    run,
    refresh(characterId) {
      if (characterId) return refreshCharacterById(characterId);
      refreshAllTrackedCards();
      return true;
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
    },
    getState(characterId) {
      const root = ensureState();
      if (!characterId) return root.characters;
      return root.characters[characterId] || null;
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
  }
})();
