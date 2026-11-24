---
name: D&D character sheet
description: A dark iron character sheet. Brass frames, crimson actions, numbers first.
colors:
  wax-seal: "oklch(0.50 0.16 27)"
  wax-ink: "oklch(0.98 0.005 90)"
  iron: "oklch(0.17 0.016 55)"
  iron-ink: "oklch(0.95 0.012 85)"
  plate: "oklch(0.23 0.02 55)"
  rail: "oklch(0.13 0.014 50)"
  brass: "oklch(0.64 0.07 78)"
  ash: "oklch(0.80 0.02 85)"
  blood: "oklch(0.72 0.16 20)"
typography:
  title:
    fontFamily: "Source Sans 3, PingFang TC, Noto Sans TC, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Source Sans 3, PingFang TC, Noto Sans TC, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
    fontFeature: "tabular-nums"
  label:
    fontFamily: "Source Sans 3, PingFang TC, Noto Sans TC, sans-serif"
    fontSize: "0.65rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.05em"
rounded:
  sm: "0.18rem"
  md: "0.24rem"
  lg: "0.3rem"
spacing:
  sm: "8px"
  md: "16px"
components:
  button-primary:
    backgroundColor: "{colors.wax-seal}"
    textColor: "{colors.wax-ink}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "32px"
  button-primary-hover:
    backgroundColor: "{colors.wax-seal}"
    textColor: "{colors.wax-ink}"
  button-outline:
    backgroundColor: "{colors.iron}"
    textColor: "{colors.iron-ink}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "32px"
  plate:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.iron-ink}"
    rounded: "{rounded.lg}"
    padding: "12px"
---

# Design System: D&D character sheet

## Overview

**Creative North Star: "The Iron Plate"**

A player at a dim table reads hit points, then the same player builds the character at a desk. The sheet is one forged panel, not a poster and not a rulebook scan. Dark iron carries the page. Brass lines frame each block. Crimson is the wax seal: it marks the action you can take, and the tab you are on.

The system rejects copied Wizards of the Coast art, the dragon logo, and pasted official book pages. Frames and type are original. Personality is dark, framed, and precise, taken from the Baldur's Gate 3 HUD: dark panels, metal frames, crimson.

**Key Characteristics:**

- One sans for names, labels, buttons, and numbers. Source Sans 3, with PingFang TC for Chinese.
- Numbers use tabular figures so columns do not jump.
- Depth comes from a darker rail, an iron page, and a lighter plate. The edge is a brass line with a top highlight.
- Crimson is rare. Primary buttons, the current tab, a filled proficiency mark, the dice Roll button.
- Body text and labels stay at or above 4.5:1. Motion follows the OS reduce-motion setting.

## Colors

Iron page, brass edge, one crimson action color. The honey seed from palette setup is not the action color. The confirmed reference names crimson. Brass (hue 78) is the frame only.

### Primary

- **Wax Seal** (oklch(0.50 0.16 27)): Fill for the one main action on a screen. New character, Level up, Roll, the mobile section button. Text on it is Wax Ink (oklch(0.98 0.005 90)).

### Secondary

- **Blood** (oklch(0.72 0.16 20)): Destructive text and damage. Not a second brand fill. Heal stays green. An active inspiration stays amber. Those are state, not brand.

### Neutral

- **Iron** (oklch(0.17 0.016 55)): Page background.
- **Plate** (oklch(0.23 0.02 55)): Panels, cards, dialogs.
- **Rail** (oklch(0.13 0.014 50)): The top bar on the library and the sheet.
- **Iron Ink** (oklch(0.95 0.012 85)): Body text on iron and plate.
- **Ash** (oklch(0.80 0.02 85)): Secondary text, Chinese glosses, placeholders.
- **Brass** (oklch(0.64 0.07 78)): 1px frames and input borders. Not a fill.

### Named Rules

**The Wax Seal Rule.** Crimson covers well under 10% of a screen. If a control is not the action or the current selection, it is iron, plate, or brass.

## Typography

**Display Font:** none. Product UI does not use a display face on labels, buttons, or data.
**Body Font:** Source Sans 3, then PingFang TC, Noto Sans TC, sans-serif.
**Label Font:** the same family, 600, short uppercase.

**Character:** One readable sans. Weight does the hierarchy. Chinese uses the system face when the Latin font has no glyph.

### Hierarchy

- **Title** (600, 1.5rem, line-height 1.25): Character name and the library heading.
- **Body** (400, 0.875rem, line-height 1.5): Descriptions, skill rows, spell text. Prose stays under 75ch.
- **Label** (600, 0.65rem, tracking 0.05em, uppercase): Panel titles and stat names. Four words or fewer.

### Named Rules

**The One Face Rule.** Do not add a fantasy display font to labels or buttons. The metal frame carries the theme.

## Elevation

Depth is tonal, plus a forged edge. The rail is darker than the page. The plate is lighter than the page. Floating pieces (dice tray, roll toast, menus) may use a soft drop shadow. Panels at rest do not.

### Shadow Vocabulary

- **Plate edge** (`box-shadow: inset 0 1px 0 var(--metal-hi), inset 0 -1px 0 var(--metal-lo)`): Every panel, card, and dialog. Class `plate`.
- **Float** (`shadow-lg` / `shadow-2xl`): The dice tray, the section menu, the roll toast. Only things that sit above the sheet.

### Named Rules

**The Forged Edge Rule.** A panel's edge is a 1px brass border plus the inset highlight. No blur, no glass, no colored side stripe.

## Components

### Buttons

- **Shape:** radius 0.3rem scale (md about 0.24rem).
- **Primary:** Wax Seal fill, Wax Ink text, height 32px. Hover is the same color at 80% (darker).
- **Hover / Focus:** color shift in about 150ms. Focus is a crimson ring.
- **Outline:** Iron fill, brass border, Iron Ink text. Used for Library, rests, Import.
- **Destructive:** Blood text on a faint blood tint. Delete only.

### Cards / Containers

- **Corner Style:** lg, 0.3rem, via `rounded-xl` on the current radius token.
- **Background:** Plate.
- **Shadow Strategy:** plate edge only.
- **Border:** 1px Brass.
- **Internal Padding:** 12px on sheet panels, 16px on library cards.

### Inputs / Fields

- **Style:** recessed fill (oklch(0.30 0.02 55)), brass border, same radius as buttons.
- **Focus:** brass border shifts to the crimson ring.
- **Error:** Blood border and ring. Disabled drops to 50% opacity.

### Navigation

The rail is Rail fill, Iron Ink, a brass bottom border. On the sheet it holds the name, level, and actions. On the phone, section choices open from the crimson round button. The active section gets a crimson ring. The active tab label is Wax Seal.

### Proficiency mark

Empty is a brass-crimson ring. Proficient is a Wax Seal fill. Expertise adds a second ring. Shape changes with the state, so color is not the only signal.

## Do's and Don'ts

### Do

- **Do** keep the number larger than its label.
- **Do** use Wax Seal for the single primary action and the current selection.
- **Do** use the `plate` class on panels, cards, and dialogs.
- **Do** keep body, label, and placeholder text at 4.5:1 or higher.
- **Do** let `prefers-reduced-motion` turn the roll pop into an instant change.

### Don't

- **Don't** copy Wizards of the Coast art, the dragon logo, or official book pages.
- **Don't** put a display font on labels, buttons, or data.
- **Don't** use crimson as a decoration, a background wash, or a side stripe.
- **Don't** use blur or glass as the default surface.
- **Don't** use gradient text.
