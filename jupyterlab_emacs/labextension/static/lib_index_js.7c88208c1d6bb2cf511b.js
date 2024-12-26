"use strict";
(self["webpackChunk_zigeuner_jupyterlab_emacs"] = self["webpackChunk_zigeuner_jupyterlab_emacs"] || []).push([["lib_index_js"],{

/***/ "./lib/codemirrorCommands.js":
/*!***********************************!*\
  !*** ./lib/codemirrorCommands.js ***!
  \***********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   VimCellManager: () => (/* binding */ VimCellManager),
/* harmony export */   VimEditorManager: () => (/* binding */ VimEditorManager)
/* harmony export */ });
/* harmony import */ var _replit_codemirror_vim__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @replit/codemirror-vim */ "webpack/sharing/consume/default/@replit/codemirror-vim/@replit/codemirror-vim");
/* harmony import */ var _replit_codemirror_vim__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_replit_codemirror_vim__WEBPACK_IMPORTED_MODULE_0__);

class VimEditorManager {
    constructor({ enabled, userKeybindings }) {
        this._lastActiveEditor = null;
        this.enabled = enabled;
        this.userKeybindings = userKeybindings !== null && userKeybindings !== void 0 ? userKeybindings : [];
    }
    async onActiveEditorChanged(tracker, activeEditor) {
        if (!activeEditor) {
            return;
        }
        await activeEditor.content.ready;
        this.modifyEditor(activeEditor.content.editor);
    }
    updateLastActive() {
        if (!this._lastActiveEditor) {
            return;
        }
        this.modifyEditor(this._lastActiveEditor);
    }
    /**
     * Hook up vim mode into given editor.
     * Returns true if vim mode was enabled.
     */
    modifyEditor(editor) {
        if (!editor) {
            throw Error('Editor not available');
        }
        // JupyterLab 4.0 only supports CodeMirror editors
        const mirrorEditor = editor;
        this._lastActiveEditor = mirrorEditor;
        const view = mirrorEditor.editor;
        if (this.enabled) {
            if (!mirrorEditor.getOption('vim')) {
                // this erases state, we do not want to call it if not needed.
                mirrorEditor.setOption('vim', true);
                // On each key press the notebook (`Notebook.handleEvent`) invokes
                // a handler ensuring focus (`Notebook._ensureFocus`); the logic does
                // not work well for the `ex commands` panel which is always interpreted
                // as blurred because it exists outside of the CodeMirror6 state; here
                // we override `hasFocus` handler to ensure it is taken into account.
                const cm = (0,_replit_codemirror_vim__WEBPACK_IMPORTED_MODULE_0__.getCM)(view);
                cm.on('vim-mode-change', () => {
                    if (!cm.state.vim) {
                        throw Error('CodeMirror vim state not available');
                        return;
                    }
                    editor.host.dataset.jpVimModeName = cm.state.vim.mode;
                });
                mirrorEditor.hasFocus = () => {
                    if (cm.state.dialog &&
                        cm.state.dialog.contains(document.activeElement)) {
                        return true;
                    }
                    return view.hasFocus;
                };
            }
            // Override vim-mode undo/redo to make it work with JupyterLab RTC-aware
            // history; it needs to happen on every change of the editor.
            _replit_codemirror_vim__WEBPACK_IMPORTED_MODULE_0__.Vim.defineAction('undo', (cm, options) => {
                for (let i = 0; i < options.repeat; i++) {
                    editor.undo();
                }
            });
            _replit_codemirror_vim__WEBPACK_IMPORTED_MODULE_0__.Vim.defineAction('redo', (cm, options) => {
                for (let i = 0; i < options.repeat; i++) {
                    editor.redo();
                }
            });
            const lcm = (0,_replit_codemirror_vim__WEBPACK_IMPORTED_MODULE_0__.getCM)(view);
            // Clear existing user keybindings, then re-register in case they changed in the user settings
            ['normal', 'visual', 'insert'].forEach(ctx => _replit_codemirror_vim__WEBPACK_IMPORTED_MODULE_0__.Vim.mapclear(ctx));
            this.userKeybindings.forEach(({ command, keys, context, mapfn, enabled: keybindEnabled }) => {
                if (keybindEnabled) {
                    if (mapfn === 'map') {
                        _replit_codemirror_vim__WEBPACK_IMPORTED_MODULE_0__.Vim.map(command, keys, context);
                    }
                    else {
                        _replit_codemirror_vim__WEBPACK_IMPORTED_MODULE_0__.Vim.noremap(command, keys, context);
                    }
                }
            });
            _replit_codemirror_vim__WEBPACK_IMPORTED_MODULE_0__.Vim.handleKey(lcm, '<Esc>');
            return true;
        }
        else if (mirrorEditor.getOption('vim')) {
            mirrorEditor.setOption('vim', false);
            return false;
        }
        return false;
    }
}
class VimCellManager extends VimEditorManager {
    constructor({ commands, enabled, userKeybindings }) {
        super({ userKeybindings, enabled });
        this._lastActiveCell = null;
        this._commands = commands;
    }
    onActiveCellChanged(tracker, activeCell) {
        var _a, _b;
        const activeCellContext = {
            index: (_a = tracker.currentWidget) === null || _a === void 0 ? void 0 : _a.content.activeCellIndex,
            cellCount: (_b = tracker.currentWidget) === null || _b === void 0 ? void 0 : _b.content.widgets.length
        };
        this.modifyCell(activeCell, activeCellContext).catch(console.error);
    }
    updateLastActive() {
        if (!this._lastActiveCell || !this._lastActiveCellContext) {
            return;
        }
        this.modifyCell(this._lastActiveCell, this._lastActiveCellContext);
    }
    async modifyCell(activeCell, activeCellContext) {
        if (!activeCell || !activeCellContext) {
            return;
        }
        this._lastActiveCell = activeCell;
        this._lastActiveCellContext = activeCellContext;
        await activeCell.ready;
        if (activeCell.isDisposed) {
            console.warn('Cell was already disposed, cannot setup vim mode');
            return;
        }
        const wasEnabled = this.modifyEditor(activeCell.editor);
        if (wasEnabled) {
            this._modifyEdgeNavigation(activeCell, activeCellContext);
        }
    }
    _modifyEdgeNavigation(activeCell, activeCellContext) {
        // Define a function to use as Vim motion
        // This replaces the codemirror moveByLines function to
        // for jumping between notebook cells.
        const moveByLinesOrCell = (cm, head, motionArgs, vim) => {
            const cur = head;
            let endCh = cur.ch;
            const currentCell = activeCell;
            // TODO: these references will be undefined
            // Depending what our last motion was, we may want to do different
            // things. If our last motion was moving vertically, we want to
            // preserve the HPos from our last horizontal move.  If our last motion
            // was going to the end of a line, moving vertically we should go to
            // the end of the line, etc.
            switch (vim === null || vim === void 0 ? void 0 : vim.lastMotion) {
                case cm.moveByLines:
                case cm.moveByDisplayLines:
                case cm.moveByScroll:
                case cm.moveToColumn:
                case cm.moveToEol:
                // JUPYTER PATCH: add our custom method to the motion cases
                // eslint-disable-next-line no-fallthrough
                case moveByLinesOrCell:
                    endCh = vim.lastHPos;
                    break;
                default:
                    vim.lastHPos = endCh;
            }
            const repeat = motionArgs.repeat + (motionArgs.repeatOffset || 0);
            let line = motionArgs.forward ? cur.line + repeat : cur.line - repeat;
            const first = cm.firstLine();
            const last = cm.lastLine();
            const posV = cm.findPosV(cur, motionArgs.forward ? repeat : -repeat, 'line', vim.lastHSPos);
            const hasMarkedText = motionArgs.forward
                ? posV.line > line
                : posV.line < line;
            if (hasMarkedText) {
                line = posV.line;
                endCh = posV.ch;
            }
            // JUPYTER PATCH BEGIN
            // here we insert the jumps to the next cells
            if (line < first || line > last) {
                // var currentCell = ns.notebook.get_selected_cell();
                // var currentCell = tracker.activeCell;
                // var key = '';
                // `currentCell !== null should not be needed since `activeCell`
                // is already check against null (row 61). Added to avoid warning.
                if (currentCell !== null &&
                    currentCell.model.type === 'markdown' &&
                    !(!motionArgs.forward && activeCellContext.index === 0)) {
                    if (!motionArgs.handleArrow) {
                        // markdown cells tends to improperly handle arrow keys movement,
                        //  on the way up the cell is rendered, but down movement is ignored
                        //  when use arrows the cell will remain unrendered (need to shift+enter)
                        //  However, this is the same as Jupyter default behaviour
                        currentCell.rendered = true;
                    }
                    // currentCell.execute();
                }
                if (motionArgs.forward) {
                    // ns.notebook.select_next();
                    if (!motionArgs.handleArrow) {
                        this._commands.execute('notebook:move-cursor-down');
                    }
                    else {
                        // This block preventing double cell hop when you use arrow keys for navigation
                        //    also arrow key navigation works properly when current cursor position
                        //    at the beginning of line for up move, and at the end for down move
                        const cursor = cm.getCursor();
                        // CM6 is 1-based
                        const last_char = cm.cm6.state.doc.line(last + 1).length;
                        if (cursor.line !== last || cursor.ch !== last_char) {
                            cm.setCursor(last, last_char);
                            this._commands.execute('notebook:move-cursor-down');
                        }
                    }
                    // key = 'j';
                }
                else {
                    // ns.notebook.select_prev();
                    if (!motionArgs.handleArrow) {
                        this._commands.execute('notebook:move-cursor-up');
                    }
                    else {
                        // This block preventing double cell hop when you use arrow keys for navigation
                        //    also arrow key navigation works properly when current cursor position
                        //    at the beginning of line for up move, and at the end for down move
                        const cursor = cm.getCursor();
                        if (cursor.line !== 0 || cursor.ch !== 0) {
                            cm.setCursor(0, 0);
                            this._commands.execute('notebook:move-cursor-up');
                        }
                    }
                    // key = 'k';
                }
                return;
            }
            // JUPYTER PATCH END
            // function taken from https://github.com/codemirror/CodeMirror/blob/9d0f9d19de70abe817e8b8e161034fbd3f907030/keymap/vim.js#L3328
            function findFirstNonWhiteSpaceCharacter(text) {
                if (!text) {
                    return 0;
                }
                const firstNonWS = text.search(/\S/);
                return firstNonWS === -1 ? text.length : firstNonWS;
            }
            if (motionArgs.toFirstChar) {
                endCh = findFirstNonWhiteSpaceCharacter(cm.getLine(line));
                vim.lastHPos = endCh;
            }
            vim.lastHSPos = cm.charCoords(new _replit_codemirror_vim__WEBPACK_IMPORTED_MODULE_0__.CodeMirror.Pos(line, endCh), 'div').left;
            return new _replit_codemirror_vim__WEBPACK_IMPORTED_MODULE_0__.CodeMirror.Pos(line, endCh);
        };
        _replit_codemirror_vim__WEBPACK_IMPORTED_MODULE_0__.Vim.defineMotion('moveByLinesOrCell', moveByLinesOrCell);
        _replit_codemirror_vim__WEBPACK_IMPORTED_MODULE_0__.Vim.mapCommand('<Up>', 'motion', 'moveByLinesOrCell', { forward: false, linewise: true, handleArrow: true }, { context: 'normal' });
        _replit_codemirror_vim__WEBPACK_IMPORTED_MODULE_0__.Vim.mapCommand('<Down>', 'motion', 'moveByLinesOrCell', { forward: true, linewise: true, handleArrow: true }, { context: 'normal' });
        _replit_codemirror_vim__WEBPACK_IMPORTED_MODULE_0__.Vim.mapCommand('k', 'motion', 'moveByLinesOrCell', { forward: false, linewise: true }, { context: 'normal' });
        _replit_codemirror_vim__WEBPACK_IMPORTED_MODULE_0__.Vim.mapCommand('j', 'motion', 'moveByLinesOrCell', { forward: true, linewise: true }, { context: 'normal' });
        _replit_codemirror_vim__WEBPACK_IMPORTED_MODULE_0__.Vim.defineAction('moveCellDown', (cm, actionArgs) => {
            this._commands.execute('notebook:move-cell-down');
        });
        _replit_codemirror_vim__WEBPACK_IMPORTED_MODULE_0__.Vim.defineAction('moveCellUp', (cm, actionArgs) => {
            this._commands.execute('notebook:move-cell-up');
        });
        _replit_codemirror_vim__WEBPACK_IMPORTED_MODULE_0__.Vim.mapCommand('<C-e>', 'action', 'moveCellDown', {}, { extra: 'normal' });
        _replit_codemirror_vim__WEBPACK_IMPORTED_MODULE_0__.Vim.mapCommand('<C-y>', 'action', 'moveCellUp', {}, { extra: 'normal' });
        _replit_codemirror_vim__WEBPACK_IMPORTED_MODULE_0__.Vim.defineAction('splitCell', (cm, actionArgs) => {
            this._commands.execute('notebook:split-cell-at-cursor');
        });
        _replit_codemirror_vim__WEBPACK_IMPORTED_MODULE_0__.Vim.mapCommand('-', 'action', 'splitCell', {}, { extra: 'normal' });
    }
}


/***/ }),

/***/ "./lib/index.js":
/*!**********************!*\
  !*** ./lib/index.js ***!
  \**********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @jupyterlab/notebook */ "webpack/sharing/consume/default/@jupyterlab/notebook");
/* harmony import */ var _jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _jupyterlab_fileeditor__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @jupyterlab/fileeditor */ "webpack/sharing/consume/default/@jupyterlab/fileeditor");
/* harmony import */ var _jupyterlab_fileeditor__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_jupyterlab_fileeditor__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _jupyterlab_codemirror__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @jupyterlab/codemirror */ "webpack/sharing/consume/default/@jupyterlab/codemirror");
/* harmony import */ var _jupyterlab_codemirror__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_jupyterlab_codemirror__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _jupyterlab_settingregistry__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @jupyterlab/settingregistry */ "webpack/sharing/consume/default/@jupyterlab/settingregistry");
/* harmony import */ var _jupyterlab_settingregistry__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(_jupyterlab_settingregistry__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var _replit_codemirror_vim__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @replit/codemirror-vim */ "webpack/sharing/consume/default/@replit/codemirror-vim/@replit/codemirror-vim");
/* harmony import */ var _replit_codemirror_vim__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(_replit_codemirror_vim__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var _codemirror_view__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @codemirror/view */ "webpack/sharing/consume/default/@codemirror/view");
/* harmony import */ var _codemirror_view__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(_codemirror_view__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var _codemirror_state__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @codemirror/state */ "webpack/sharing/consume/default/@codemirror/state");
/* harmony import */ var _codemirror_state__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(_codemirror_state__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var _codemirrorCommands__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./codemirrorCommands */ "./lib/codemirrorCommands.js");
/* harmony import */ var _labCommands__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./labCommands */ "./lib/labCommands.js");









const PLUGIN_NAME = '@axlair/jupyterlab_vim';
const TOGGLE_ID = 'jupyterlab-vim:toggle';
let enabled = false;
let enabledInEditors = true;
let escToCmdMode = true;
let shiftEscOverrideBrowser = true;
/**
 * Initialization data for the jupyterlab_vim extension.
 */
const extension = {
    id: PLUGIN_NAME,
    autoStart: true,
    activate: activateCellVim,
    requires: [_jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_0__.INotebookTracker, _jupyterlab_codemirror__WEBPACK_IMPORTED_MODULE_2__.IEditorExtensionRegistry, _jupyterlab_settingregistry__WEBPACK_IMPORTED_MODULE_3__.ISettingRegistry],
    optional: [_jupyterlab_fileeditor__WEBPACK_IMPORTED_MODULE_1__.IEditorTracker]
};
async function activateCellVim(app, notebookTracker, editorExtensionRegistry, settingRegistry, editorTracker) {
    const theme = _codemirror_state__WEBPACK_IMPORTED_MODULE_6__.Prec.highest(_codemirror_view__WEBPACK_IMPORTED_MODULE_5__.EditorView.theme({
        '.cm-fat-cursor': {
            position: 'absolute',
            background: 'var(--jp-vim-cursor-color)',
            border: 'none',
            whiteSpace: 'pre'
        },
        '&:not(.cm-focused) .cm-fat-cursor': {
            background: 'none',
            outline: 'solid 1px var(--jp-vim-cursor-color)',
            color: 'transparent !important'
        }
    }));
    editorExtensionRegistry.addExtension({
        name: 'vim',
        factory: options => {
            return _jupyterlab_codemirror__WEBPACK_IMPORTED_MODULE_2__.EditorExtensionRegistry.createConditionalExtension([
                theme,
                (0,_replit_codemirror_vim__WEBPACK_IMPORTED_MODULE_4__.vim)({
                    status: false
                })
            ]);
        }
    });
    app.commands.addCommand(TOGGLE_ID, {
        label: 'Enable Vim Mode',
        execute: () => {
            if (settingRegistry) {
                void settingRegistry.set(`${PLUGIN_NAME}:plugin`, 'enabled', !enabled);
            }
        },
        isToggled: () => enabled
    });
    app.commands.addCommand('vim:enter-normal-mode', {
        label: 'Enter Normal Vim Mode',
        execute: () => {
            const current = app.shell.currentWidget;
            if (!current) {
                console.warn('Current widget not found');
            }
            else if (editorTracker.currentWidget === current) {
                editorManager.modifyEditor(editorTracker.currentWidget.content.editor);
            }
            else if (notebookTracker.currentWidget === current) {
                const activeCellContext = {
                    index: notebookTracker.currentWidget.content.activeCellIndex,
                    cellCount: notebookTracker.currentWidget.content.widgets.length
                };
                cellManager.modifyCell(notebookTracker.currentWidget.content.activeCell, activeCellContext);
            }
            else {
                console.warn('Current widget is not vim-enabled');
            }
        },
        isEnabled: () => enabled
    });
    const userKeybindings = (await settingRegistry.get(`${PLUGIN_NAME}:plugin`, 'extraKeybindings')).composite;
    const cellManager = new _codemirrorCommands__WEBPACK_IMPORTED_MODULE_7__.VimCellManager({
        commands: app.commands,
        enabled,
        userKeybindings
    });
    const editorManager = new _codemirrorCommands__WEBPACK_IMPORTED_MODULE_7__.VimEditorManager({
        enabled: enabled && enabledInEditors,
        userKeybindings
    });
    let escBinding = null;
    let hasEverBeenEnabled = false;
    _replit_codemirror_vim__WEBPACK_IMPORTED_MODULE_4__.Vim.defineEx('write', 'w', () => {
        app.commands.execute('docmanager:save');
    });
    _replit_codemirror_vim__WEBPACK_IMPORTED_MODULE_4__.Vim.defineEx('quit', 'q', () => {
        // In JupyterLab 4.0 needs to be executed after vim panel has closed, here
        // achived by moving it to end of execution stack with `setTimeout()`.
        setTimeout(() => {
            app.commands.execute('notebook:enter-command-mode');
        });
    });
    // it's ok to connect here because we will never reach the vim section unless
    // ensureVimKeyMap has been called due to the checks for enabled.
    // we need to have now in order to keep track of the last active cell
    // so that we can modify it when vim is turned on or off.
    notebookTracker.activeCellChanged.connect(cellManager.onActiveCellChanged, cellManager);
    editorTracker.currentChanged.connect(editorManager.onActiveEditorChanged, editorManager);
    const shell = app.shell;
    shell.currentChanged.connect(() => {
        const current = shell.currentWidget;
        if (!current) {
            // no-op
        }
        else if (editorTracker.currentWidget === current) {
            editorManager.modifyEditor(editorTracker.currentWidget.content.editor);
        }
        else if (notebookTracker.currentWidget === current) {
            const activeCellContext = {
                index: notebookTracker.currentWidget.content.activeCellIndex,
                cellCount: notebookTracker.currentWidget.content.widgets.length
            };
            cellManager.modifyCell(notebookTracker.currentWidget.content.activeCell, activeCellContext);
        }
        else {
            // no-op
        }
    });
    (0,_labCommands__WEBPACK_IMPORTED_MODULE_8__.addNotebookCommands)(app, notebookTracker);
    async function updateSettings(settings) {
        const userKeybindings = (await settingRegistry.get(`${PLUGIN_NAME}:plugin`, 'extraKeybindings')).composite;
        enabled = settings.get('enabled').composite === true;
        enabledInEditors = settings.get('enabledInEditors').composite === true;
        const cmdModeKeys = settings.get('cmdModeKeys')
            .composite;
        if (!cmdModeKeys) {
            // no-op
        }
        else {
            escToCmdMode = cmdModeKeys['escToCmdMode'];
            shiftEscOverrideBrowser = cmdModeKeys['shiftEscOverrideBrowser'];
        }
        app.commands.notifyCommandChanged(TOGGLE_ID);
        cellManager.enabled = enabled;
        cellManager.userKeybindings = userKeybindings;
        editorManager.enabled = enabled && enabledInEditors;
        editorManager.userKeybindings = userKeybindings;
        if (enabled) {
            escBinding === null || escBinding === void 0 ? void 0 : escBinding.dispose();
            if (!hasEverBeenEnabled) {
                hasEverBeenEnabled = true;
                await app.restored;
            }
        }
        else {
            escBinding = app.commands.addKeyBinding({
                command: 'notebook:enter-command-mode',
                keys: ['Escape'],
                selector: '.jp-Notebook.jp-mod-editMode'
            });
        }
        notebookTracker.forEach(notebook => {
            notebook.node.dataset.jpVimMode = `${enabled}`;
            notebook.node.dataset.jpVimEscToCmdMode = `${escToCmdMode}`;
            notebook.node.dataset.jpVimShiftEscOverrideBrowser = `${shiftEscOverrideBrowser}`;
        });
        editorTracker.forEach(document => {
            document.node.dataset.jpVimMode = `${enabled && enabledInEditors}`;
        });
        editorManager === null || editorManager === void 0 ? void 0 : editorManager.updateLastActive();
        cellManager === null || cellManager === void 0 ? void 0 : cellManager.updateLastActive();
        // make sure our css selector is added to new notebooks
        notebookTracker.widgetAdded.connect((sender, notebook) => {
            notebook.node.dataset.jpVimMode = `${enabled}`;
            notebook.node.dataset.jpVimEscToCmdMode = `${escToCmdMode}`;
            notebook.node.dataset.jpVimShiftEscOverrideBrowser = `${shiftEscOverrideBrowser}`;
        });
        editorTracker.widgetAdded.connect((sender, document) => {
            document.node.dataset.jpVimMode = `${enabled && enabledInEditors}`;
        });
    }
    settingRegistry.load(`${PLUGIN_NAME}:plugin`).then((settings) => {
        updateSettings(settings);
        settings.changed.connect(updateSettings);
    }, (err) => {
        console.error(`Could not load settings, so did not active ${PLUGIN_NAME}: ${err}`);
    });
    return Promise.resolve();
}
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (extension);


/***/ }),

/***/ "./lib/labCommands.js":
/*!****************************!*\
  !*** ./lib/labCommands.js ***!
  \****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   addNotebookCommands: () => (/* binding */ addNotebookCommands)
/* harmony export */ });
/* harmony import */ var _replit_codemirror_vim__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @replit/codemirror-vim */ "webpack/sharing/consume/default/@replit/codemirror-vim/@replit/codemirror-vim");
/* harmony import */ var _replit_codemirror_vim__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_replit_codemirror_vim__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @jupyterlab/notebook */ "webpack/sharing/consume/default/@jupyterlab/notebook");
/* harmony import */ var _jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_1__);


function addNotebookCommands(app, tracker) {
    const { commands, shell } = app;
    function getCurrent(args) {
        const widget = tracker.currentWidget;
        const activate = args['activate'] !== false;
        // Should we expose `activeWidget` in `IShell`?
        // when `activateById` is called the Notebook handler focuses current editor
        // which leads to bluring the panel for inputing ex commands and may render
        // the use of ex commands impossible if called needlesly.
        if (activate && widget && shell.currentWidget !== widget) {
            shell.activateById(widget.id);
        }
        return widget;
    }
    function isEnabled() {
        return (tracker.currentWidget !== null &&
            tracker.currentWidget === app.shell.currentWidget);
    }
    const addedCommands = [
        commands.addCommand('vim:run-select-next-edit', {
            label: 'Run Cell and Edit Next Cell',
            execute: args => {
                const current = getCurrent(args);
                if (current) {
                    const { context, content } = current;
                    _jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_1__.NotebookActions.runAndAdvance(content, context.sessionContext);
                    current.content.mode = 'edit';
                }
            },
            isEnabled
        }),
        commands.addCommand('vim:run-cell-and-edit', {
            label: 'Run Cell and Edit Cell',
            execute: args => {
                const current = getCurrent(args);
                if (current) {
                    const { context, content } = current;
                    _jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_1__.NotebookActions.run(content, context.sessionContext);
                    // Don't re-enter edit mode for markdown cells
                    if (content.activeCell !== null &&
                        content.activeCell.model.type === 'markdown') {
                        // no-op
                    }
                    else {
                        current.content.mode = 'edit';
                    }
                }
            },
            isEnabled
        }),
        commands.addCommand('vim:cut-cell-and-edit', {
            label: 'Cut Cell(s) and Edit Cell',
            execute: args => {
                const current = getCurrent(args);
                if (current) {
                    const { content } = current;
                    _jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_1__.NotebookActions.cut(content);
                    content.mode = 'edit';
                }
            },
            isEnabled
        }),
        commands.addCommand('vim:copy-cell-and-edit', {
            label: 'Copy Cell(s) and Edit Cell',
            execute: args => {
                const current = getCurrent(args);
                if (current) {
                    const { content } = current;
                    _jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_1__.NotebookActions.copy(content);
                    content.mode = 'edit';
                }
            },
            isEnabled
        }),
        commands.addCommand('vim:paste-cell-and-edit', {
            label: 'Paste Cell(s) and Edit Cell',
            execute: args => {
                const current = getCurrent(args);
                if (current) {
                    const { content } = current;
                    _jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_1__.NotebookActions.paste(content, 'below');
                    content.mode = 'edit';
                }
            },
            isEnabled
        }),
        commands.addCommand('vim:merge-and-edit', {
            label: 'Merge and Edit Cell',
            execute: args => {
                const current = getCurrent(args);
                if (current) {
                    const { content } = current;
                    _jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_1__.NotebookActions.mergeCells(content);
                    current.content.mode = 'edit';
                }
            },
            isEnabled
        }),
        commands.addCommand('vim:enter-insert-mode', {
            label: 'Enter Insert Mode',
            execute: args => {
                const current = getCurrent(args);
                if (current) {
                    const { content } = current;
                    if (content.activeCell !== null) {
                        const editor = content.activeCell.editor;
                        current.content.mode = 'edit';
                        const cm = (0,_replit_codemirror_vim__WEBPACK_IMPORTED_MODULE_0__.getCM)(editor.editor);
                        if (!cm) {
                            console.error('CodeMirror vim wrapper not found');
                            return;
                        }
                        _replit_codemirror_vim__WEBPACK_IMPORTED_MODULE_0__.Vim.handleKey(cm, 'i');
                    }
                }
            },
            isEnabled
        }),
        commands.addCommand('vim:leave-insert-mode', {
            label: 'Leave Insert Mode',
            execute: args => {
                const current = getCurrent(args);
                if (current) {
                    const { content } = current;
                    if (content.activeCell !== null) {
                        const editor = content.activeCell.editor;
                        const cm = (0,_replit_codemirror_vim__WEBPACK_IMPORTED_MODULE_0__.getCM)(editor.editor);
                        if (!cm) {
                            console.error('CodeMirror vim wrapper not found');
                            return;
                        }
                        _replit_codemirror_vim__WEBPACK_IMPORTED_MODULE_0__.Vim.handleKey(cm, '<Esc>');
                    }
                }
            },
            isEnabled
        }),
        commands.addCommand('vim:leave-current-mode', {
            label: 'Move Insert to Normal to Jupyter Command Mode',
            execute: args => {
                const current = getCurrent(args);
                if (current) {
                    const { content } = current;
                    if (content.activeCell !== null) {
                        const editor = content.activeCell.editor;
                        const cm = (0,_replit_codemirror_vim__WEBPACK_IMPORTED_MODULE_0__.getCM)(editor.editor);
                        if (!cm) {
                            console.error('CodeMirror vim wrapper not found');
                            return;
                        }
                        const vim = cm.state.vim;
                        if (!vim) {
                            console.error('CodeMirror vim state not found');
                            return;
                        }
                        // Get the current editor state
                        if (vim.insertMode ||
                            vim.visualMode ||
                            vim.inputState.operator !== null ||
                            vim.inputState.motion !== null ||
                            vim.inputState.keyBuffer.length !== 0) {
                            _replit_codemirror_vim__WEBPACK_IMPORTED_MODULE_0__.Vim.handleKey(cm, '<Esc>');
                        }
                        else {
                            commands.execute('notebook:enter-command-mode');
                        }
                    }
                }
            },
            isEnabled
        }),
        commands.addCommand('vim:select-below-execute-markdown', {
            label: 'Execute Markdown and Select Cell Below',
            execute: args => {
                const current = getCurrent(args);
                if (current) {
                    const { content } = current;
                    if (content.activeCell !== null &&
                        content.activeCell.model.type === 'markdown') {
                        current.content.activeCell.rendered = true;
                    }
                    return _jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_1__.NotebookActions.selectBelow(current.content);
                }
            },
            isEnabled
        }),
        commands.addCommand('vim:select-above-execute-markdown', {
            label: 'Execute Markdown and Select Cell Above',
            execute: args => {
                const current = getCurrent(args);
                if (current) {
                    const { content } = current;
                    if (content.activeCell !== null &&
                        content.activeCell.model.type === 'markdown' &&
                        content.activeCellIndex !== 0) {
                        current.content.activeCell.rendered = true;
                    }
                    return _jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_1__.NotebookActions.selectAbove(current.content);
                }
            },
            isEnabled
        }),
        commands.addCommand('vim:select-first-cell', {
            label: 'Select First Cell',
            execute: async (args) => {
                const current = getCurrent(args);
                if (current) {
                    const { content } = current;
                    content.activeCellIndex = 0;
                    content.deselectAll();
                    if (content.activeCell !== null) {
                        // note: using `scrollToItem` because `scrollToCell` changes mode (activate the cell)
                        await content.scrollToItem(content.activeCellIndex, 'smart');
                        content.activeCell.node.focus();
                    }
                }
            },
            isEnabled
        }),
        commands.addCommand('vim:select-last-cell', {
            label: 'Select Last Cell',
            execute: async (args) => {
                const current = getCurrent(args);
                if (current) {
                    const { content } = current;
                    content.activeCellIndex = current.content.widgets.length - 1;
                    content.deselectAll();
                    if (content.activeCell !== null) {
                        // note: using `scrollToItem` because `scrollToCell` changes mode (activates the cell)
                        await content.scrollToItem(content.activeCellIndex, 'smart');
                        content.activeCell.node.focus();
                    }
                }
            },
            isEnabled
        }),
        commands.addCommand('vim:center-cell', {
            label: 'Center Cell',
            execute: args => {
                const current = getCurrent(args);
                if (current && current.content.activeCell !== null) {
                    current.content.scrollToCell(current.content.activeCell, 'center');
                }
            },
            isEnabled
        }),
        commands.addCommand('vim:no-action', {
            label: 'Prevent Default Browser Action',
            caption: 'Prevent default action for some keybindings (defined in the settings); for example Firefox binds Shift + Esc to its Process Manager which conflicts with the expected action in the vim mode.',
            execute: args => {
                // no-op
            }
        })
    ];
    return addedCommands;
}


/***/ })

}]);
//# sourceMappingURL=lib_index_js.7c88208c1d6bb2cf511b.js.map