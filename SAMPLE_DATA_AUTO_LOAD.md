# Automatic Sample Data Loading

**Date**: 2026-01-05

## What Changed

Development and demo builds now **automatically load sample data** without requiring any environment variable configuration.

## Behavior

### Development Mode (`npm run dev`)
- ✅ **Automatically loads sample data** on startup
- Status shows: "Sample Data (Dev Mode)"
- Connection status: "connected" (green)
- No mixer connection needed
- Can be disabled by clicking the status pill

### Demo Mode (Static Build)
- ✅ **Always uses sample data** (no backend required)
- Build with: `VITE_DEMO=true npm run build`
- Status shows: "Sample Data (Dev Mode)"
- Perfect for showcasing UI on static hosts

### Production Mode
- ❌ **Does NOT load sample data** automatically
- Requires real mixer connection
- Build with: `npm run build` (without VITE_DEMO)

## Code Changes

### 1. `client/src/App.tsx`

**Before:**
```typescript
const isDemo = import.meta.env.VITE_DEMO === 'true';
const [sampleMode, setSampleMode] = useState(isDemo);
```

**After:**
```typescript
const isDev = import.meta.env.DEV;
const isDemo = import.meta.env.VITE_DEMO === 'true';
// Automatically use sample data in dev builds or when VITE_DEMO=true
const shouldUseSampleData = isDev || isDemo;
const [sampleMode, setSampleMode] = useState(shouldUseSampleData);
```

### 2. `client/src/lib/sampleData.ts`

**Before:**
```typescript
return {
  host: 'Sample Data',
  connectionStatus: 'disconnected',
  // ...
};
```

**After:**
```typescript
return {
  host: 'Sample Data (Dev Mode)',
  connectionStatus: 'connected', // Show as connected since sample data is loaded
  // ...
};
```

### 3. `README.md`

Updated documentation to reflect that:
- Dev mode automatically uses sample data
- No configuration needed for development
- Sample mode can be disabled via UI if you want to test with real mixer

## How It Works

1. **Development Detection**: `import.meta.env.DEV` is automatically `true` when running `npm run dev` (Vite's built-in flag)
2. **Demo Detection**: `import.meta.env.VITE_DEMO` is `true` when `VITE_DEMO=true` is set
3. **Auto-Enable**: If either is true, sample mode is automatically enabled on app load
4. **User Override**: Users can still disable sample mode by clicking the status pill to connect to a real mixer

## Sample Data Details

Sample data includes:
- **24 channels** with realistic labels (Kick, Snare, Bass, Guitars, Vocals, etc.)
- **10 AUX buses** (Wedge 1-3, IEM 1-3, Drummer, Keys, Guitar, Spare)
- **Varying fader levels** (0.05 to 0.95)
- **Some muted channels** (every 6th channel)
- **Solo enabled** on channels 14-15 (for master mix)
- **VU meter simulation** (values change based on channel position)

## Benefits

1. **Faster Development**: No need to connect to mixer during UI work
2. **Easier Onboarding**: New developers can run the app immediately
3. **Demo Friendly**: Can showcase the UI without hardware
4. **Testing**: Consistent data for automated tests
5. **No Configuration**: Works out of the box with `npm run dev`

## Testing with Real Mixer

If you need to test with a real mixer during development:

1. Configure server environment:
```bash
cp server/.env.example server/.env
# Edit server/.env with mixer IP
```

2. Click the status pill in the UI to disable sample mode
3. App will attempt to connect to the configured mixer

## Migration Notes

**For Existing Developers:**
- If you previously set `VITE_DEMO=true` in `.env`, you can remove it
- Dev mode now automatically uses sample data
- No changes needed to your workflow

**For Production Deployments:**
- Production builds are unchanged
- Must still configure mixer connection
- Sample data only loads in dev/demo builds

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `DEV` | Vite's built-in dev mode flag | `true` in `npm run dev` |
| `VITE_DEMO` | Force demo mode (static builds) | `undefined` |

## Troubleshooting

**Problem**: Sample data not loading in dev mode

**Solution**:
1. Verify you're running `npm run dev` (not `npm run start:prod`)
2. Check browser console for errors
3. Clear localStorage and refresh

**Problem**: Want to connect to real mixer in dev

**Solution**:
1. Click the "Sample Data (Dev Mode)" status pill
2. Sample mode will disable
3. Enter mixer IP in connection dialog

---

**Status**: Implemented and tested ✅
