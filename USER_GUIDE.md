# Ui24R Mini Mixer - User Guide

This guide is for band members using the Ui24R Mini Mixer web app on phones, tablets, or laptops. It explains how to connect and use each view.

## Quick Start

1. Join the same Wi-Fi/LAN as the mixer.
2. Open the app in your browser (ask the band lead for the URL).
3. Click **Connect**, enter the mixer IP (e.g. `192.168.1.123`), then **Connect**.
4. Choose a view from the top bar: **Main Mix**, **Gain**, or an **AUX** send.

## Top Bar

- **Ui24R Full Interface**: Opens the full Soundcraft UI in a new tab (only works when connected).
- **Connect**: Opens the IP entry panel.
- **Load Sample Data**: Loads a fake mixer state for demo/testing (only shows when disconnected).
- **Status pill**: Shows connection state (Connected, Reconnecting, Disconnected, Sample Data).
- **Demo mode**: When enabled, sample data is always loaded and Connect is disabled.

## Views

### Main Mix
Use this to adjust the main house mix.

- **Fader**: Drag the fader to change channel level.
- **Mute (M)**: Toggle mute per channel.
- **Solo (S)**: Solo per channel (main mix only).
- **Meters**: Show signal level.

### Aux Sends (AUX 1-10)
Use this to build your own monitor mix.

- Select your aux bus from the **AUX SENDS** row.
- **Assign to Me**: Marks this aux as your personal bus on this device.
- **Show Assigned / Show All**: Toggle between only your assigned aux and all auxes.
- **Fader**: Adjust how much of each channel is sent to your monitor.
- **Mute (M)**: Mute a channel in your monitor mix.

### Assigning Your Mix (Per Device)
Use this to keep everyone in their own lane.

- Tap **Assign to Me** while you are on your aux to claim it on your device.
- Once assigned, you can use **Show Assigned** to hide other auxes and avoid accidental changes.
- This assignment is saved in your browser on that device; it does not affect anyone else.

### Gain
Use this to view and adjust input gain.

- **Gain slider**: Adjust preamp gain for each channel.
- **No Mute/Solo**: Gain view only changes gain.

## Simple Controls
The **Simple Controls** button in the toolbar adds step buttons below each fader for easier adjustments on touch screens.

- **+**: Increase fader level by a fixed step (approximately 3 dB).
- **-**: Decrease fader level by a fixed step (approximately 3 dB).

This mode is especially useful on small mobile screens where precise fader dragging is difficult.

## V-Groups (Channel Organization)
V-Groups let you group channels together and control them as a unit.

### Global V-Groups (Admin)
Click **V-Groups** in the top bar to open the admin view.

- **New Global V-Group**: Create a group used across all views.
- **Rename / Remove**: Manage existing groups.
- **Assign channels**: Check channels that belong in the group.

### Local V-Groups (Per AUX View)
In an AUX view you can add local groups just for that aux.

- **Add V-Group**: Create a local group and choose channels.
- **Rename / Remove**: Manage local groups in that aux.
- **Group strip**: Adjust the group offset and mode, mute/solo the group, or hide/show it.

### Favorites and Others
The app may show built-in groups like **Favorites** and **Others** to help organize channels.

## Reordering Channels
You can drag channels and V-Groups to reorder the mix row.

- Drag a channel or group header to move it.
- Drop it between items to insert.
- Drop it at the end to append.

## Reset Layout
Use **Reset Layout** in the toolbar (Main Mix or Gain) to restore the default layout.

- Clears local V-Groups for the current view.
- Disables all Global V-Groups in the current view.
- Clears any custom channel order for the current view.

## Tips

- If you see stale data, refresh the page.
- For best results, keep only one browser tab open per device.
- Be cautious with **Gain**: it affects input levels for everyone.

## Installing on Your Device (PWA)

This app can be installed on your phone or tablet for a more app-like experience.

### iOS (iPhone/iPad)
1. Open the app in **Safari** (required - Chrome/Firefox don't support PWA on iOS).
2. Tap the **Share** button (square with arrow).
3. Scroll down and tap **Add to Home Screen**.
4. Tap **Add**.

### Android
1. Open the app in **Chrome**.
2. Tap the **menu** (three dots).
3. Tap **Add to Home screen** or **Install app**.
4. Confirm by tapping **Add** or **Install**.

The app will appear on your home screen and run in fullscreen mode without browser controls.

## Browser Compatibility

The app works on modern and older devices:
- iOS Safari 12+ (iPhone 5s and newer)
- Safari 12+ (macOS)
- Chrome 64+
- Firefox 60+

## Troubleshooting

- **Cannot connect**: Verify IP address and that you are on the same network.
- **Buttons disabled**: Some controls only apply in certain views (e.g. Solo only in Main Mix).
- **No audio changes**: Confirm you are adjusting the correct AUX bus or the Main Mix.
- **App not loading on older device**: Ensure you're using a supported browser version (see Browser Compatibility above).
