import { ChartEditor } from './chartEditor.js';

document.addEventListener('DOMContentLoaded', () => {
    const editorCanvasContainer = document.getElementById('editor-canvas-container');
    const timelineContainer = document.getElementById('timeline-container');
    const sidebarContainer = document.getElementById('sidebar-content');
    const toolbarContainer = document.getElementById('editor-toolbar');

    if (!editorCanvasContainer || !timelineContainer || !sidebarContainer || !toolbarContainer) {
        console.error('Fucking hell, one of the main containers is missing. Check your damn HTML.');
        return;
    }

    // Pass the containers to the editor so it knows where to put its shit
    const editor = new ChartEditor({
        editorCanvasContainer,
        timelineContainer,
        sidebarContainer,
        toolbarContainer
    });

    // Initialize the editor
    editor.init();
});
