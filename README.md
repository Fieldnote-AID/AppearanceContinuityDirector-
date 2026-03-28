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

Appearance Continuity Director now supports both automatic output-based tracking and manual slash-command updates.

* * *

## What Appearance Continuity Director Does

Appearance Continuity Director manages live appearance continuity through script-controlled Story Cards.

It automatically:

* detects trackable character cards from your scenario
* scans latest AI-generated output for outfit and condition changes
* updates one compact Story Card per tracked character
* keeps appearance cards lean to avoid wasting Story Card budget
* allows manual appearance updates through input commands
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

* **Trackable character detection**  
  Detects characters from Story Cards using title, type, or marker rules.

* **Per-character appearance cards**  
  Maintains one compact Story Card per tracked character instead of creating lots of fragmented cards.

* **Compact card output**  
  Keeps card text short so appearance continuity does not bloat Story Card context.

* **Condition persistence**  
  Carries forward things like dirt, blood, soot, wet clothes, or torn clothing until the story signals cleanup or a clothing change.

* **Manual command support**  
  Lets you directly set or clear appearance state from player input.

* **Inner Self compatible**  
  Wraps cleanly under Inner Self instead of replacing it.

* **Questline friendly**  
  Uses its own state storage and does not interfere with quest progression cards or quest tracking state.

* * *

## How to Use / How It Works

Appearance Continuity Director does two kinds of work:

1. **Automatic tracking from output**
2. **Manual updates from slash commands**

### Automatic tracking

The script watches the latest AI output for tracked character names and appearance-related language.

When it sees a tracked change, it updates that character’s managed appearance Story Card.

In practice, the script does this:

1. scans Story Cards and identifies trackable characters
2. caches that tracked character list
3. reads the latest AI-generated text
4. looks for tracked character names or aliases
5. checks those lines for appearance signals
6. sorts what it finds into:
   * outfit
   * condition
   * visible details
7. updates that character’s tracked state
8. refreshes that character’s appearance Story Card only if something changed

### Manual updates

The script also supports player-entered slash commands for direct appearance changes.

These commands update the managed appearance card directly without waiting for the AI to narrate the change.

* * *

## Which Character Cards It Tracks

The script can track a character if **any** of these are true:

* the card title starts with `Character - `
* the card title starts with `NPC - `
* the card type is `character`
* the card entry or description contains:
  * `[track-appearance]`
  * `[appearance]`

It also supports different AID field shapes, including:

* `title` or `name`
* `keys` or `triggers`
* `entry` or `value`

This means cards like these can be tracked:

### Example 1

Name:
```text
Character - Seth
```

### Example 2

Name:
```text
Seth
```

Type:
```text
character
```

### Example 3

Name:
```text
Seth
```

Entry:
```text
[track-appearance]
```

* * *

## Important Behavior

The script does **not** rewrite your base character card.

If your base card is:

```text
Character - Seth
```

the script creates or updates a separate managed card like:

```text
Appearance - Seth
```

That managed card holds the live appearance state.

* * *

## Examples

### Example: automatic outfit tracking

Story output:

    Seth steps into the ring still wearing a black coat and fingerless gloves.

Managed card update:

    - Outfit: black coat; fingerless gloves.

### Example: automatic condition tracking

Story output:

    Ren’s jacket is bloodied at the cuff, and his shirt is rumpled.

Managed card update:

    - Outfit: jacket; shirt.
    - Condition: bloodied; rumpled.

### Example: condition persists until cleanup

Story output:

    Seth stands there soot-streaked and damp, hair half-falling out of its tie.

Managed card update:

    - Condition: soot-streaked; damp.
    - Details: hair half-falling out of its tie.

Later story output:

    Seth showers, changes into clean clothes, and comes back freshly changed.

Managed card update:

    - Outfit: clean clothes.
    - Condition: freshly changed.

* * *

## Slash Commands

Appearance Continuity Director supports these input commands:

### Set outfit

    /outfit Seth: black coat

### Set condition

    /condition Seth: rain-soaked; muddy

### Set details

    /details Seth: barefoot

### Set multiple fields at once

    /appearance Seth: Outfit: black coat | Condition: rain-soaked | Details: barefoot

### Clear one bucket

    /clearappearance Seth: condition

Valid buckets:

* `outfit`
* `condition`
* `details`
* `recent`

### Reset one character

    /resetappearance Seth

### Force a registry rebuild

    /rescanappearance

* * *

## Manual Controls

Appearance Continuity Director also includes script-side helpers.

### Refresh all managed appearance cards

    AppearanceDirector.refresh();

### Refresh one tracked character

    AppearanceDirector.refresh("Seth");

### Reset all tracked appearance state

    AppearanceDirector.reset();

### Reset one tracked character

    AppearanceDirector.reset("Seth");

### Add a manual note

    AppearanceDirector.note(
      "Seth",
      "Outfit: black coat | Condition: rain-soaked | Details: barefoot"
    );

### Clear a specific bucket

    AppearanceDirector.clear("Seth", "condition");

### Force a scan manually

    AppearanceDirector.scan("Seth steps in wearing a black coat, rain-soaked and barefoot.");

### Force registry rebuild

    AppearanceDirector.rescan();

### View tracked characters

    AppearanceDirector.getCharacters();

### View tracked state

    AppearanceDirector.getState();
    AppearanceDirector.getState("Seth");

* * *

## Registry / Performance Behavior

The script keeps a cached registry of tracked characters.

It rebuilds that registry when the **Story Card signature changes**, not just when the card count changes.

That means it notices updates to:

* card title or name
* card type
* card triggers or keys
* card entry or value
* card description

This avoids the earlier bug where renaming a card would not be detected unless a card was added or removed.

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
4. Replace your old Appearance Continuity Director block with the new one
5. Save the scenario

That is it.

Appearance Continuity Director will hook into Inner Self automatically.

* * *

## Configuration

All normal setup happens inside `APPEARANCE_CONFIG` near the top of the script.

### Main fields

* `managedTitlePrefix`  
  Prefix used for generated appearance cards

* `trackTitlePrefixes`  
  Title prefixes that count as trackable character cards

* `trackTypeAllowlist`  
  Card types that count as trackable character cards

* `discoveryMarkers`  
  Marker strings that also make a card trackable

* `createEmptyCards`  
  If `false`, the script only creates a managed appearance card after it has meaningful state

* `maxFragmentsPerBucket`  
  How many outfit, condition, or detail fragments to keep

* `maxCardChars`  
  Hard cap for managed Story Card entry length

* `enableInputCommands`  
  Enables slash-command updates

* `commandPrefix`  
  Prefix for input commands

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

* * *

## Card Format

The script keeps one managed Story Card per tracked character.

Typical output looks like this:

    - Outfit: black coat; silver heels.
    - Condition: rain-soaked; bloodied.
    - Details: barefoot.

This keeps appearance state compact and readable without spreading it across multiple cards.

Managed appearance cards are marked internally so the script can ignore its own generated cards during tracking.

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
* base character cards have clean names or triggers

It works less well when:

* the prose uses only pronouns for long stretches
* appearance changes are implied but never stated
* several characters are described in one tangled sentence
* the AI uses very abstract appearance language

* * *

## Known Limitations

Because this script is pattern-based, it is strongest when output is clear and explicit.

It will be weaker when:

* the scene uses only pronouns for several paragraphs
* outfit changes are implied but never described
* the AI uses highly abstract language instead of concrete description
* multiple characters are described in one tangled sentence
* appearance details depend on deep inference instead of explicit text

In practice, it performs best for straightforward lines like:

* “Seth is still wearing the black coat from dinner.”
* “Ren’s jacket is bloodied at the sleeve.”
* “Seth changed into dry clothes.”
* “The fighter stands there soot-streaked and damp.”
* “He pulls on a fresh coat.”

* * *

## Final Notes

Appearance Continuity Director is meant to solve one specific problem:

**the AI forgetting what people look like right now.**

If your scenario has recurring characters, changing outfits, messy aftermath, travel wear, blood, dirt, rain, battle damage, or image-conscious characters, this script helps keep those details from drifting away.

It is intentionally narrow, lightweight, and built to slot cleanly into an Inner Self plus Questline style setup.
