# DreamSyncX Chart Editor - Release Notes

## Version 6 (March 2026)

## Version 5.1.0 (February 2026)

**UI Redesign + Critical Bug Fixes**

### 🎨 Major UI Overhaul

**Completely Redesigned Sidebar**
- Modern, clean panel design with better visual hierarchy
- Improved spacing and typography throughout
- Enhanced panel headers with left-aligned collapse icons
- Better organized sections with clear visual separation
- Smooth animations and transitions on all interactions

**Enhanced Input Styling**
- Redesigned input fields with hover and focus states
- Custom range sliders with styled thumbs and tracks
- Improved file input with styled "Choose File" button
- Better color picker layout with larger touch targets
- Checkbox groups with background highlights

**BPM Changes Section**
- Dedicated section with clear header and styling
- Compact "Add" button with icon
- Styled list container with empty state message
- Better visual feedback for BPM change entries
- Improved layout prevents text clipping

**Note Palette Enhancement**
- Highlighted panel with accent color border
- Vertical button layout with better spacing
- Enhanced note key badges with improved contrast
- Clearer visual distinction between note types

**Improved Component Styling**
- Panel descriptions with left border accent
- Training status indicator with background
- Value displays for sliders (e.g., "1.0x")
- Full-width and button-row utility classes
- Better stat rows with improved typography

### 🐛 Critical Bug Fixes

**Timeline Beat Line Corruption (Day 0 Legacy Bug)**
- Fixed floating-point precision errors causing beat lines to skip/misalign
- Replaced modulo-based detection with integer-based beat index counting
- Charts with "weird" BPMs (like 180) now show all beat lines correctly
- Fixed timeline only using BPM at time 0 for entire timeline
- Now properly handles multiple BPM sections
- Added validation and safety checks for corrupted BPM data
- **Note**: This bug has existed since day 0 and may have caused charts to feel slightly unsynced (1-3ms drift)

**Timeline Scrolling Issues**
- Fixed timeline showing scrollable area beyond audio end
- Timeline now uses actual audio duration instead of defaulting to 3 minutes
- Prevented scrolling past the end of the audio file
- Scrollbar accurately represents actual song length
- Maximum offset now calculated based on real audio duration

**Auto-Save System**
- Fixed auto-save not triggering when adding/deleting/moving notes
- Command manager now properly marks changes as unsaved
- Fixed restore function calling non-existent method
- Added proper ChartData instance recreation on restore
- Connected command manager to auto-save manager
- Changed saved status indicator to green for better visibility
- Added console logging for debugging

**UI Text Clipping**
- Fixed "OFFSET (MS)" label being cut off in Timing & Audio panel
- Fixed audio filename being clipped in file input
- Reduced font sizes and letter-spacing to prevent overflow
- Added proper text-overflow handling with ellipsis
- Improved grid column gaps for better content fit

### ✨ New Features

**BPM Change Management UI**
- Added visual BPM Changes list showing all BPM changes
- "+ Add" button to create new BPM changes at current playback time
- Edit/Delete buttons for each BPM change
- Initial BPM at time 0 cannot be deleted (protected)
- Automatically recalculates min/max BPM values
- Fixed `_updateBpm()` to only update first BPM change instead of wiping array

### 🔧 Technical Improvements

**Timeline Rendering**
- Integer-based beat counting eliminates floating-point errors completely
- Proper BPM section handling for multi-BPM charts
- Accurate beat line positioning at all zoom levels
- Better performance with optimized calculations

**Sidebar Architecture**
- Cleaner HTML structure with semantic classes
- Modular CSS with utility classes
- Better component organization
- Improved maintainability

**Input Handling**
- Better overflow management for all input types
- Cross-browser file input styling
- Improved accessibility with proper labels
- Enhanced keyboard navigation

### 💅 Visual Enhancements

**Polish & Details**
- Smooth transitions on all interactive elements
- Better hover states throughout the UI
- Custom scrollbar for sidebar
- Improved color grid layout
- Enhanced checkbox groups with backgrounds
- Better button hierarchy (primary, ghost, small variants)

**Spacing & Layout**
- Consistent 16px margins for input groups
- Proper padding in panel content (16px)
- Optimized gap spacing in grids (8-12px)
- Better vertical rhythm throughout

### 📚 Documentation

**Updated Guides**
- BPM Change Management documentation
- Timeline beat line fix explanation
- Auto-save system behavior
- UI redesign highlights

---

## Version 5.0.0 (February 2026)

**Dynamic Layout Transitions + Enhanced Note Types**

### 🎮 Major Gameplay Features

**Dynamic Layout Transitions**
- Seamless transitions between Honeycomb and Ring layout modes during gameplay
- Fully animated transitions with customizable duration (500ms-2000ms)
- 7 easing functions: Linear, Cubic, Quart, Quint, Elastic, Bounce
- Visual effects: screen flash, particle bursts, smooth hex repositioning
- Ring mode features maimai-inspired circular layout with center marker
- Bidirectional transitions: charts can switch between modes multiple times
- Transitions saved to chart files and work in both editor and main game

**Ring Mode Note Animation**
- Notes spawn at center and travel outward to ring positions
- Smooth scaling from 0.3x to 1.0x during travel
- Approach rings scale with note body for consistent visuals
- 200ms travel time for optimal readability
- Larger ring boundary (10% bigger) with scale-up animation (0.85x to 1.0x)

**Enhanced Note Types**
- **EX Notes**: Special bonus notes with gold color and unique sound effect
- **EX2 Notes**: Advanced EX notes with different audio feedback
- **Multi Notes**: Simultaneous multi-zone hits with deep sky blue color
- All note types fully supported in editor with visual indicators
- Color-coded timeline markers for easy identification

### 🎨 Editor Improvements

**Transition Management Panel**
- Visual transition editor with timeline integration
- Add transitions at any point in the chart
- 6 preset configurations: Quick, Standard, Smooth, Dramatic, Bouncy, Elastic
- Advanced settings: scale range, camera zoom, flash intensity, particle count
- Real-time preview of transitions during playback
- Transition markers on timeline for easy navigation
- Edit/delete transitions with intuitive UI

**Seek Detection & Scrubbing**
- Instant mode switching when scrubbing timeline backwards
- Smooth animated transitions during normal playback
- Automatic layout detection based on timeline position
- No visual glitches when jumping between sections

**Note Type Selection**
- Dedicated note palette with visual icons
- Keyboard shortcuts for quick switching (1-5 keys)
- Color-coded notes in timeline and preview
- Type indicator in note properties panel

### 🔧 Technical Improvements

**Transition System Architecture**
- Dual layout position system (honeycomb + ring coordinates)
- Interpolation engine for smooth hex repositioning
- Mode detection for proper note spawning
- Zoom and camera management (disabled in editor for stability)
- Hex opacity animation (0.7 → 1.0 in ring mode)
- Combo position animation (center ↔ bottom-left)

**Performance Optimizations**
- Efficient position caching for both layout modes
- Optimized note animation calculations
- Smooth 60 FPS transitions with easing functions
- Minimal memory overhead for transition data

**Chart Format Updates**
- New `transitions` array in chart JSON
- Transition properties: time, mode, duration, easing, visual effects
- Backward compatible with older charts (no transitions = honeycomb only)
- Forward compatible with future layout modes

### 💅 Visual Enhancements

**Ring Mode Visuals**
- Hexagonal ring boundary with glow effect (pure white, 50% opacity)
- Center marker with pulsing hexagon ring and crosshair
- Larger ring radius for better visibility
- Smooth fade-in/out during transitions
- Proper layering (boundary behind hexes, marker on top)

**Transition Effects**
- Customizable screen flash (0-100% intensity)
- Particle burst with configurable count (0-100 particles)
- Smooth hex movement with multiple easing curves
- Visual feedback for mode changes

**Note Appearance**
- Gold color for EX/EX2 notes (#FFD700)
- Deep sky blue for multi notes (#00BFFF)
- White for regular notes (#FFFFFF)
- Consistent colors across editor and game

### � Bug Fixes

**Transition System**
- Fixed ring boundary scaling during animated transitions
- Fixed camera zoom causing hex grid to shift off-center
- Fixed transitions not reverting when seeking backwards
- Fixed ring mode notes appearing instantly instead of animating
- Fixed hex grid positioning after transitions
- Fixed bloom blobs not updating during transitions
- Fixed approach rings not scaling with note body in ring mode

**Editor Stability**
- Fixed transition panel not appearing in browser mode
- Fixed note type selection not persisting
- Fixed timeline markers overlapping
- Fixed preview desync during rapid seeking

### 📚 Documentation

**New Guides**
- Layout Transitions Implementation Guide
- Transition Customization Guide
- Note Types System Guide
- Chart Folder Naming Convention
- EX Notes Implementation Guide

**Updated Documentation**
- README with transition features
- Keyboard shortcuts for note types
- Chart format specification
- Troubleshooting section

### 🎯 Chart Creation

**Demo Chart**
- `transition-demo.json` showcasing all transition features
- Multiple mode switches with different timings
- Various easing functions demonstrated
- Example of proper transition placement

**Transition Best Practices**
- Transition timing recommendations
- Mode selection guidelines
- Visual effect intensity suggestions
- Performance considerations

---

## Version 4.0.0 (January 2026)

**Major AI Auto-Mapper Update + Production-Ready Release**

### ✨ New Features

**Enhanced First-Time Setup Wizard**
- Modern Windows 11-inspired setup experience
- Comprehensive EULA with all third-party components and licensing
- Feature highlights showcase (AI Auto-Mapping, Visual Timeline, Real-time Preview)
- Step counter with progress dots and tooltips
- Keyboard navigation support (Enter to continue, Escape to go back)
- Smooth transitions and accessibility improvements
- Interactive EULA with scroll progress tracking
- Checkbox appears only when EULA is fully read
- Keyboard shortcuts reference on final screen
- Slider percentages for better clarity (e.g., "50%" instead of "0.5")

**10 Built-in Themes**
- 4 Basic Themes: Light, Dark, OLED (pure black #000000), High Contrast
- 6 Professional Themes: Dracula, Monokai, Tokyo Night, Nord, Solarized Dark, GitHub Dark
- Unified theme grid in settings modal
- Collapsible "More Themes" section in setup wizard
- Theme preview panels with descriptions
- Settings modal dynamically matches selected theme colors
- Toast notifications for theme changes

**Professional Menu Bar**
- File Menu: New, Open, Save, Save As, Import (osu!mania, Audio), Export, Settings, Exit
- Edit Menu: Undo, Redo, Select All, Delete, Copy, Paste (with keyboard shortcuts)
- View Menu: Zoom In/Out/Reset, Toggle Grid, Toggle Metronome, Full-Screen
- Playback Menu: Play/Pause, Stop, Jump to Start/End, Playback Speed (0.5x-1.5x)
- Tools Menu: AI Auto-Mapper, Train AI Model, Chart Statistics, Validate Chart
- Help Menu: Documentation, Keyboard Shortcuts, Check for Updates, About
- All menu items include keyboard shortcuts for power users

**Window Management**
- Fully resizable window (Discord-style) with minimum size 1024x768
- Smooth loading with no white flash
- Pre-loads everything before showing window
- Professional dark background during initialization

### 🎯 AI Improvements

**Enhanced Chart Generation**
- Improved note placement accuracy
- Better difficulty scaling across all levels
- Smarter chord placement logic
- Optimized density distribution

**Difficulty Scaling Fixes**
- Expert: Now generates 1000-1300 notes (previously 300-400)
- Master: Now generates 1400-1800 notes (previously 300-400)
- Improved target note counts for all difficulties
- Better balance between challenge and playability

**Audio Analysis**
- Enhanced onset detection system
- Improved beat tracking
- Better energy analysis
- Smarter sound classification

### 🔧 Technical Improvements

**Training System**
- Model now loads automatically on startup
- Fixed osu!mania chart detection
- Improved .osu file parser
- Better error handling
- Reduced console logging

**Performance**
- Faster chart generation
- More efficient audio processing
- Optimized memory usage

### 💅 UI/UX Improvements

**Settings Modal**
- Removed hardcoded CSS colors for better theme support
- Dynamic theme matching with background, text, borders, and inputs
- Blur background effect matching setup wizard design
- Improved visual consistency across all themes

**Gameplay Preview**
- Renamed from "Gameplay" to "Preview" for clarity
- Removed score text display (combo text remains)
- Cleaner preview experience

**Accessibility**
- Keyboard navigation throughout the application
- Tab index on interactive elements
- Better focus indicators
- Screen reader friendly labels

### 🔒 Security & Production Readiness

**Developer Tools Completely Disabled**
- Removed from View menu
- Set `devTools: false` in webPreferences
- Event listener prevents DevTools from opening
- All DevTools keyboard shortcuts blocked (F12, Ctrl+Shift+I/J/C)
- "Enable Debug Mode" option removed from settings
- Production-ready for end users

**Legal Compliance**
- Comprehensive EULA including:
  - License grant and restrictions
  - Third-party components (Electron, PixiJS, Anime.js)
  - Font licenses (Exo 2, Zen Maru Gothic)
  - Data privacy and AI training policies
  - Warranties and liability disclaimers
  - Contact information: redevoncommunity@gmail.com

### 📚 Documentation

**New Comprehensive README**
- Complete user guide with quick start
- Keyboard shortcuts reference
- AI training tutorial
- Troubleshooting section
- Technical details for advanced users

**MIT License**
- Now fully open source
- Developed by Kynix Teams
- Community contributions welcome

### 🐛 Bug Fixes

- Fixed trained model not loading on startup
- Fixed osu!mania charts being skipped during training
- Fixed BPM over-reliance in generated charts
- Fixed settings modal theme not matching selected theme
- Fixed theme clipping issues in setup wizard
- Fixed EULA checkbox appearing before scroll completion
- Improved error handling throughout

---

## Version 3.0.0 - "Professional Polish"

### ✨ New Features

- Official Windows Installer
- File Operations (open/save dialogs)

### 💅 UI/UX Improvements

- New App Icon
- Redesigned Menu Bar
- Slim & Stylish Scrollbars
- Fullscreen Confirmation Dialog

### 🐛 Bug Fixes

- Improved Fullscreen Stability

---

**Developed by Kynix Teams**
Open source under MIT License
