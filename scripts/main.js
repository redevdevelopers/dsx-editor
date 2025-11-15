import { ChartEditor } from './chartEditor.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- Apply visual settings from localStorage before initializing anything ---
    try {
        const savedSettings = localStorage.getItem('chartEditorSettings');
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            // Set anti-aliasing for PIXI
            if (typeof settings.useAntialiasing === 'boolean') {
                window.PIXI.settings.ANTI_ALIAS = settings.useAntialiasing;
            }
            // Set app background color/gradient
            if (settings.appBackgroundColor) {
                document.body.style.background = settings.appBackgroundColor;
            }
        }
    } catch (e) {
        console.error('Failed to apply saved settings on load:', e);
    }

    const editorCanvasContainer = document.getElementById('editor-canvas-container');
    const timelineContainer = document.getElementById('timeline-container');
    const sidebarContainer = document.getElementById('sidebar-content');
    const toolbarContainer = document.getElementById('editor-toolbar');

    if (!editorCanvasContainer || !timelineContainer || !sidebarContainer || !toolbarContainer) {
        console.error('One or more critical UI containers are missing. Please check the HTML structure.');
        return;
    }

    const editor = new ChartEditor({
        editorCanvasContainer,
        timelineContainer,
        sidebarContainer,
        toolbarContainer
    });

    // Initialize the editor
    editor.init();
});
