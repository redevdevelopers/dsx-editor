# DreamSyncX Chart Editor - Release Notes

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

### 🔮 Future Improvements

- Additional difficulty expression modes
- Enhanced pattern recognition
- More training data format support
- Community-requested features

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
