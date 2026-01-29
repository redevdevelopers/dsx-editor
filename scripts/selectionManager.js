/**
 * Selection Manager for DreamSyncX Editor
 * Handles single and multi-select of notes
 */

export class SelectionManager {
    constructor() {
        this.selectedNotes = new Set();
        this.clipboard = [];
        this.onSelectionChange = null;
    }

    /**
     * Select a single note (clears previous selection)
     */
    selectNote(note) {
        this.selectedNotes.clear();
        this.selectedNotes.add(note);
        this._notifyChange();
    }

    /**
     * Add note to selection (multi-select)
     */
    addToSelection(note) {
        this.selectedNotes.add(note);
        this._notifyChange();
    }

    /**
     * Remove note from selection
     */
    removeFromSelection(note) {
        this.selectedNotes.delete(note);
        this._notifyChange();
    }

    /**
     * Toggle note selection
     */
    toggleSelection(note) {
        if (this.selectedNotes.has(note)) {
            this.selectedNotes.delete(note);
        } else {
            this.selectedNotes.add(note);
        }
        this._notifyChange();
    }

    /**
     * Select multiple notes
     */
    selectMultiple(notes) {
        this.selectedNotes.clear();
        notes.forEach(note => this.selectedNotes.add(note));
        this._notifyChange();
    }

    /**
     * Select notes in time range
     */
    selectRange(startTime, endTime, allNotes) {
        this.selectedNotes.clear();
        allNotes.forEach(note => {
            if (note.time >= startTime && note.time <= endTime) {
                this.selectedNotes.add(note);
            }
        });
        this._notifyChange();
    }

    /**
     * Select all notes
     */
    selectAll(allNotes) {
        this.selectedNotes.clear();
        allNotes.forEach(note => this.selectedNotes.add(note));
        this._notifyChange();
    }

    /**
     * Clear selection
     */
    clearSelection() {
        this.selectedNotes.clear();
        this._notifyChange();
    }

    /**
     * Get selected notes as array
     */
    getSelection() {
        return Array.from(this.selectedNotes);
    }

    /**
     * Check if note is selected
     */
    isSelected(note) {
        return this.selectedNotes.has(note);
    }

    /**
     * Get selection count
     */
    getCount() {
        return this.selectedNotes.size;
    }

    /**
     * Copy selected notes to clipboard
     */
    copy() {
        this.clipboard = this.getSelection().map(note => ({
            time: note.time,
            zone: note.zone,
            type: note.type
        }));
        return this.clipboard.length;
    }

    /**
     * Cut selected notes to clipboard
     */
    cut() {
        this.copy();
        return this.getSelection(); // Return for deletion
    }

    /**
     * Paste notes at specified time
     */
    paste(pasteTime) {
        if (this.clipboard.length === 0) {
            return [];
        }

        // Calculate time offset
        const firstNoteTime = Math.min(...this.clipboard.map(n => n.time));
        const offset = pasteTime - firstNoteTime;

        // Create new notes with offset
        const pastedNotes = this.clipboard.map(note => ({
            time: note.time + offset,
            zone: note.zone,
            type: note.type
        }));
        return pastedNotes;
    }

    /**
     * Duplicate selected notes at offset
     */
    duplicate(timeOffset = 1000) {
        const duplicated = this.getSelection().map(note => ({
            time: note.time + timeOffset,
            zone: note.zone,
            type: note.type
        }));
        return duplicated;
    }

    /**
     * Notify selection change
     */
    _notifyChange() {
        if (this.onSelectionChange) {
            this.onSelectionChange(this.getSelection());
        }
    }
}
