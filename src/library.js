(function installAppearanceContinuityDirector() {
  "use strict";

  var APPEARANCE_CONFIG = {
    stateKey: "AppearanceDirector_State",
    cardType: "class",
    managedTitlePrefix: "Appearance - ",
    managedMarker: "[appearance-director:managed]",

    trackTitlePrefixes: ["Character - ", "NPC - "],
    trackTypeAllowlist: ["character"],
    discoveryMarkers: ["[track-appearance]", "[appearance]"],

    createEmptyCards: false,
    pinCards: false,

    maxFragmentsPerBucket: 2,
    maxCardChars: 260,
    maxScanWindowChars: 180,
    includeRecent: false,
    maxRecentItems: 1,
    recentLabelMax: 40,

    commandPrefix: "/",
    enableInputCommands: true,

    ignoreAliases: [
      "appearance", "outfit", "outfits", "clothes", "clothing", "look", "looks", "looking",
      "character", "npc", "person", "people", "world", "location", "quest", "objective",
      "milestone", "memory", "summary"
    ],

    garmentWords: [
      "coat", "jacket", "blazer", "suit", "shirt", "dress shirt", "tee", "t-shirt", "sweater", "cardigan",
      "hoodie", "vest", "waistcoat", "tie", "bow tie", "scarf", "cloak", "robe", "dress", "gown", "skirt",
      "pants", "trousers", "jeans", "leggings", "shorts", "boots", "heels", "shoes", "sneakers", "loafers",
      "sandals", "gloves", "stockings", "corset", "bodice", "uniform", "pajamas", "pyjamas", "nightgown",
      "jumpsuit", "belt", "sleeves", "cuffs"
    ],

    accessoryWords: [
      "ring", "rings", "necklace", "pendant", "earring", "earrings", "bracelet", "bracelets", "watch",
      "crown", "tiara", "glasses", "spectacles", "mask", "hat", "cap", "hood", "bag", "satchel", "flask",
      "cane", "staff"
    ],

    conditionWords: [
      "dirty", "filthy", "muddy", "dusty", "bloodied", "bloody", "blood-soaked", "soaked", "rain-soaked",
      "wet", "damp", "sweaty", "smudged", "smeared", "stained", "wine-stained", "rumpled", "wrinkled",
      "torn", "ripped", "singed", "burned", "charred", "soot-streaked", "ash-streaked", "bruised", "cut",
      "scratched", "bandaged", "disheveled", "dishevelled", "unkempt", "clean", "fresh", "freshly changed"
    ],

    resetOutfitSignals: [
      "changed into", "changes into", "now wearing", "now wears", "dressed in", "clad in",
      "fresh clothes", "freshly changed", "slipped into", "pulls on", "pulled on", "buttoned into"
    ],

    clearConditionSignals: [
      "washed off", "washed away", "cleaned up", "cleaned off", "changed clothes", "changed into",
      "showered", "bathed", "scrubbed clean", "fresh clothes", "freshly changed", "no longer dirty", "clean again"
    ]
  };

  function safeString(value) {
    return typeof value === "string" ? value : "";
  }

  function trimRight(text) {
    return safeString(text).replace(/\s+$/, "");
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

  function startsWithIgnoreCase(text, prefix) {
    text = safeString(text).toLowerCase();
    prefix = safeString(prefix).toLowerCase();
    return text.slice(0, prefix.length) === prefix;
  }

  function shorten(text, max) {
    var value = normalizeSpace(text);
    if (!value || value.length <= max) return value;
    return trimRight(value.slice(0, Math.max(0, max - 1))) + "…";
  }

  function slugify(text) {
    var value = lower(text).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return value || "character";
  }

  function ensureCardsArray() {
    if (!globalThis.storyCards) globalThis.storyCards = [];
    return globalThis.storyCards;
  }

  function ensureState() {
    if (!globalThis.state) globalThis.state = {};
    if (!state[APPEARANCE_CONFIG.stateKey]) {
      state[APPEARANCE_CONFIG.stateKey] = {
        tracked: {},
        processedTextHash: "",
        cardSignature: ""
      };
    }
    return state[APPEARANCE_CONFIG.stateKey];
  }

  function getCardText(card) {
    if (!card || typeof card !== "object") return "";
    if (typeof card.entry === "string") return card.entry;
    if (typeof card.value === "string") return card.value;
    return "";
  }

  function getCardTitle(card) {
    if (!card || typeof card !== "object") return "";
    if (typeof card.title === "string") return card.title;
    if (typeof card.name === "string") return card.name;
    return "";
  }

  function getCardKeys(card) {
    if (!card || typeof card !== "object") return "";
    if (typeof card.keys === "string") return card.keys;
    if (typeof card.triggers === "string") return card.triggers;
    return "";
  }

  function dedupeList(list, limit) {
    var next = [];
    var seen = {};
    var i, item, clean, key;

    list = Array.isArray(list) ? list : [];
    for (i = 0; i < list.length; i++) {
      item = list[i];
      clean = normalizeSpace(item);
      if (!clean) continue;
      key = lower(clean);
      if (seen[key]) continue;
      seen[key] = true;
      next.push(clean);
      if (typeof limit === "number" && next.length >= limit) break;
    }

    return next;
  }

  function dedupeSpecific(list, limit) {
    var sorted = dedupeList(list, 50).sort(function(a, b) {
      return b.length - a.length;
    });
    var kept = [];
    var i, item, key, skip, j;

    for (i = 0; i < sorted.length; i++) {
      item = sorted[i];
      key = lower(item);
      skip = false;

      for (j = 0; j < kept.length; j++) {
        if (lower(kept[j]).indexOf(key) !== -1 && lower(kept[j]) !== key) {
          skip = true;
          break;
        }
      }

      if (skip) continue;
      kept.push(item);
      if (typeof limit === "number" && kept.length >= limit) break;
    }

    return kept;
  }

  function uniquePush(list, value, limit) {
    var clean = normalizeSpace(value);
    var next = Array.isArray(list) ? list.slice() : [];
    var i;

    if (!clean) return next;

    for (i = 0; i < next.length; i++) {
      if (lower(next[i]) === lower(clean)) return dedupeList(next, limit);
    }

    next.unshift(clean);
    return dedupeList(next, limit);
  }

  function compactList(list, maxItems, maxItemChars) {
    var items = dedupeList(list, maxItems).slice(0, maxItems);
    var out = [];
    var i;

    for (i = 0; i < items.length; i++) {
      out.push(shorten(items[i], maxItemChars));
    }

    return out.filter(Boolean);
  }

  function removeListItems(list, predicate) {
    var source = Array.isArray(list) ? list : [];
    var out = [];
    var i, item;

    for (i = 0; i < source.length; i++) {
      item = source[i];
      if (!predicate(lower(item), item)) out.push(item);
    }

    return out;
  }

  function simpleHash(text) {
    var body = safeString(text);
    var hash = 0;
    var i;

    for (i = 0; i < body.length; i++) {
      hash = ((hash << 5) - hash + body.charCodeAt(i)) | 0;
    }

    return String(hash);
  }

  function sortWordsByLength(words) {
    return (Array.isArray(words) ? words : []).slice().sort(function(a, b) {
      return b.length - a.length;
    });
  }

  function splitIntoSegments(text) {
    var body = safeString(text)
      .replace(/[\r\n]+/g, "\n")
      .replace(/([.!?])\s+/g, "$1\n");

    return body.split(/\n+/).map(normalizeSpace).filter(Boolean);
  }

  function normalizeFragment(text) {
    var value = normalizeSpace(text)
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
    var body = lower(text);
    var i;

    words = Array.isArray(words) ? words : [];
    for (i = 0; i < words.length; i++) {
      if (body.indexOf(lower(words[i])) !== -1) return true;
    }
    return false;
  }

  function looksGenericAlias(text) {
    var value = lower(text);
    return !value || APPEARANCE_CONFIG.ignoreAliases.indexOf(value) !== -1;
  }

  function stripPrefix(title) {
    var value = normalizeSpace(title);
    var i, prefix;

    for (i = 0; i < APPEARANCE_CONFIG.trackTitlePrefixes.length; i++) {
      prefix = APPEARANCE_CONFIG.trackTitlePrefixes[i];
      if (startsWithIgnoreCase(value, prefix)) {
        value = normalizeSpace(value.slice(prefix.length));
        break;
      }
    }

    return value;
  }

  function looksLikeName(text) {
    var value = normalizeSpace(text);
    var wordCount;

    if (!value) return false;
    if (value.length > 60) return false;
    if (looksGenericAlias(value)) return false;
    if (!/^[A-Za-z0-9][A-Za-z0-9'’\- ]*[A-Za-z0-9]$/.test(value)) return false;

    wordCount = value.split(/\s+/).length;
    return wordCount >= 1 && wordCount <= 6;
  }

  function parseKeyAliases(keys) {
    return safeString(keys)
      .split(",")
      .map(normalizeSpace)
      .filter(looksLikeName)
      .filter(function(alias) {
        return !looksGenericAlias(alias);
      });
  }

  function cardHasDiscoveryMarker(card) {
    var description = lower(card && card.description);
    var entry = lower(getCardText(card));
    var i, marker;

    for (i = 0; i < APPEARANCE_CONFIG.discoveryMarkers.length; i++) {
      marker = lower(APPEARANCE_CONFIG.discoveryMarkers[i]);
      if (description.indexOf(marker) !== -1 || entry.indexOf(marker) !== -1) return true;
    }

    return false;
  }

  function isManagedAppearanceCard(card) {
    var title = lower(getCardTitle(card));
    var description = lower(card && card.description);
    var entry = lower(getCardText(card));

    return startsWithIgnoreCase(title, APPEARANCE_CONFIG.managedTitlePrefix) ||
      description.indexOf(lower(APPEARANCE_CONFIG.managedMarker)) !== -1 ||
      entry.indexOf(lower(APPEARANCE_CONFIG.managedMarker)) !== -1;
  }

  function isTrackableCharacterCard(card) {
    var title, stripped, type, i;

    if (!card || isManagedAppearanceCard(card)) return false;

    title = normalizeSpace(getCardTitle(card));
    type = lower(card && card.type);
    if (!title) return false;

    for (i = 0; i < APPEARANCE_CONFIG.trackTitlePrefixes.length; i++) {
      if (startsWithIgnoreCase(title, APPEARANCE_CONFIG.trackTitlePrefixes[i])) {
        stripped = stripPrefix(title);
        return looksLikeName(stripped);
      }
    }

    if (APPEARANCE_CONFIG.trackTypeAllowlist.indexOf(type) !== -1 && looksLikeName(title)) {
      return true;
    }

    if (cardHasDiscoveryMarker(card) && looksLikeName(title)) {
      return true;
    }

    return false;
  }

  function buildMetaFromCharacterCard(card) {
    var sourceTitle = normalizeSpace(getCardTitle(card));
    var displayName = stripPrefix(sourceTitle);
    var aliases;
    var keyAliases;

    if (!displayName) displayName = sourceTitle;

    keyAliases = parseKeyAliases(getCardKeys(card));
    aliases = dedupeList([displayName].concat(keyAliases), 8).filter(function(alias) {
      return !looksGenericAlias(alias);
    });

    if (aliases.length === 0 && displayName) aliases = [displayName];

    return {
      id: slugify(displayName),
      name: displayName,
      aliases: aliases,
      cardTitle: APPEARANCE_CONFIG.managedTitlePrefix + displayName,
      cardKeys: aliases.join(", "),
      sourceCardTitle: sourceTitle
    };
  }

  function getTrackedState(id, create) {
    var root = ensureState();
    if (create !== false && !root.tracked[id]) {
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

  function buildTrackedRegistrySignature() {
    var cards = ensureCardsArray();
    var parts = [];
    var i, card;

    for (i = 0; i < cards.length; i++) {
      card = cards[i];
      if (!card || isManagedAppearanceCard(card)) continue;
      parts.push([
        normalizeSpace(getCardTitle(card)),
        normalizeSpace(card && card.type),
        normalizeSpace(getCardKeys(card)),
        normalizeSpace(getCardText(card)),
        normalizeSpace(card && card.description)
      ].join("|"));
    }

    return simpleHash(parts.join("\n"));
  }

  function refreshTrackedRegistry(force) {
    var root = ensureState();
    var cards = ensureCardsArray();
    var nextTracked = {};
    var signature = buildTrackedRegistrySignature();
    var i, card, meta, existing;

    if (!force && root.cardSignature === signature) return false;
    root.cardSignature = signature;

    for (i = 0; i < cards.length; i++) {
      card = cards[i];
      if (!isTrackableCharacterCard(card)) continue;

      meta = buildMetaFromCharacterCard(card);
      existing = root.tracked[meta.id];

      nextTracked[meta.id] = {
        meta: existing && existing.meta ? {
          id: meta.id,
          name: meta.name,
          aliases: dedupeList((meta.aliases || []).concat(existing.meta.aliases || []), 8),
          cardTitle: meta.cardTitle,
          cardKeys: meta.cardKeys,
          sourceCardTitle: meta.sourceCardTitle
        } : meta,
        appearance: existing && existing.appearance ? existing.appearance : {
          outfit: [],
          condition: [],
          details: [],
          recent: []
        }
      };
    }

    root.tracked = nextTracked;
    return true;
  }

  function resolveCharacter(query) {
    var root = ensureState();
    var target = lower(query);
    var key, tracked, meta, i;

    if (!query) return null;

    for (key in root.tracked) {
      if (!Object.prototype.hasOwnProperty.call(root.tracked, key)) continue;
      tracked = root.tracked[key];
      meta = tracked && tracked.meta;
      if (!meta) continue;

      if (lower(meta.id) === target) return meta;
      if (lower(meta.name) === target) return meta;
      if (lower(meta.cardTitle) === target) return meta;
      if (lower(meta.sourceCardTitle) === target) return meta;

      for (i = 0; i < (meta.aliases || []).length; i++) {
        if (lower(meta.aliases[i]) === target) return meta;
      }
    }

    return null;
  }

  function aliasRegexes(aliases) {
    var list = dedupeList(aliases, 8);
    var out = [];
    var i;

    for (i = 0; i < list.length; i++) {
      out.push(new RegExp("\\b" + escapeRegex(list[i]) + "\\b", "i"));
    }

    return out;
  }

  function segmentMentionsCharacter(segment, meta) {
    var regexes = aliasRegexes(meta.aliases || []);
    var i;

    for (i = 0; i < regexes.length; i++) {
      if (regexes[i].test(segment)) return true;
    }

    return false;
  }

  function textHasAny(text, terms) {
    var body = lower(text);
    var i;

    terms = Array.isArray(terms) ? terms : [];
    for (i = 0; i < terms.length; i++) {
      if (body.indexOf(lower(terms[i])) !== -1) return true;
    }

    return false;
  }

  function shouldTreatSegmentAsAppearance(segment) {
    return hasLexiconWord(segment, APPEARANCE_CONFIG.garmentWords) ||
      hasLexiconWord(segment, APPEARANCE_CONFIG.accessoryWords) ||
      hasLexiconWord(segment, APPEARANCE_CONFIG.conditionWords) ||
      /\b(?:wearing|wears|wore|dressed|clad|changed into|looks|looked|appears|appeared|barefoot|shirtless|gloved|masked)\b/i.test(segment);
  }

  function extractOutfitPhrases(segment) {
    var phrases = [];
    var body = normalizeSpace(segment);
    var capturePatterns = [
      /\b(?:wearing|wears|wore|dressed in|clad in|changed into|changes into|slipped into|pulls on|pulled on|buttoned into)\b([^.!?\n]{0,80})/gi
    ];
    var i, pattern, match;
    var garmentPattern, nounPhrase, phrase;

    for (i = 0; i < capturePatterns.length; i++) {
      pattern = capturePatterns[i];
      while ((match = pattern.exec(body))) {
        phrase = normalizeFragment(match[1])
          .replace(/^(?:a|an|the)\s+/i, "")
          .replace(/\b(?:still|now)\b\s*/gi, "")
          .replace(/\s{2,}/g, " ")
          .trim();

        if (phrase && hasLexiconWord(phrase, APPEARANCE_CONFIG.garmentWords.concat(APPEARANCE_CONFIG.accessoryWords))) {
          phrases.push(phrase);
        }
      }
    }

    garmentPattern = sortWordsByLength(APPEARANCE_CONFIG.garmentWords).map(escapeRegex).join("|");
    nounPhrase = new RegExp(
      "(?:\\b(?:[a-zA-Z][a-zA-Z'’\\-]*\\s+){0,3}(?:" + garmentPattern + ")\\b(?:\\s+(?:and|with)\\s+(?:[a-zA-Z][a-zA-Z'’\\-]*\\s+){0,3}(?:" + garmentPattern + ")\\b)*)",
      "gi"
    );

    while ((match = nounPhrase.exec(body))) {
      phrase = normalizeFragment(match[0])
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
    var phrases = [];
    var body = normalizeSpace(segment);
    var terms = sortWordsByLength(APPEARANCE_CONFIG.conditionWords);
    var i, rx, patterned, j;

    for (i = 0; i < terms.length; i++) {
      rx = new RegExp("\\b" + escapeRegex(terms[i]) + "\\b", "i");
      if (rx.test(body)) phrases.push(terms[i]);
    }

    patterned = body.match(/\b(?:blood|mud|dirt|soot|ash|wine)\s+(?:on|at|across|down)\s+[^,.;!?]{1,35}/gi) || [];
    for (j = 0; j < patterned.length; j++) {
      phrases.push(patterned[j]);
    }

    return dedupeSpecific(phrases.map(normalizeFragment), APPEARANCE_CONFIG.maxFragmentsPerBucket);
  }

  function extractDetailPhrases(segment) {
    var phrases = [];
    var body = normalizeSpace(segment);
    var direct = body.match(/\b(?:barefoot|shirtless|gloved|ungloved|masked|unmasked)\b/gi) || [];
    var detailPatterns = [
      /\b(?:hair|face|eyes|makeup|lipstick|mascara|stubble|beard|posture|stance|expression|scar|tattoo)\b[^,.;!?]{0,40}/gi,
      /[^,.;!?]{0,20}\b(?:scar|tattoo|bruise|cut)\b[^,.;!?]{0,20}/gi
    ];
    var i, j, found;

    for (i = 0; i < direct.length; i++) phrases.push(direct[i]);

    for (i = 0; i < detailPatterns.length; i++) {
      found = body.match(detailPatterns[i]) || [];
      for (j = 0; j < found.length; j++) phrases.push(found[j]);
    }

    return dedupeSpecific(phrases.map(normalizeFragment), 1);
  }

  function extractPatternFragments(segment, aliases) {
    var found = [];
    var i, alias, a, patterns, j, match;

    aliases = aliases || [];
    for (i = 0; i < aliases.length; i++) {
      alias = aliases[i];
      a = escapeRegex(alias);
      patterns = [
        new RegExp("\\b" + a + "\\b[^.!?\\n]{0,40}\\b(?:is|was|looks|looked|appears|appeared|stands|stood|remains|seems)\\b([^.!?\\n]{0,90})", "i"),
        new RegExp("\\b" + a + "\\b[^.!?\\n]{0,40}\\b(?:wearing|wears|wore|dressed in|clad in|now wearing|now wears|changed into|changes into|slipped into|pulls on|pulled on)\\b([^.!?\\n]{0,90})", "i"),
        new RegExp("\\b" + a + "'s\\b([^.!?\\n]{0,90})", "i")
      ];

      for (j = 0; j < patterns.length; j++) {
        match = segment.match(patterns[j]);
        if (match && match[1]) found.push(match[1]);
      }
    }

    return dedupeList(found.map(normalizeFragment).filter(Boolean), 4);
  }

  function bucketForFragment(fragment) {
    var body = lower(fragment);

    if (hasLexiconWord(body, APPEARANCE_CONFIG.conditionWords)) return "condition";
    if (hasLexiconWord(body, APPEARANCE_CONFIG.garmentWords) || hasLexiconWord(body, APPEARANCE_CONFIG.accessoryWords)) return "outfit";
    if (/\b(?:hair|face|eyes|makeup|lipstick|mascara|stubble|beard|scar|tattoo|bruise|cut|barefoot|shirtless)\b/i.test(fragment)) return "details";

    return null;
  }

  function buildRecentLabel(observations) {
    var bits = [];
    if (observations.outfit && observations.outfit[0]) bits.push("outfit " + shorten(observations.outfit[0], 18));
    if (observations.condition && observations.condition[0]) bits.push(shorten(observations.condition[0], 18));
    if (observations.details && observations.details[0]) bits.push(shorten(observations.details[0], 18));
    return shorten(bits.join(" | "), APPEARANCE_CONFIG.recentLabelMax);
  }

  function hasMeaningfulAppearance(stateEntry) {
    if (!stateEntry) return false;
    return !!(
      (stateEntry.outfit && stateEntry.outfit.length) ||
      (stateEntry.condition && stateEntry.condition.length) ||
      (stateEntry.details && stateEntry.details.length) ||
      (APPEARANCE_CONFIG.includeRecent && stateEntry.recent && stateEntry.recent.length)
    );
  }

  function clearEphemeralCondition(stateEntry) {
    stateEntry.condition = removeListItems(stateEntry.condition, function(key) {
      return /(dirty|filthy|muddy|dusty|bloodied|bloody|blood-soaked|soaked|wet|damp|sweaty|smudged|smeared|stained|rumpled|wrinkled|torn|ripped|singed|charred|soot-streaked|ash-streaked|disheveled|dishevelled|unkempt)/i.test(key);
    });
  }

  function replaceBucket(stateEntry, bucket, values) {
    stateEntry[bucket] = dedupeList(values, APPEARANCE_CONFIG.maxFragmentsPerBucket);
  }

  function mergeBucket(stateEntry, bucket, values, limit) {
    var next = Array.isArray(stateEntry[bucket]) ? stateEntry[bucket].slice() : [];
    var max = typeof limit === "number" ? limit : APPEARANCE_CONFIG.maxFragmentsPerBucket;
    var i;

    for (i = 0; i < values.length; i++) {
      next = uniquePush(next, values[i], max);
    }

    stateEntry[bucket] = dedupeList(next, max);
  }

  function findCard(title) {
    var cards = ensureCardsArray();
    var target = lower(title);
    var i;

    for (i = 0; i < cards.length; i++) {
      if (lower(getCardTitle(cards[i])) === target) return cards[i];
    }

    return null;
  }

  function removeManagedCard(title) {
    var cards = ensureCardsArray();
    var target = lower(title);
    var i;

    for (i = cards.length - 1; i >= 0; i--) {
      if (lower(getCardTitle(cards[i])) === target) cards.splice(i, 1);
    }
  }

  function upsertManagedCard(meta, entry) {
    var cards = ensureCardsArray();
    var card = findCard(meta.cardTitle);
    var index;

    if (!card && typeof addStoryCard === "function") {
      try {
        addStoryCard("%@%");
        card = findCard("%@%");
      } catch (e) {}
    }

    if (!card) {
      card = {
        title: "%@%",
        name: "%@%",
        keys: "",
        triggers: "",
        entry: "",
        description: "",
        type: APPEARANCE_CONFIG.cardType
      };
      cards.unshift(card);
    }

    card.type = APPEARANCE_CONFIG.cardType;
    card.title = meta.cardTitle;
    card.name = meta.cardTitle;
    card.keys = meta.cardKeys;
    card.triggers = meta.cardKeys;
    card.entry = entry;
    card.description = APPEARANCE_CONFIG.managedMarker;

    if (APPEARANCE_CONFIG.pinCards) {
      index = cards.indexOf(card);
      if (index > 0) {
        cards.splice(index, 1);
        cards.unshift(card);
      }
    }

    return card;
  }

  function buildManagedCardEntry(appearance) {
    var outfit = compactList(appearance.outfit, 2, 26);
    var condition = compactList(appearance.condition, 2, 24);
    var details = compactList(appearance.details, 1, 24);
    var recent = compactList(appearance.recent, 1, 32);
    var sections = [];
    var entry;

    if (outfit.length) sections.push("- Outfit: " + outfit.join("; ") + ".");
    if (condition.length) sections.push("- Condition: " + condition.join("; ") + ".");
    if (details.length) sections.push("- Details: " + details.join("; ") + ".");
    if (APPEARANCE_CONFIG.includeRecent && recent.length) sections.push("- Recent: " + recent[0] + ".");

    entry = sections.join("\n");
    if (!entry) entry = "- Appearance: no tracked changes yet.";

    if (entry.length > APPEARANCE_CONFIG.maxCardChars) {
      entry = sections.slice(0, 3).join("\n");
    }

    if (entry.length > APPEARANCE_CONFIG.maxCardChars && details.length) {
      sections = [];
      if (outfit.length) sections.push("- Outfit: " + outfit.join("; ") + ".");
      if (condition.length) sections.push("- Condition: " + condition.join("; ") + ".");
      entry = sections.join("\n");
    }

    if (entry.length > APPEARANCE_CONFIG.maxCardChars) {
      entry = shorten(entry, APPEARANCE_CONFIG.maxCardChars);
    }

    return entry;
  }

  function refreshManagedCard(query) {
    var meta = typeof query === "string" ? resolveCharacter(query) : query;
    var tracked, entry;

    if (!meta) return false;

    tracked = getTrackedState(meta.id, false);
    if (!tracked || !hasMeaningfulAppearance(tracked.appearance)) {
      if (!APPEARANCE_CONFIG.createEmptyCards) {
        removeManagedCard(meta.cardTitle);
        return true;
      }
    }

    entry = tracked ? buildManagedCardEntry(tracked.appearance) : "- Appearance: no tracked changes yet.";
    upsertManagedCard(meta, entry);
    return true;
  }

  function refreshAllManagedCards() {
    var root = ensureState();
    var key, tracked;

    for (key in root.tracked) {
      if (!Object.prototype.hasOwnProperty.call(root.tracked, key)) continue;
      tracked = root.tracked[key];
      if (tracked && tracked.meta) refreshManagedCard(tracked.meta);
    }

    return true;
  }

  function inferObservations(segment, meta) {
    var observations = {
      outfit: [],
      condition: [],
      details: [],
      resetOutfit: false,
      clearCondition: false
    };
    var normalizedSegment = normalizeSpace(segment).slice(0, APPEARANCE_CONFIG.maxScanWindowChars);
    var fragments = extractPatternFragments(normalizedSegment, meta.aliases || []);
    var i, fragment, bucket, clean;

    observations.resetOutfit = textHasAny(normalizedSegment, APPEARANCE_CONFIG.resetOutfitSignals);
    observations.clearCondition = textHasAny(normalizedSegment, APPEARANCE_CONFIG.clearConditionSignals);
    observations.outfit = observations.outfit.concat(extractOutfitPhrases(normalizedSegment));
    observations.condition = observations.condition.concat(extractConditionPhrases(normalizedSegment));
    observations.details = observations.details.concat(extractDetailPhrases(normalizedSegment));

    if (!observations.outfit.length && !observations.condition.length && !observations.details.length) {
      for (i = 0; i < fragments.length; i++) {
        fragment = fragments[i];
        bucket = bucketForFragment(fragment);
        clean = normalizeFragment(fragment);
        if (bucket && clean) observations[bucket].push(clean);
      }
    }

    observations.outfit = dedupeList(observations.outfit, APPEARANCE_CONFIG.maxFragmentsPerBucket);
    observations.condition = dedupeList(observations.condition, APPEARANCE_CONFIG.maxFragmentsPerBucket);
    observations.details = dedupeList(observations.details, 1);

    return observations;
  }

  function applyObservations(meta, observations) {
    var tracked = getTrackedState(meta.id, true);
    var appearance = tracked.appearance;
    var changed = false;
    var before, recentLabel;

    tracked.meta = meta;

    if (observations.clearCondition) {
      before = JSON.stringify(appearance.condition);
      clearEphemeralCondition(appearance);
      if (before !== JSON.stringify(appearance.condition)) changed = true;
    }

    if (observations.outfit.length) {
      before = JSON.stringify(appearance.outfit);
      if (observations.resetOutfit) replaceBucket(appearance, "outfit", observations.outfit);
      else mergeBucket(appearance, "outfit", observations.outfit);
      if (before !== JSON.stringify(appearance.outfit)) changed = true;
    }

    if (observations.condition.length) {
      before = JSON.stringify(appearance.condition);
      mergeBucket(appearance, "condition", observations.condition);
      if (before !== JSON.stringify(appearance.condition)) changed = true;
    }

    if (observations.details.length) {
      before = JSON.stringify(appearance.details);
      mergeBucket(appearance, "details", observations.details, 1);
      if (before !== JSON.stringify(appearance.details)) changed = true;
    }

    if (changed && APPEARANCE_CONFIG.includeRecent) {
      recentLabel = buildRecentLabel(observations);
      if (recentLabel) {
        appearance.recent = uniquePush(appearance.recent, recentLabel, APPEARANCE_CONFIG.maxRecentItems);
      }
    }

    return changed;
  }

  function scanTrackedCharacter(meta, text) {
    var segments = splitIntoSegments(text);
    var changed = false;
    var i, segment, observations;

    for (i = 0; i < segments.length; i++) {
      segment = segments[i];
      if (!segmentMentionsCharacter(segment, meta)) continue;
      if (!shouldTreatSegmentAsAppearance(segment)) continue;

      observations = inferObservations(segment, meta);
      if (!observations.outfit.length &&
          !observations.condition.length &&
          !observations.details.length &&
          !observations.clearCondition) {
        continue;
      }

      if (applyObservations(meta, observations)) changed = true;
    }

    if (changed) refreshManagedCard(meta);
    return changed;
  }

  function getLatestText() {
    var last;

    if (normalizeSpace(globalThis.text)) return globalThis.text;
    if (!Array.isArray(globalThis.history) || globalThis.history.length === 0) return "";

    last = history[history.length - 1];
    if (!last) return "";
    return safeString(last.text || last.rawText);
  }

  function scanLatestText(text) {
    var body = normalizeSpace(text);
    var root, hash, key, tracked, anyChanged;

    if (!body) return false;

    refreshTrackedRegistry(false);

    root = ensureState();
    hash = simpleHash(body);
    if (root.processedTextHash === hash) return false;
    root.processedTextHash = hash;

    anyChanged = false;
    for (key in root.tracked) {
      if (!Object.prototype.hasOwnProperty.call(root.tracked, key)) continue;
      tracked = root.tracked[key];
      if (!tracked || !tracked.meta) continue;
      if (scanTrackedCharacter(tracked.meta, body)) anyChanged = true;
    }

    return anyChanged;
  }

  function parseManualNote(noteText) {
    var note = normalizeSpace(noteText);
    var observations = {
      outfit: [],
      condition: [],
      details: [],
      resetOutfit: false,
      clearCondition: false
    };
    var parts, i, part, match, bucket, values, j;

    if (!note) return observations;

    parts = note.split(/\s*\|\s*/);
    for (i = 0; i < parts.length; i++) {
      part = parts[i];
      match = part.match(/^\s*(Outfit|Condition|Details?)\s*:\s*(.+)$/i);

      if (match) {
        if (/^outfit$/i.test(match[1])) bucket = "outfit";
        else if (/^condition$/i.test(match[1])) bucket = "condition";
        else bucket = "details";

        values = match[2].split(/\s*;\s*/).map(normalizeFragment).filter(Boolean);
        for (j = 0; j < values.length; j++) observations[bucket].push(values[j]);
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
    var root = ensureState();
    var key, tracked, meta;

    if (!query) {
      for (key in root.tracked) {
        if (!Object.prototype.hasOwnProperty.call(root.tracked, key)) continue;
        tracked = root.tracked[key];
        if (tracked && tracked.meta && tracked.meta.cardTitle) {
          removeManagedCard(tracked.meta.cardTitle);
        }
      }
      root.tracked = {};
      root.processedTextHash = "";
      root.cardSignature = "";
      return true;
    }

    meta = resolveCharacter(query);
    if (!meta) return false;

    removeManagedCard(meta.cardTitle);
    delete root.tracked[meta.id];
    return true;
  }

  function clearCharacterBucket(query, bucket) {
    var meta = resolveCharacter(query);
    var tracked;

    if (!meta) return false;
    if (["outfit", "condition", "details", "recent"].indexOf(bucket) === -1) return false;

    tracked = getTrackedState(meta.id, false);
    if (!tracked) return false;

    tracked.appearance[bucket] = [];

    if (!hasMeaningfulAppearance(tracked.appearance)) removeManagedCard(meta.cardTitle);
    else refreshManagedCard(meta);

    return true;
  }

  function addManualNote(query, noteText) {
    var meta, observations;

    refreshTrackedRegistry(false);
    meta = resolveCharacter(query);
    if (!meta) return false;

    observations = parseManualNote(noteText);
    applyObservations(meta, observations);
    refreshManagedCard(meta);

    return true;
  }

  function parseInputCommand(rawText) {
    var text = normalizeSpace(rawText);
    var match;
    var name;
    var payload;

    if (!APPEARANCE_CONFIG.enableInputCommands) return false;
    if (!text || text.charAt(0) !== APPEARANCE_CONFIG.commandPrefix) return false;

    match = text.match(/^\/(outfit|condition|details)\s+([^:]+):\s*(.+)$/i);
    if (match) {
      name = normalizeSpace(match[2]);
      payload = match[1] + ": " + normalizeSpace(match[3]);
      return addManualNote(name, payload);
    }

    match = text.match(/^\/appearance\s+([^:]+):\s*(.+)$/i);
    if (match) {
      name = normalizeSpace(match[1]);
      payload = normalizeSpace(match[2]);
      return addManualNote(name, payload);
    }

    match = text.match(/^\/clearappearance\s+([^:]+):\s*(outfit|condition|details|recent)$/i);
    if (match) {
      return clearCharacterBucket(normalizeSpace(match[1]), lower(match[2]));
    }

    match = text.match(/^\/resetappearance\s+(.+)$/i);
    if (match) {
      return resetCharacter(normalizeSpace(match[1]));
    }

    match = text.match(/^\/rescanappearance$/i);
    if (match) {
      return refreshTrackedRegistry(true);
    }

    return false;
  }

  function rescanCharacters() {
    return refreshTrackedRegistry(true);
  }

  function run(hook) {
    if (hook === "input") {
      parseInputCommand(safeString(globalThis.text));
      return;
    }

    if (hook === "output") {
      refreshTrackedRegistry(false);
      scanLatestText(getLatestText());
    }
  }

  globalThis.AppearanceDirector = {
    config: APPEARANCE_CONFIG,

    run: function(hook) {
      return run(hook);
    },

    rescan: function() {
      return rescanCharacters();
    },

    refresh: function(query) {
      refreshTrackedRegistry(false);
      if (query) return refreshManagedCard(query);
      return refreshAllManagedCards();
    },

    reset: function(query) {
      return resetCharacter(query || "");
    },

    clear: function(query, bucket) {
      return clearCharacterBucket(query, bucket);
    },

    note: function(query, noteText) {
      return addManualNote(query, noteText);
    },

    scan: function(textOverride) {
      return scanLatestText(safeString(textOverride));
    },

    getCharacters: function() {
      var root, out, key, tracked;
      refreshTrackedRegistry(false);
      root = ensureState();
      out = [];

      for (key in root.tracked) {
        if (!Object.prototype.hasOwnProperty.call(root.tracked, key)) continue;
        tracked = root.tracked[key];
        if (tracked && tracked.meta) out.push(tracked.meta);
      }

      return out;
    },

    getState: function(query) {
      var meta;
      refreshTrackedRegistry(false);
      if (!query) return ensureState().tracked;
      meta = resolveCharacter(query);
      if (!meta) return null;
      return getTrackedState(meta.id, false);
    }
  };

  if (typeof globalThis.InnerSelf === "function" && !globalThis.InnerSelf.__appearanceDirectorWrapped) {
    var original = globalThis.InnerSelf;
    var wrapped = function(hook) {
      var result = original(hook);
      try {
        globalThis.AppearanceDirector.run(hook);
      } catch (e) {}
      return result;
    };

    wrapped.__appearanceDirectorWrapped = true;
    globalThis.InnerSelf = wrapped;
  }
})();
