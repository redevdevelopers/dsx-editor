import { ChartEditor } from './chartEditor.js';
import { InputHandler } from './input.js';

const editorRoot = document.getElementById('editor-root');
const chartEditor = new ChartEditor({ parent: editorRoot, input });
editorRoot.appendChild(chartEditor.getElement());