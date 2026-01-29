export class ThemeImporter {
    constructor(editor) {
        this.editor = editor;
    }

    /**
     * Parse a VS Code theme JSON file and apply it to the editor
     * @param {File} file - The theme JSON file
     */
    async importTheme(file) {
        try {
            const text = await file.text();
            const themeData = JSON.parse(text);

            // Extract colors from VS Code theme
            const colors = themeData.colors || {};

            // Map VS Code colors to editor CSS variables
            const mappedTheme = this.mapVSCodeTheme(colors, themeData.name || 'Custom Theme');

            // Apply the theme
            this.applyCustomTheme(mappedTheme);

            // Save to localStorage
            this.saveCustomTheme(mappedTheme);

            return { success: true, themeName: mappedTheme.name };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Map VS Code theme colors to editor CSS variables
     */
    mapVSCodeTheme(colors, themeName) {
        return {
            name: themeName,
            // Background colors
            bgPrimary: colors['editor.background'] || '#1e1e1e',
            bgSecondary: colors['sideBar.background'] || colors['editor.background'] || '#252526',
            bgTertiary: colors['editorGroupHeader.tabsBackground'] || '#2d2d30',
            bgElevated: colors['dropdown.background'] || '#3e3e42',

            // Border colors
            borderColor: colors['editorGroup.border'] || colors['panel.border'] || '#3e3e42',

            // Text colors
            textPrimary: colors['editor.foreground'] || '#cccccc',
            textSecondary: colors['descriptionForeground'] || '#969696',

            // Accent colors
            accentPrimary: colors['button.background'] || colors['focusBorder'] || '#0e639c',
            accentHover: colors['button.hoverBackground'] || '#1177bb',
            accentActive: colors['button.background'] || '#0d5a8f',

            // Status colors
            success: colors['terminal.ansiGreen'] || '#4ec9b0',
            warning: colors['terminal.ansiYellow'] || '#ce9178',
            error: colors['terminal.ansiRed'] || '#f48771',

            // Toolbar/Header
            toolbarBg: colors['editorGroupHeader.tabsBackground'] || '#323233',
            headerBg: colors['titleBar.activeBackground'] || '#252526',
            iconbarBg: colors['activityBar.background'] || '#333333',
            statusbarBg: colors['statusBar.background'] || '#0e639c',

            // Timeline
            timelineBg: colors['editor.background'] || '#252526',
        };
    }

    /**
     * Apply custom theme to the editor
     */
    applyCustomTheme(theme) {
        const root = document.documentElement;
        const body = document.body;

        // Remove existing theme classes
        body.classList.remove('theme-light', 'theme-dark', 'theme-oled', 'theme-high-contrast');
        body.classList.add('theme-custom');

        // Apply CSS variables
        root.style.setProperty('--bg-primary', theme.bgPrimary);
        root.style.setProperty('--bg-secondary', theme.bgSecondary);
        root.style.setProperty('--bg-tertiary', theme.bgTertiary);
        root.style.setProperty('--bg-elevated', theme.bgElevated);
        root.style.setProperty('--border-color', theme.borderColor);
        root.style.setProperty('--text-primary', theme.textPrimary);
        root.style.setProperty('--text-secondary', theme.textSecondary);
        root.style.setProperty('--accent-primary', theme.accentPrimary);
        root.style.setProperty('--accent-hover', theme.accentHover);
        root.style.setProperty('--accent-active', theme.accentActive);
        root.style.setProperty('--success', theme.success);
        root.style.setProperty('--warning', theme.warning);
        root.style.setProperty('--error', theme.error);

        // Apply specific element backgrounds
        const toolbar = document.getElementById('editor-toolbar');
        const header = document.getElementById('app-header');
        const iconbar = document.getElementById('iconbar');
        const statusbar = document.getElementById('statusbar');
        const timeline = document.getElementById('timeline-container');

        if (toolbar) toolbar.style.backgroundColor = theme.toolbarBg;
        if (header) header.style.backgroundColor = theme.headerBg;
        if (iconbar) iconbar.style.backgroundColor = theme.iconbarBg;
        if (statusbar) statusbar.style.backgroundColor = theme.statusbarBg;
        if (timeline) timeline.style.backgroundColor = theme.timelineBg;

        // Update timeline background color
        if (this.editor.timeline && this.editor.timeline.updateBackgroundColor) {
            this.editor.timeline.updateBackgroundColor();
            this.editor.timeline.createGrid();
        }
    }

    /**
     * Save custom theme to localStorage
     */
    saveCustomTheme(theme) {
        const customThemes = JSON.parse(localStorage.getItem('customThemes') || '[]');

        // Check if theme already exists
        const existingIndex = customThemes.findIndex(t => t.name === theme.name);
        if (existingIndex >= 0) {
            customThemes[existingIndex] = theme;
        } else {
            customThemes.push(theme);
        }

        localStorage.setItem('customThemes', JSON.stringify(customThemes));

        // Save as current theme
        const settings = JSON.parse(localStorage.getItem('editorSettings') || '{}');
        settings.theme = 'custom';
        settings.customThemeName = theme.name;
        localStorage.setItem('editorSettings', JSON.stringify(settings));
    }

    /**
     * Get all saved custom themes
     */
    getCustomThemes() {
        return JSON.parse(localStorage.getItem('customThemes') || '[]');
    }

    /**
     * Load a saved custom theme by name
     */
    loadCustomTheme(themeName) {
        const customThemes = this.getCustomThemes();
        const theme = customThemes.find(t => t.name === themeName);

        if (theme) {
            this.applyCustomTheme(theme);
            return true;
        }
        return false;
    }

    /**
     * Delete a custom theme
     */
    deleteCustomTheme(themeName) {
        const customThemes = this.getCustomThemes();
        const filtered = customThemes.filter(t => t.name !== themeName);
        localStorage.setItem('customThemes', JSON.stringify(filtered));
    }

    /**
     * Show theme import dialog
     */
    showImportDialog() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.style.display = 'none';

        input.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                const result = await this.importTheme(file);

                if (result.success) {
                    this.showToast(`Theme "${result.themeName}" imported successfully!`, 'success');
                } else {
                    this.showToast(`Failed to import theme: ${result.error}`, 'error');
                }
            }
            input.remove();
        });

        document.body.appendChild(input);
        input.click();
    }

    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = 'editor-toast';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 32px;
            right: 20px;
            background-color: ${type === 'success' ? '#4ec9b0' : type === 'error' ? '#f48771' : '#0e639c'};
            color: white;
            padding: 12px 20px;
            border-radius: 4px;
            font-size: 13px;
            z-index: 100000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease-out;
        `;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}
