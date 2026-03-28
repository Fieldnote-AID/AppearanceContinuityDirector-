# Appearance Continuity Director
### Automated appearance tracking for AI Dungeon

Appearance Continuity Director is a plug-in continuity script for AI Dungeon. It tracks live visible character state from story output and keeps that state updated through compact, script-managed Story Cards.

Instead of manually editing cards every time a character changes clothes, gets soaked, ends up bloodied, cleans up, or picks up some new visible detail, this script handles those updates for you.

It is designed for scenarios where AI memory drift causes problems with:

* outfit continuity
* dirt / blood / damage continuity
* post-scene cleanup continuity
* visible detail tracking
* long-form character presentation
* appearance-based scene consistency

Appearance Continuity Director is built around **hybrid discovery**:

* it can auto-discover likely character cards during play
* it can pick up new character cards added mid-adventure
* it still supports optional config overrides for aliases, includes, excludes, and custom managed card names

* * *

## What Appearance Continuity Director Does

Appearance Continuity Director manages live appearance continuity through script-controlled Story Cards.

It automatically:

* discovers likely character cards
* picks up newly added character cards during play
* scans latest AI-generated output for outfit and condition changes
* updates one compact Story Card per tracked character
* keeps appearance cards lean to avoid wasting Story Card budget
* reduces manual continuity maintenance during long adventures

It is especially useful when you want:

* the AI to remember what characters are currently wearing
* scene damage to persist until it is actually cleaned up
* appearance details to stay consistent across multiple turns
* a lightweight continuity layer without rewriting core memory

* * *

## What Appearance Continuity Director Does Not Do

Appearance Continuity Director is not meant to replace your whole scenario setup.

You should still manage these manually:

* AI Instructions
* Plot Essentials
* Story Summary
* Author’s Note
* character baseline cards
* world cards
* quest progression

Appearance Continuity Director should be the source of truth for **live appearance state**, not for the entire world state.

It is also not a full semantic understanding engine. This script is regex-driven and works best when the output explicitly names the character and clearly describes appearance changes.

* * *

## Main Features

* **Automatic discovery**  
  Finds likely character cards and starts tracking them without requiring full manual setup.

* **Mid-adventure pickup**  
  New character cards added during play can be discovered and tracked automatically.

* **Per-character appearance cards**  
  Maintains one compact Story Card per tracked character instead of creating lots of fragmented cards.

* **Compact card output**  
  Keeps card text short so appearance continuity does not bloat Story Card context.

* **Condition persistence**  
  Carries forward things like dirt, blood, soot, wet clothes, or torn clothing until the story signals cleanup or a clothing change.

* **Optional overrides**  
  Lets you keep config for aliases, forced includes, custom managed card titles, or other edge cases.

* **Inner Self compatible**  
  Wraps cleanly under Inner Self instead of replacing it.

* **Questline friendly**  
  Uses its own state storage and does not interfere with quest progression cards or quest tracking state.

* * *

## How to Use / How It Works

Appearance Continuity Director watches the latest AI output for tracked character names and appearance-related language.

When it sees a tracked change, it updates that character’s managed appearance Story Card.

In practice, the script does this:

1. discovers likely character cards
2. registers them as tracked characters
3. reads the latest AI-generated text
4. looks for tracked character names or aliases
5. checks those lines for appearance signals
6. sorts what it finds into:
   * outfit
   * condition
   * visible details
7. updates that character’s tracked state
8. refreshes that character’s appearance Story Card only if something changed

This keeps appearance continuity live without forcing you to manually edit Story Cards every few turns.

### Example: automatic outfit tracking

Story output:

    Jordan steps into the apartment still wearing a black coat and silver heels.

Managed card update:

    - Outfit: black coat; silver heels.

### Example: automatic condition tracking

Story output:

    Rowan’s jacket is bloodied at the cuff, and their shirt is rumpled.

Managed card update:

    - Outfit: jacket; shirt.
    - Condition: bloodied; rumpled.

### Example: condition persists until cleanup

Story output:

    Alex stands there soot-streaked and damp, hair half-falling out of its tie.

Managed card update:

    - Condition: soot-streaked; damp.
    - Details: hair half-falling out of its tie.

Later story output:

    Alex showers, changes into clean clothes, and comes back freshly changed.

Managed card update:

    - Outfit: clean clothes.
    - Condition: freshly changed.

### Example: manual correction

If the AI misses something, add it manually:

    AppearanceDirector.note(
      "jordan",
      "Outfit: black coat; silver heels | Condition: rain-soaked | Details: barefoot"
    );

### Example: clear one bucket

If you want to clear only condition state:

    AppearanceDirector.clear("jordan", "condition");

### Example: reset one character

    AppearanceDirector.reset("jordan");

This deletes that character’s tracked appearance state and removes their managed appearance card.

### Example: refresh cards

    AppearanceDirector.refresh();

Refreshes all currently tracked appearance cards.

    AppearanceDirector.refresh("jordan");

Refreshes only that character’s appearance card.

### Example: rescan character cards

    AppearanceDirector.rescan();

Forces a new discovery pass over current Story Cards.

* * *

## Discovery Rules

By default, the script tries to auto-discover likely character cards.

A card is treated as a candidate character card if it matches at least one of these:

* `type` is `character` or `class`
* title starts with:
  * `Character — `
  * `Character - `
  * `Character:`
  * `NPC — `
  * `NPC - `
  * `NPC:`
* the card contains one of these markers:
  * `[track-appearance]`
  * `[appearance]`

The script ignores its own managed appearance cards.

### Important note

Auto-discovery works best when your base character cards have a clear title and at least one clean name key.

If your setup is messy or unconventional, use explicit config overrides.

* * *

## Optional Config Overrides

This script no longer requires a full pre-configured cast list, but config is still useful.

Use `explicitCharacters` when you want to:

* force-track a character even if discovery would miss them
* provide better aliases
* override a generated ID
* override the managed appearance card title
* override the managed appearance card keys

Example:

    explicitCharacters: [
      {
        id: "jordan",
        name: "Jordan Vale",
        aliases: ["Jordan", "Jordan Vale"],
        cardTitle: "Appearance — Jordan Vale",
        cardKeys: "Jordan, Jordan Vale"
      }
    ]

Recommended use:

* rely on auto-discovery for most characters
* use config only for exceptions and cleanup

* * *

## Recommended Memory Setup

Appearance Continuity Director works best when the rest of your memory setup stays lean.

### AI Instructions

Use for:

* behavior rules
* POV and tense
* style rules
* generation guardrails

Do **not** put live appearance continuity here.

### Plot Essentials

Use for:

* core protagonist facts
* relationship state
* always-relevant world truths
* stable character identity facts

Do **not** use Plot Essentials for live clothing, dirt, blood, or temporary visible state.

### Story Summary

Use for:

* broad backstory
* major prior arcs
* how the current scenario began

Do **not** rely on Story Summary for live appearance state.

### Story Cards

Use for:

* character cards
* world cards
* script-managed appearance cards
* quest cards
* milestone cards
* active objective cards

That split gives Appearance Continuity Director the best chance of keeping visible continuity clean without bloating required memory.

* * *

## Best Use Cases

Appearance Continuity Director works best in scenarios with:

* recurring named characters
* relationship-heavy cast interaction
* travel arcs
* combat aftermath
* fashion-conscious characters
* magical or physical damage that should visibly persist
* long-form continuity where appearance matters scene to scene

Examples:

* a character leaves a gala still wearing formal clothes
* someone gets blood on their sleeve during a fight
* a character changes into dry clothes after rain
* a spellcaster keeps soot on their hands after casting
* a traveler shows up already worn, bruised, or half-packed

* * *

## Compatibility

Appearance Continuity Director is built to be used as an add-on beneath **Inner Self**.

It is designed to coexist cleanly with:

* **Inner Self**
* **Questline**

It does this by:

* wrapping `InnerSelf("output")` behavior instead of replacing it
* using its own dedicated state key
* managing its own Story Cards only
* avoiding quest-state mutation
* avoiding Plot Essentials, Story Summary, and other core memory rewrites

Recommended stack order in `Library`:

1. Inner Self
2. Questline
3. Appearance Continuity Director

* * *

## Scenario Script Install Guide

Use the AI Dungeon website on PC, or view as desktop if mobile-only.

Appearance Continuity Director is intended as an **add-on to Inner Self**, and should be pasted **below** Inner Self in the `Library` tab.

If you are already using Questline, paste this script **below Questline** as well.

* * *

## Install as an Add-on to Inner Self

Use this version if your scenario already uses Inner Self.

### Step 1: Open your scenario

1. Create a new scenario or edit an existing scenario
2. Open the `DETAILS` tab at the top while editing your scenario
3. Scroll down to `Scripting` and toggle ON → `Scripts Enabled`
4. Select `EDIT SCRIPTS`

### Step 2: Check your existing script tabs

Your scenario should already have Inner Self installed.

Your tabs should already look something like this:

#### Input

    InnerSelf("input");
    const modifier = (text) => {
      return { text };
    };
    modifier(text);

#### Context

    InnerSelf("context");
    const modifier = (text) => {
      return { text, stop };
    };
    modifier(text);

#### Output

    InnerSelf("output");
    const modifier = (text) => {
      return { text };
    };
    modifier(text);

You do **not** need to add any new calls to Input, Context, or Output for Appearance Continuity Director.

### Step 3: Add the library code

1. Select the `Library` tab on the left
2. Keep your existing Inner Self library code
3. If using Questline, keep Questline below it
4. Paste Appearance Continuity Director **below** those scripts in the same `Library` tab
5. Save the scenario

That is it.

Appearance Continuity Director will hook into Inner Self automatically.

* * *

## Configuration

All normal setup happens inside `APPEARANCE_CONFIG` near the top of the script.

### Main fields

* `autoDiscover`  
  Enables automatic character discovery from Story Cards

* `discoverOnHooks`  
  Which hooks trigger discovery checks

* `createEmptyCards`  
  If `false`, the script only creates a managed appearance card after it has meaningful state

* `maxFragmentsPerBucket`  
  How many outfit, condition, or detail fragments to keep

* `maxCardChars`  
  Hard cap for managed Story Card entry length

* `pinCards`  
  Whether generated appearance cards should be pinned to the front of Story Cards

* `explicitCharacters`  
  Optional manual overrides

### Vocabulary fields

* `garmentWords`  
  Clothing vocabulary

* `accessoryWords`  
  Accessory vocabulary

* `conditionWords`  
  Dirty, damaged, cleaned, or physical state vocabulary

* `resetOutfitSignals`  
  Phrases that imply the outfit should be replaced instead of merged

* `clearConditionSignals`  
  Phrases that imply dirt, blood, or grime should be removed

### Discovery fields

* `candidateTypeAllowlist`  
  Card types that count as candidate character cards

* `titlePrefixes`  
  Title prefixes that count as candidate character cards

* `discoveryMarkers`  
  Marker strings that can force a card into discovery

* * *

## Manual Controls

Appearance Continuity Director includes optional manual helpers.

### Refresh all managed appearance cards

    AppearanceDirector.refresh();

### Refresh one tracked character

    AppearanceDirector.refresh("jordan");

### Reset all tracked appearance state

    AppearanceDirector.reset();

### Reset one tracked character

    AppearanceDirector.reset("jordan");

### Add a manual note

    AppearanceDirector.note(
      "jordan",
      "Outfit: black coat; silver heels | Condition: rain-soaked | Details: barefoot"
    );

### Clear a specific bucket

    AppearanceDirector.clear("jordan", "condition");

### Force a scan manually

    AppearanceDirector.scan("Jordan steps in wearing a black coat, rain-soaked and barefoot.");

### Force rediscovery of Story Cards

    AppearanceDirector.rescan();

### View discovered / tracked characters

    AppearanceDirector.getCharacters();

### View current tracked state

    AppearanceDirector.getState();
    AppearanceDirector.getState("jordan");

Valid clearable buckets are:

* `outfit`
* `condition`
* `details`
* `recent`

* * *

## Card Format

The script keeps one Story Card per tracked character.

Typical output looks like this:

    - Outfit: black coat; silver heels.
    - Condition: rain-soaked; bloodied.
    - Details: barefoot.

This keeps appearance state compact and readable without spreading it across multiple cards.

Managed appearance cards are marked internally so the script can ignore its own generated cards during discovery.

* * *

## What the Script Is Actually Storing

This script is meant to store only **live visible continuity**:

* current outfit
* current condition
* current visible details

It is **not** meant to store:

* full character biographies
* relationship state
* quest progression
* world lore
* broad story history

Use it for things like:

* who is still wearing what
* who is bloodied, wet, dirty, bruised, or cleaned up
* visible changes that should persist across scenes

* * *

## Best Way to Use It

Use this role split:

* **AI Instructions** → behavior, style, POV, guardrails
* **Plot Essentials** → always-relevant truths
* **Story Summary** → broad prior history
* **Story Cards** → character and world cards plus script-managed cards
* **Questline** → live quest progression
* **Appearance Continuity Director** → live appearance continuity

That keeps this script narrow and efficient instead of turning it into a second memory system.

* * *

## Practical Notes

This script works best when:

* characters are named explicitly
* appearance changes are described clearly
* outfit changes are concrete
* cleanup is actually narrated
* base character cards are reasonably clean

It works less well when:

* the prose uses only pronouns for long stretches
* appearance changes are implied but never stated
* several characters are described in one tangled sentence
* base character cards have messy or non-name keys
* characters have no usable title or name-like trigger

For best results, keep your tracked cast list focused on the characters who actually matter for recurring on-screen continuity.

* * *

## Known Limitations

Because this script is pattern-based, it is strongest when output is clear and explicit.

It will be weaker when:

* the scene uses only pronouns for several paragraphs
* outfit changes are implied but never described
* the AI uses highly abstract language instead of concrete description
* multiple characters are described in one tangled sentence
* appearance details depend on deep inference instead of explicit text
* discovery has too little clean data to infer aliases correctly

In practice, it performs best for straightforward lines like:

* “Jordan is still wearing the black coat from dinner.”
* “Rowan’s jacket is bloodied at the sleeve.”
* “Alex changed into dry clothes.”
* “Taylor stands there soot-streaked and damp.”
* “Morgan pulls on a fresh coat.”

* * *

## Final Notes

Appearance Continuity Director is meant to solve one specific problem:

**the AI forgetting what people look like right now.**

If your scenario has recurring characters, changing outfits, messy aftermath, travel wear, blood, dirt, rain, battle damage, or image-conscious characters, this script helps keep those details from drifting away.

It is intentionally narrow, lightweight, and built to slot cleanly into an Inner Self plus Questline style setup.
