# UI Feedback & Roadmap

Feedback from drummer on simplifying the UI to reduce visual clutter and improve mobile UX.

## Phase 1: Quick Wins ✅ COMPLETED

| Change | Status |
|--------|--------|
| Remove Bottom Bar - Integrate +/- steppers directly into channel strips, always visible | ✅ Done |
| Rename "My Channels" → "Favorites" | ✅ Done |
| Shorten Mute/Solo → M/S | ✅ Done |
| Remove "Assign to me" button (dropdown solves this) | ✅ Done |
| Add icons to action buttons (+ for new, ↻ for refresh) | ✅ Done |

## Phase 2: Middle Bar Consolidation ✅ COMPLETED

| Change | Status |
|--------|--------|
| Convert Main Mix / Gain / AUX Sends into single dropdown | ✅ Done |
| Keep V-Groups as separate toggleable section | ✅ Done |
| Simplify Top Bar - compact brand, icon buttons | ✅ Done |
| Sample data only via URL param (not in dev by default) | ✅ Done |

**Goal:** The mode selection (Main Mix, Gain, AUX sends) is THE primary context. It should be a single, prominent dropdown rather than multiple button rows.

## Phase 3: Channel Strip Optimization

| Change | Status |
|--------|--------|
| Narrow channel strips - Tighter padding, smaller labels | Pending |
| Remove drag handles on mobile (keep on desktop) | Pending |
| Add minimap scrollbar - Birds-eye view of all channels with position indicator | Pending |

**Goal:** Make channel strips narrower so more fit on screen. The minimap would show a zoomed-out view of all faders, helping users navigate long channel lists quickly.

## Phase 4: Favorites vs V-Groups Rethink

| Change | Status |
|--------|--------|
| Remove "Favorites" as a V-Group with master slider | Pending |
| Add pin/star icon to individual channels | Pending |
| Pinned channels appear at front of "All Channels" | Pending |

**Goal:** Simplify the mental model. Instead of "Favorites" being a special V-Group, let users pin individual channels to the front. V-Groups remain for actual group control with master faders.

---

## Original Feedback Notes

### Top Bar
- "Do you really need any of this in the final product?"

### Middle Bar
- "These can all be put into a dropdown with the exception of V-groups"
- "You only want to choose one at a time from Main Mix, Gain, AUX Sends"
- "This is like THE primary menu item you need, it's the context of the channels below"

### Bottom Bar
- "You def don't need this one at all"
- "Simple Controls toggle can just not exist, instead just put the +/- under faders so they're always visible"

### Channel Strip
- "Each channel is kind of wide, simplify to see more"
- "Most important things are a nice easy to drag handle and a visible signal line"
- "It would be super rad if you could implement a scroll bar that was like a zoomed out view of the fader strip. DAWs usually have this."
- "The dragging is cool on web but I don't think anyone's gonna do that on mobile"

### Favorites/V-Groups
- "Instead of My Channels, 'Favorites' or 'Starred' is clearer"
- "My Channels group and V-Groups are kinda conflated"
- "What if you got rid of My Channels and just had a pin icon to pin it to the front of All Channels, then just had V-Groups with master sliders?"
