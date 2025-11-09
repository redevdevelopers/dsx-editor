export class CommandManager {
    constructor() {
        this.history = [];
        this.currentIndex = -1;
    }

    execute(command) {
        // Remove any "redo" commands if a new command is executed
        if (this.currentIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.currentIndex + 1);
        }
        this.history.push(command);
        this.currentIndex++;
        command.execute();
    }

    undo() {
        if (this.currentIndex >= 0) {
            const command = this.history[this.currentIndex];
            command.undo();
            this.currentIndex--;
        }
    }

    redo() {
        if (this.currentIndex < this.history.length - 1) {
            this.currentIndex++;
            const command = this.history[this.currentIndex];
            command.execute();
        }
    }
}

// Base Command class
export class Command {
    execute() {
        throw new Error("Execute method must be implemented by subclasses");
    }

    undo() {
        throw new Error("Undo method must be implemented by subclasses");
    }
}

// Example: AddNoteCommand
export class AddNoteCommand extends Command {
    constructor(chartData, note) {
        super();
        this.chartData = chartData;
        this.note = note;
    }

    execute() {
        console.log("AddNoteCommand: Before execute, notes:", this.chartData.raw.notes.length, this.chartData.raw.notes);
        this.chartData.raw.notes.push(this.note);
        this.chartData.raw.notes.sort((a, b) => a.time - b.time);
        console.log("AddNoteCommand: After execute, notes:", this.chartData.raw.notes.length, this.chartData.raw.notes);
    }

    undo() {
        console.log("AddNoteCommand: Before undo, notes:", this.chartData.raw.notes.length, this.chartData.raw.notes);
        const index = this.chartData.raw.notes.indexOf(this.note);
        if (index > -1) {
            this.chartData.raw.notes.splice(index, 1);
        }
        console.log("AddNoteCommand: After undo, notes:", this.chartData.raw.notes.length, this.chartData.raw.notes);
    }
}

// Example: DeleteNoteCommand
export class DeleteNoteCommand extends Command {
    constructor(chartData, note) {
        super();
        this.chartData = chartData;
        this.note = note;
        this.originalIndex = -1; // To store the original position for undo
    }

    execute() {
        console.log("DeleteNoteCommand: Before execute, notes:", this.chartData.raw.notes.length, this.chartData.raw.notes);
        const index = this.chartData.raw.notes.indexOf(this.note);
        if (index > -1) {
            this.originalIndex = index;
            this.chartData.raw.notes.splice(index, 1);
        }
        console.log("DeleteNoteCommand: After execute, notes:", this.chartData.raw.notes.length, this.chartData.raw.notes);
    }

    undo() {
        console.log("DeleteNoteCommand: Before undo, notes:", this.chartData.raw.notes.length, this.chartData.raw.notes);
        if (this.originalIndex > -1) {
            this.chartData.raw.notes.splice(this.originalIndex, 0, this.note);
            this.chartData.raw.notes.sort((a, b) => a.time - b.time); // Re-sort just in case
        }
        console.log("DeleteNoteCommand: After undo, notes:", this.chartData.raw.notes.length, this.chartData.raw.notes);
    }
}

// Example: MoveNoteCommand
export class MoveNoteCommand extends Command {
    constructor(chartData, note, oldTime, oldZone, newTime, newZone) {
        super();
        this.chartData = chartData;
        this.note = note;
        this.oldTime = oldTime;
        this.oldZone = oldZone;
        this.newTime = newTime;
        this.newZone = newZone;
    }

    execute() {
        this.note.time = this.newTime;
        this.note.zone = this.newZone;
        this.chartData.raw.notes.sort((a, b) => a.time - b.time);
    }

    undo() {
        this.note.time = this.oldTime;
        this.note.zone = this.oldZone;
        this.chartData.raw.notes.sort((a, b) => a.time - b.time);
    }
}
