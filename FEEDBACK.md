# UI24R Mini Mixer - Feedback & Roadmap

## Phase 1: Quick Wins & Polish

### 1.1 Disable Mobile Zoom
- Prevent pinch-to-zoom on mobile to avoid accidental zooming during fader control
- Add appropriate viewport meta tags

### 1.2 Minimap Viewport Sync
- When tapping on minimap track, move viewport indicator immediately (not waiting for scroll animation)
- Currently indicator waits until hscroll completes

### 1.3 Aux Send Dropdown Size (Mobile)
- Make mix select dropdown edge-to-edge on mobile
- Prevent confusion about which channel is being edited

---

## Phase 2: Channel Organization

### 2.1 Unstar Channel Ordering
- When a channel is unpinned/unstarred, return it to its original channel order position
- Currently it may stay at end of list

### 2.2 V-Group Channel Deduplication
- When a channel is added to a V-Group, hide it from "All Channels" section
- Prevents duplicate channel strips appearing

---

## Phase 3: V-Group UX Overhaul

### 3.1 Remove Section Header Bar
- Kill the bar above channels showing "Other" or V-Group name
- Currently wastes vertical space and looks odd

### 3.2 V-Group Edit via Pencil Icon
- Add pencil icon on V-Group strip (top left)
- Opens modal for: rename, change channels, remove group
- Eliminates confusing "Rename"/"Remove" buttons far from title

### 3.3 V-Group Visual Distinction
- Channels inside a V-Group should have slightly darker background
- Makes group boundaries clear

### 3.4 V-Group Strip Width
- Make V-Group channel strip skinnier (currently too wide)

### 3.5 Expand/Collapse Button Position
- Move the +/- expand button to top right of V-Group strip
- Currently next to Mute/Solo buttons which is confusing

---

## Phase 4: Minimap Enhancement

### 4.1 Move Minimap to Bottom
- Relocate miniscroll underneath channel strips (very bottom)
- Better visual flow

### 4.2 Dual-Layer Fader + Signal Display
- Gray background bar showing fader position
- Overlaid signal/amplitude with gradient (like VU meter)
- Helps users understand minimap represents channels

### 4.3 Channel Labels in Minimap
- Show 2-letter abbreviation of channel name in each bar
- Provides grounding/context for what each bar represents

---

## Phase 5: API Investigation

### 5.1 Solo on Aux Bus
- Investigate: Does UI24R API support soloing channels on aux sends?
- If yes: Re-add Solo button in aux send mode
- Currently Solo is hidden on aux buses (e.g., "Drummer" mix)

---

## Status Legend
- [ ] Not started
- [x] Completed
- [~] In progress
