# Appearance Continuity Director 
### Automated appearance tracking for AI Dungeon

Appearance Continuity Director is a plug-in continuity script for AI Dungeon. It tracks visible character state from story output and keeps that state updated through script-managed Story Cards.

Instead of manually editing cards every time a character changes clothes, gets soaked, ends up bloodied, cleans up, or picks up some new visible detail, this script handles those updates for you.

It is designed for scenarios where AI memory drift causes problems with:

* outfit continuity
* dirt / blood / damage continuity
* post-scene cleanup continuity
* visible detail tracking
* long-form character presentation
* appearance-based scene consistency

Appearance Continuity Director is config-driven. You reuse the same engine across different scenarios by editing one data object at the top of the script.

* * *

## What Appearance Continuity Director Does

Appearance Continuity Director manages live appearance continuity through script-controlled Story Cards.

It automatically:

* tracks appearance updates for configured characters
* scans latest AI-generated output for outfit and condition changes
* updates one Story Card per tracked character
* preserves recent appearance observations
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

* Plot Essentials
* Story Summary
* character baseline cards
* world cards
* tone / style instructions
* author notes
* quest progression

Appearance Continuity Director should be the source of truth for **live appearance state**, not for the entire world state.

It is also not a full semantic understanding engine. This script is regex-driven and works best when the output explicitly names the character and clearly describes appearance changes.

* * *

## Main Features

* **Automatic appearance tracking**  
Detects when a tracked character’s outfit, condition, or visible details change in story output.

* **Per-character appearance cards**  
Maintains one Story Card per tracked character instead of creating lots of fragmented cards.

* **Condition persistence**  
Carries forward things like dirt, blood, soot, wet clothes, or torn clothing until the story signals cleanup or a clothing change.

* **Config-driven design**  
Reuse the same script engine across different scenarios by editing the config object.

* **Minimal maintenance**  
Players do not need to manually update appearance cards every few turns.

* **Inner Self compatible**  
Wraps cleanly under Inner Self instead of replacing it.

* **Questline friendly**  
Uses its own state storage and does not interfere with quest progression cards or quest tracking state.

* * *

## How It Works

Appearance Continuity Director runs during the output phase.

Each turn, it:

1. reads the latest AI-generated text
2. checks whether configured characters are explicitly mentioned
3. scans those segments for appearance signals
4. sorts identified changes into:
   * outfit
   * condition
   * visible details
5. updates the tracked state for that character
6. refreshes that character’s appearance Story Card

This means the AI keeps seeing current appearance continuity without you manually editing cards every scene.

* * *

## Recommended Memory Setup

Appearance Continuity Director works best when the rest of your memory setup stays lean.

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

* Margo leaves a gala still wearing a black silk dress and heels
* Eliot gets blood on his cuffs during a fight
* Quentin changes into dry clothes after rain
* Alice keeps soot on her hands after spellwork
* Penny shows up already worn, bruised, or half-packed for travel

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
* avoiding Plot Essentials / Story Summary rewrites

Recommended stack order in `Library`:

1. Inner Self
2. Questline
3. Appearance Continuity Director

* * *

## Scenario Script Install Guide

Use the AI Dungeon website on PC (or view as desktop if mobile-only).

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
```javascript
InnerSelf("input");
const modifier = (text) => {
  return { text };
};
modifier(text);
* * *

## Examples / How It Works

Appearance Continuity Director watches the latest AI output for configured character names and appearance-related language.

When it sees a tracked change, it updates that character’s appearance Story Card.

### Example: automatic outfit tracking

Story output:
```text
Margo steps into the penthouse still wearing a black silk dress and silver heels.
