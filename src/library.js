(function installAppearanceContinuityDirector() {
  "use strict";

  const APPEARANCE_CONFIG = {
    stateKey: "AppearanceDirector_State",
    cardType: "class",
    managedTitlePrefix: "Appearance — ",
    managedMarker: "[appearance-director:managed]",

    autoDiscover: true,
    discoverOnHooks: ["output"],
    createEmptyCards: false,
    pinCards: false,

    maxFragmentsPerBucket: 2,
    maxCardChars: 260,
    maxScanWindowChars: 180,
    includeRecent: false,
    maxRecentItems: 1,
    recentLabelMax: 40,

    candidateTypeAllowlist: ["character", "class"],
    titlePrefixes: ["Character — ", "Character - ", "Character:", "NPC — ", "NPC - ", "NPC:"],
    discoveryMarkers: ["[track-appearance]", "[appearance]"],

    explicitCharacters: [
      // Optional overrides. Example:
      // {
      //   id: "jordan",
      //   name: "Jordan Vale",
      //   aliases: ["Jordan", "Jordan Vale"],
      //   cardTitle: "Appearance — Jordan Vale",
      //   cardKeys: "Jordan, Jordan Vale"
      // }
    ],

    ignoreAliases: [
      "appearance", "outfit", "outfits", "clothes", "clothing", "look", "looks", "looking", "character",
      "npc", "person", "people", "world", "location", "quest", "objective", "milestone", "memory", "summary"
    ],

    garmentWords: [
      "coat", "jacket", "blazer", "suit", "shirt", "dress shirt", "tee", "t-shirt", "sweater", "cardigan",
      "hoodie", "vest", "waistcoat", "tie", "bow tie", "scarf", "cloak", "robe", "dress", "gown", "skirt",
      "pants", "trousers", "jeans", "leggings", "shorts", "boots", "heels", "shoes", "sneakers", "loafers",
      "sandals", "gloves", "stockings", "corset", "bodice", "uniform", "pajamas", "pyjamas", "nightgown",
      "jumpsuit", "belt", "sleeves", "cuffs"
    ],

    accessoryWords: [
      "ring", "rings", "necklace", "pendant", "earring", "earrings", "bracelet", "bracelets", "watch", "crown",
      "tiara", "glasses", "spectacles", "mask", "hat", "cap", "hood", "bag", "satchel", "flask", "cane", "staff"
    ],

    conditionWords: [
      "dirty", "filthy", "muddy", "dusty", "bloodied", "bloody", "blood-soaked", "soaked", "rain-soaked", "wet",
      "damp", "sweaty", "smudged", "smeared", "stained", "wine-stained", "rumpled", "wrinkled", "torn", "ripped",
      "singed", "burned", "charred", "soot-streaked", "ash-streaked", "bruised", "cut", "scratched", "bandaged",
      "disheveled", "dishevelled", "unkempt", "clean", "fresh", "freshly changed"
    ],

    resetOutfitSignals: [
      "changed into", "changes into", "now wearing", "now wears", "dressed in", "clad in", "fresh clothes",
      "freshly changed", "slipped into", "pulls on", "pulled on", "buttoned into"
    ],

    clearConditionSignals: [
      "washed off", "washed away", "cleaned up", "cleaned off", "changed clothes", "changed into", "showered",
      "bathed", "scrubbed clean", "fresh clothes", "freshly changed", "no longer dirty", "clean again"
    ]
  };

  function safeString(value) {
    return typeof value === "string" ? value : "";
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

  function slugify(text) {
    return lower(text)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "character";
  }

  function ensureCardsArray() {
    globalThis.storyCards ??= [];
    return storyCards;
  }

  function ensureState() {
    globalThis.state ??= {};
    state[APPEARANCE_CONFIG.stateKey] ??= {
      tracked: {},
      processedTextHash: "",
      discoveryHash: ""
    };
    return state[APPEARANCE_CONFIG.stateKey];
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

  function uniquePush(list, value, limit) {
    const clean = normalizeSpace(value);
    if (!clean) return Array.isArray(list) ? list : [];
    const next = Array.isArray(list) ? list.slice() : [];
    if (!next.some(item => lower(item) === lower(clean))) next.unshift(clean);
    return dedupeList(next, limit);
  }

  function compactList(list, maxItems, maxItemChars) {
    return dedupeList(list, maxItems)
      .slice(0, maxItems)
      .map(item => shorten(item, maxItemChars))
      .filter(Boolean);
  }

  function removeListItems(list, predicate) {
    return (Array.isArray(list) ? list : []).filter(item => !predicate(lower(item), item));
  }

  function simpleHash(text) {
    const body = safeString(text);
    let hash = 0;
    for (let i = 0; i < body.length; i++) {
      hash = ((hash << 5) - hash + body.charCodeAt(i)) | 0;
    }
    return String(hash);
  }

  function sortWordsByLength(words) {
    return (Array.isArray(words) ? words : []).slice().sort((a, b) => b.length - a.length);
  }

  function splitIntoSegments(text) {
    return safeString(text)
      .split(/(?<=[.!?\n])\s+|[\n\r]+/)
      .map(normalizeSpace)
      .filter(Boolean);
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

  function looksGenericAlias(text) {
    const value = lower(text);
    return !value || APPEARANCE_CONFIG.ignoreAliases.includes(value);
  }

  function stripPrefix(title) {
    let value = normalizeSpace(title);
    for (const prefix of APPEARANCE_CONFIG.titlePrefixes) {
      if (value.toLowerCase().startsWith(prefix.toLowerCase())) {
        value = normalizeSpace(value.slice(prefix.length));
        break;
      }
    }
    return value;
  }

  function looksLikeName(text) {
    const value = normalizeSpace(text);
    if (!value) return false;
    if (value.length > 40) return false;
    if (looksGenericAlias(value)) return false;
    if (!/^[A-Za-z0-9][A-Za-z0-9'’\- ]*[A-Za-z0-9]$/.test(value)) return false;
    const wordCount = value.split(/\s+/).length;
    return wordCount >= 1 && wordCount <= 4;
  }

  function parseKeyAliases(keys) {
    return safeString(keys)
      .split(",")
      .map(normalizeSpace)
      .filter(looksLikeName)
      .filter(alias => !looksGenericAlias(alias));
  }

  function isManagedAppearanceCard(card) {
    const title = lower(card?.title);
    const description = lower(card?.description);
    const entry = lower(card?.entry || card?.value);
    return title.startsWith(lower(APPEARANCE_CONFIG.managedTitlePrefix))
      || description.includes(lower(APPEARANCE_CONFIG.managedMarker))
      || entry.includes(lower(APPEARANCE_CONFIG.managedMarker));
  }

  function isCandidateCharacterCard(card) {
    if (!card || isManagedAppearanceCard(card)) return false;

    const title = normalizeSpace(card.title);
    const type = lower(card.type);
    const description = lower(card.description || "");
    const entry = lower(card.entry || card.value || "");

    if (!title) return false;
    if (APPEARANCE_CONFIG.candidateTypeAllowlist.includes(type)) return true;
    if (APPEARANCE_CONFIG.titlePrefixes.some(prefix => title.toLowerCase().startsWith(prefix.toLowerCase()))) return true;
    if (APPEARANCE_CONFIG.discoveryMarkers.some(marker => description.includes(lower(marker)) || entry.includes(lower(marker)))) return true;
    return false;
  }

  function buildDiscoveryHash() {
    const cards = ensureCardsArray();
    const parts = [];
    for (const card of cards) {
      if (!card || isManagedAppearanceCard(card)) continue;
      parts.push([
        normalizeSpace(card.title),
        normalizeSpace(card.type),
        normalizeSpace(card.keys),
        normalizeSpace(card.description || ""),
        normalizeSpace(card.entry || card.value || "")
      ].join("|"));
    }
    return simpleHash(parts.join("\n"));
  }

  function deriveTrackedCharacterFromCard(card) {
    const strippedTitle = stripPrefix(card.title);
    const displayName = strippedTitle || normalizeSpace(card.title);
    const aliases = dedupeList([displayName].concat(parseKeyAliases(card.keys)), 6)
      .filter(alias => !looksGenericAlias(alias));

    const id = slugify(displayName);

    return {
      id,
      name: displayName,
      aliases,
      cardTitle: `${APPEARANCE_CONFIG.managedTitlePrefix}${displayName}`,
      cardKeys: aliases.join(", "),
      source: "auto",
      sourceCardTitle: normalizeSpace(card.title)
    };
  }

  function getTrackedState(id, create = true) {
    const root = ensureState();
    if (!root.tracked[id] && create) {
      root.tracked[id] = {
        meta: null,
        appearance: {
          outfit: [],
          condition: [],
          details: [],
          recent: []
        }
      };
    }
    return root.tracked[id] || null;
  }

  function mergeCharacterMeta(existing, incoming) {
    if (!existing) return incoming;
    return {
      id: incoming.id || existing.id,
      name: incoming.name || existing.name,
      aliases: dedupeList((incoming.aliases || []).concat(existing.aliases || []), 8),
      cardTitle: incoming.cardTitle || existing.cardTitle,
      cardKeys: incoming.cardKeys || existing.cardKeys,
      source: incoming.source || existing.source,
      sourceCardTitle: incoming.sourceCardTitle || existing.sourceCardTitle
    };
  }

  function registerTrackedCharacter(meta) {
    if (!meta || !meta.id) return null;
    const tracked = getTrackedState(meta.id, true);
    tracked.meta = mergeCharacterMeta(tracked.meta, meta);
    return tracked.meta;
  }

  function discoverCharacters(force) {
    const root = ensureState();
    const currentHash = buildDiscoveryHash();
    if (!force && root.discoveryHash === currentHash) return false;
    root.discoveryHash = currentHash;

    const discovered = new Map();

    for (const explicit of APPEARANCE_CONFIG.explicitCharacters) {
      if (!explicit || !explicit.id) continue;
      const meta = {
        id: explicit.id,
        name: explicit.name || explicit.id,
        aliases: dedupeList((explicit.aliases || []).concat([explicit.name || explicit.id]), 8),
        cardTitle: explicit.cardTitle || `${APPEARANCE_CONFIG.managedTitlePrefix}${explicit.name || explicit.id}`,
        cardKeys: explicit.cardKeys || dedupeList((explicit.aliases || []).concat([explicit.name || explicit.id]), 8).join(", "),
        source: "config",
        sourceCardTitle: explicit.sourceCardTitle || ""
      };
      discovered.set(meta.id, meta);
    }

    if (APPEARANCE_CONFIG.autoDiscover) {
      for (const card of ensureCardsArray()) {
        if (!isCandidateCharacterCard(card)) continue;
        const meta = deriveTrackedCharacterFromCard(card);
        const existing = discovered.get(meta.id);
        discovered.set(meta.id, mergeCharacterMeta(existing, meta));
      }
    }

    for (const meta of discovered.values()) {
      registerTrackedCharacter(meta);
    }

    return true;
  }

  function resolveCharacter(query) {
    const root = ensureState();
    if (!query) return null;
    const target = lower(query);
    for (const tracked of Object.values(root.tracked)) {
      const meta = tracked?.meta;
      if (!meta) continue;
      if (lower(meta.id) === target) return meta;
      if (lower(meta.name) === target) return meta;
      if (lower(meta.cardTitle) === target) return meta;
      if ((meta.aliases || []).some(alias => lower(alias) === target)) return meta;
    }
    return null;
  }

  function aliasRegexes(aliases) {
    return dedupeList(aliases, 8)
      .map(alias => new RegExp(`\\b${escapeRegex(alias)}\\b`, "i"));
  }

  function segmentMentionsCharacter(segment, meta) {
    return aliasRegexes(meta.aliases || []).some(rx => rx.test(segment));
  }

  function textHasAny(text, terms) {
    const body = lower(text);
    return (Array.isArray(terms) ? terms : []).some(term => body.includes(lower(term)));
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
      const phrase = normalizeFragment(match[0])
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

    for (const alias of aliases || []) {
      const a = escapeRegex(alias);
      const patterns = [
        new RegExp(`\\b${a}\\b[^.!?\\n]{0,40}\\b(?:is|was|looks|looked|appears|appeared|stands|stood|remains|seems)\\b([^.!?\\n]{0,90})`, "i"),
        new RegExp(`\\b${a}\\b[^.!?\\n]{0,40}\\b(?:wearing|wears|wore|dressed in|clad in|now wearing|now wears|changed into|changes into|slipped into|pulls on|pulled on)\\b([^.!?\\n]{0,90})`, "i"),
        new RegExp(`\\b${a}'s\\b([^.!?\\n]{0,90})`, "i")
      ];

      for (const pattern of patterns) {
        const match = segment.match(pattern);
        if (match && match[1]) found.push(match[1]);
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

  function hasMeaningfulAppearance(stateEntry) {
    if (!stateEntry) return false;
    return Boolean(
      stateEntry.outfit?.length
      || stateEntry.condition?.length
      || stateEntry.details?.length
      || (APPEARANCE_CONFIG.includeRecent && stateEntry.recent?.length)
    );
  }

  function clearEphemeralCondition(stateEntry) {
    stateEntry.condition = removeListItems(stateEntry.condition, key => /(dirty|filthy|muddy|dusty|bloodied|bloody|blood-soaked|soaked|wet|damp|sweaty|smudged|smeared|stained|rumpled|wrinkled|torn|ripped|singed|charred|soot-streaked|ash-streaked|disheveled|dishevelled|unkempt)/i.test(key));
  }

  function replaceBucket(stateEntry, bucket, values) {
    stateEntry[bucket] = dedupeList(values, APPEARANCE_CONFIG.maxFragmentsPerBucket);
  }

  function mergeBucket(stateEntry, bucket, values, limit) {
    let next = Array.isArray(stateEntry[bucket]) ? stateEntry[bucket].slice() : [];
    for (const value of values) {
      next = uniquePush(next, value, typeof limit === "number" ? limit : APPEARANCE_CONFIG.maxFragmentsPerBucket);
    }
    stateEntry[bucket] = dedupeList(next, typeof limit === "number" ? limit : APPEARANCE_CONFIG.maxFragmentsPerBucket);
  }

  function findCard(title) {
    const target = lower(title);
    return ensureCardsArray().find(card => lower(card?.title) === target) || null;
  }

  function removeManagedCard(title) {
    const cards = ensureCardsArray();
    const target = lower(title);
    for (let i = cards.length - 1; i >= 0; i--) {
      if (lower(cards[i]?.title) === target) cards.splice(i, 1);
    }
  }

  function upsertManagedCard(meta, entry) {
    const cards = ensureCardsArray();
    let card = findCard(meta.cardTitle);

    if (!card && typeof addStoryCard === "function") {
      try {
        addStoryCard("%@%");
        card = cards.find(c => c.title === "%@%") || null;
      } catch (_) {}
    }

    if (!card) {
      card = { title: "%@%", keys: "", entry: "", description: "", type: APPEARANCE_CONFIG.cardType };
      cards.unshift(card);
    }

    card.type = APPEARANCE_CONFIG.cardType;
    card.title = meta.cardTitle;
    card.keys = meta.cardKeys;
    card.entry = entry;
    card.description = APPEARANCE_CONFIG.managedMarker;

    if (APPEARANCE_CONFIG.pinCards) {
      const index = cards.indexOf(card);
      if (index > 0) {
        cards.splice(index, 1);
        cards.unshift(card);
      }
    }

    return card;
  }

  function buildManagedCardEntry(appearance) {
    const outfit = compactList(appearance.outfit, 2, 26);
    const condition = compactList(appearance.condition, 2, 24);
    const details = compactList(appearance.details, 1, 24);
    const recent = compactList(appearance.recent, 1, 32);

    const sections = [
      outfit.length ? `- Outfit: ${outfit.join("; ")}.` : "",
      condition.length ? `- Condition: ${condition.join("; ")}.` : "",
      details.length ? `- Details: ${details.join("; ")}.` : "",
      APPEARANCE_CONFIG.includeRecent && recent.length ? `- Recent: ${recent[0]}.` : ""
    ].filter(Boolean);

    let entry = sections.join("\n");
    if (!entry) entry = "- Appearance: no tracked changes yet.";
    if (entry.length > APPEARANCE_CONFIG.maxCardChars) entry = sections.slice(0, 3).join("\n");
    if (entry.length > APPEARANCE_CONFIG.maxCardChars && details.length) {
      entry = [
        outfit.length ? `- Outfit: ${outfit.join("; ")}.` : "",
        condition.length ? `- Condition: ${condition.join("; ")}.` : ""
      ].filter(Boolean).join("\n");
    }
    if (entry.length > APPEARANCE_CONFIG.maxCardChars) entry = shorten(entry, APPEARANCE_CONFIG.maxCardChars);
    return entry;
  }

  function refreshManagedCard(query) {
    const meta = typeof query === "string" ? resolveCharacter(query) : query;
    if (!meta) return false;

    const tracked = getTrackedState(meta.id, false);
    if (!tracked || !hasMeaningfulAppearance(tracked.appearance)) {
      if (!APPEARANCE_CONFIG.createEmptyCards) {
        removeManagedCard(meta.cardTitle);
        return true;
      }
    }

    const entry = tracked ? buildManagedCardEntry(tracked.appearance) : "- Appearance: no tracked changes yet.";
    upsertManagedCard(meta, entry);
    return true;
  }

  function refreshAllManagedCards() {
    const root = ensureState();
    for (const tracked of Object.values(root.tracked)) {
      if (tracked?.meta) refreshManagedCard(tracked.meta);
    }
    return true;
  }

  function inferObservations(segment, meta) {
    const observations = {
      outfit: [],
      condition: [],
      details: [],
      resetOutfit: false,
      clearCondition: false
    };

    const normalizedSegment = normalizeSpace(segment).slice(0, APPEARANCE_CONFIG.maxScanWindowChars);
    const fragments = extractPatternFragments(normalizedSegment, meta.aliases || []);

    observations.resetOutfit = textHasAny(normalizedSegment, APPEARANCE_CONFIG.resetOutfitSignals);
    observations.clearCondition = textHasAny(normalizedSegment, APPEARANCE_CONFIG.clearConditionSignals);
    observations.outfit.push(...extractOutfitPhrases(normalizedSegment));
    observations.condition.push(...extractConditionPhrases(normalizedSegment));
    observations.details.push(...extractDetailPhrases(normalizedSegment));

    if (!observations.outfit.length && !observations.condition.length && !observations.details.length) {
      for (const fragment of fragments) {
        const bucket = bucketForFragment(fragment);
        const clean = normalizeFragment(fragment);
        if (bucket && clean) observations[bucket].push(clean);
      }
    }

    observations.outfit = dedupeList(observations.outfit, APPEARANCE_CONFIG.maxFragmentsPerBucket);
    observations.condition = dedupeList(observations.condition, APPEARANCE_CONFIG.maxFragmentsPerBucket);
    observations.details = dedupeList(observations.details, 1);
    return observations;
  }

  function applyObservations(meta, observations) {
    const tracked = getTrackedState(meta.id, true);
    tracked.meta = mergeCharacterMeta(tracked.meta, meta);

    let changed = false;
    const appearance = tracked.appearance;

    if (observations.clearCondition) {
      const before = JSON.stringify(appearance.condition);
      clearEphemeralCondition(appearance);
      changed ||= before !== JSON.stringify(appearance.condition);
    }

    if (observations.outfit.length) {
      const before = JSON.stringify(appearance.outfit);
      if (observations.resetOutfit) replaceBucket(appearance, "outfit", observations.outfit);
      else mergeBucket(appearance, "outfit", observations.outfit);
      changed ||= before !== JSON.stringify(appearance.outfit);
    }

    if (observations.condition.length) {
      const before = JSON.stringify(appearance.condition);
      mergeBucket(appearance, "condition", observations.condition);
      changed ||= before !== JSON.stringify(appearance.condition);
    }

    if (observations.details.length) {
      const before = JSON.stringify(appearance.details);
      mergeBucket(appearance, "details", observations.details, 1);
      changed ||= before !== JSON.stringify(appearance.details);
    }

    if (changed && APPEARANCE_CONFIG.includeRecent) {
      const recentLabel = buildRecentLabel(observations);
      if (recentLabel) appearance.recent = uniquePush(appearance.recent, recentLabel, APPEARANCE_CONFIG.maxRecentItems);
    }

    return changed;
  }

  function scanTrackedCharacter(meta, text) {
    const segments = splitIntoSegments(text);
    let changed = false;

    for (const segment of segments) {
      if (!segmentMentionsCharacter(segment, meta)) continue;
      if (!shouldTreatSegmentAsAppearance(segment)) continue;

      const observations = inferObservations(segment, meta);
      if (!observations.outfit.length && !observations.condition.length && !observations.details.length && !observations.clearCondition) continue;
      changed = applyObservations(meta, observations) || changed;
    }

    if (changed) refreshManagedCard(meta);
    return changed;
  }

  function getLatestText() {
    if (normalizeSpace(globalThis.text)) return globalThis.text;
    const last = Array.isArray(globalThis.history) ? history[history.length - 1] : null;
    return safeString(last?.text || last?.rawText);
  }

  function scanLatestText(text) {
    const body = normalizeSpace(text);
    if (!body) return false;

    discoverCharacters(false);

    const root = ensureState();
    const hash = simpleHash(body);
    if (root.processedTextHash === hash) return false;
    root.processedTextHash = hash;

    let anyChanged = false;
    for (const tracked of Object.values(root.tracked)) {
      if (!tracked?.meta) continue;
      anyChanged = scanTrackedCharacter(tracked.meta, body) || anyChanged;
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
    observations.details = dedupeList(observations.details, 1);
    return observations;
  }

  function resetCharacter(query) {
    const root = ensureState();
    if (!query) {
      for (const tracked of Object.values(root.tracked)) {
        if (tracked?.meta?.cardTitle) removeManagedCard(tracked.meta.cardTitle);
      }
      root.tracked = {};
      root.processedTextHash = "";
      root.discoveryHash = "";
      return true;
    }

    const meta = resolveCharacter(query);
    if (!meta) return false;
    removeManagedCard(meta.cardTitle);
    delete root.tracked[meta.id];
    return true;
  }

  function clearCharacterBucket(query, bucket) {
    const meta = resolveCharacter(query);
    if (!meta) return false;
    if (!["outfit", "condition", "details", "recent"].includes(bucket)) return false;
    const tracked = getTrackedState(meta.id, false);
    if (!tracked) return false;

    tracked.appearance[bucket] = [];
    if (!hasMeaningfulAppearance(tracked.appearance)) removeManagedCard(meta.cardTitle);
    else refreshManagedCard(meta);
    return true;
  }

  function addManualNote(query, noteText) {
    discoverCharacters(false);
    const meta = resolveCharacter(query);
    if (!meta) return false;
    const observations = parseManualNote(noteText);
    applyObservations(meta, observations);
    refreshManagedCard(meta);
    return true;
  }

  function rescanCharacters() {
    const changed = discoverCharacters(true);
    return changed;
  }

  function run(hook) {
    if (APPEARANCE_CONFIG.discoverOnHooks.includes(hook)) discoverCharacters(false);
    if (hook === "output") scanLatestText(getLatestText());
  }

  globalThis.AppearanceDirector = {
    config: APPEARANCE_CONFIG,
    run,
    rescan() {
      return rescanCharacters();
    },
    refresh(query) {
      discoverCharacters(false);
      if (query) return refreshManagedCard(query);
      return refreshAllManagedCards();
    },
    reset(query) {
      return resetCharacter(query || "");
    },
    clear(query, bucket) {
      return clearCharacterBucket(query, bucket);
    },
    note(query, noteText) {
      return addManualNote(query, noteText);
    },
    scan(textOverride) {
      return scanLatestText(safeString(textOverride));
    },
    getCharacters() {
      discoverCharacters(false);
      const root = ensureState();
      return Object.values(root.tracked).map(item => item.meta).filter(Boolean);
    },
    getState(query) {
      discoverCharacters(false);
      if (!query) return ensureState().tracked;
      const meta = resolveCharacter(query);
      if (!meta) return null;
      return getTrackedState(meta.id, false);
    }
  };

  if (typeof globalThis.InnerSelf === "function" && !globalThis.InnerSelf.__appearanceDirectorWrapped) {
    const original = globalThis.InnerSelf;
    const wrapped = function(hook) {
      const result = original(hook);
      try { globalThis.AppearanceDirector.run(hook); } catch (_) {}
      return result;
    };
    wrapped.__appearanceDirectorWrapped = true;
    globalThis.InnerSelf = wrapped;
  }
})();
