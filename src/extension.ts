import * as vscode from 'vscode';
import * as path from 'path';

// Cache for file contents with a soft TTL of 10 minutes for rarely used entries
const fileContentCache = new Map<string, { content: string; timestamp: number }>();
const SOFT_TTL = 10 * 60 * 1000; // 10 minutes in milliseconds

// Regular expressions for matching
const VARIABLE_REGEX = /\$[\w-]+/;
const MIXIN_REGEX = /@include\s+([\w-]+)(?:\(.*\))?/;
const MIXIN_DEF_REGEX = /@mixin\s+([\w-]+)(?:\(.*\))?/;
const FUNCTION_REGEX = /([\w-]+)\s*\(/;
const FUNCTION_DEF_REGEX = /@function\s+([\w-]+)(?:\(.*\))?/;

// Helper function to get file content with caching
async function getFileContent(file: vscode.Uri): Promise<string> {
    const cached = fileContentCache.get(file.fsPath);
    const now = Date.now();
    
    // Return cached content if available and not expired (soft TTL)
    if (cached) {
        // Only check soft TTL if the entry is older than 10 minutes
        if (now - cached.timestamp < SOFT_TTL) {
            return cached.content;
        }
        // If soft TTL expired, remove from cache
        fileContentCache.delete(file.fsPath);
    }

    // Read file content and update cache
    const content = await vscode.workspace.openTextDocument(file);
    const fileContent = content.getText();
    fileContentCache.set(file.fsPath, { content: fileContent, timestamp: now });
    return fileContent;
}

// Helper function to search for definition in a single file
async function searchInFile(
    file: vscode.Uri,
    searchTerm: string,
    type: 'variable' | 'mixin' | 'function',
    workspacePath: string
): Promise<{ location: vscode.LocationLink; description: string } | null> {
    const fileContent = await getFileContent(file);
    const lines = fileContent.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith('//')) {
            continue;
        }

        switch (type) {
            case 'mixin': {
                const mixinMatch = line.match(MIXIN_DEF_REGEX);
                if (mixinMatch && mixinMatch[1] === searchTerm) {
                    const targetRange = new vscode.Range(
                        new vscode.Position(i, lines[i].indexOf('@mixin')),
                        new vscode.Position(i, lines[i].indexOf('@mixin') + searchTerm.length + 7)
                    );
                    const location = {
                        targetUri: file,
                        targetRange,
                        targetSelectionRange: targetRange,
                        originSelectionRange: undefined
                    };
                    const relPath = path.relative(workspacePath, file.fsPath);
                    return {
                        location,
                        description: `${relPath}:${i + 1}`
                    };
                }
                break;
            }
            case 'function': {
                const functionMatch = line.match(FUNCTION_DEF_REGEX);
                if (functionMatch && functionMatch[1] === searchTerm) {
                    const targetRange = new vscode.Range(
                        new vscode.Position(i, lines[i].indexOf('@function')),
                        new vscode.Position(i, lines[i].indexOf('@function') + searchTerm.length + 10)
                    );
                    const location = {
                        targetUri: file,
                        targetRange,
                        targetSelectionRange: targetRange,
                        originSelectionRange: undefined
                    };
                    const relPath = path.relative(workspacePath, file.fsPath);
                    return {
                        location,
                        description: `${relPath}:${i + 1}`
                    };
                }
                break;
            }
            case 'variable': {
                if (line.includes(searchTerm + ':')) {
                    const targetRange = new vscode.Range(
                        new vscode.Position(i, lines[i].indexOf(searchTerm)),
                        new vscode.Position(i, lines[i].indexOf(searchTerm) + searchTerm.length)
                    );
                    const location = {
                        targetUri: file,
                        targetRange,
                        targetSelectionRange: targetRange,
                        originSelectionRange: undefined
                    };
                    const relPath = path.relative(workspacePath, file.fsPath);
                    return {
                        location,
                        description: `${relPath}:${i + 1}`
                    };
                }
                break;
            }
        }
    }

    return null;
}

export function activate(context: vscode.ExtensionContext) {
    const disposables: vscode.Disposable[] = [];

    // Register for both SCSS and SASS files
    disposables.push(
        vscode.languages.registerDefinitionProvider(
            [{ scheme: 'file', language: 'scss' }, { scheme: 'file', language: 'sass' }],
            {
                async provideDefinition(document, position, token): Promise<vscode.LocationLink[] | null> {
                    // Check for variable
                    const variableRange = document.getWordRangeAtPosition(position, VARIABLE_REGEX);
                    let searchTerm = '';
                    let type: 'variable' | 'mixin' | 'function' = 'variable';

                    if (variableRange) {
                        searchTerm = document.getText(variableRange);
                        if (!searchTerm.startsWith('$')) {
                            return null;
                        }
                    } else {
                        // Check for mixin
                        const line = document.lineAt(position.line).text;
                        const mixinMatch = line.match(MIXIN_REGEX);
                        if (mixinMatch) {
                            const wordRange = document.getWordRangeAtPosition(position, /[\w-]+/);
                            if (!wordRange) {
                                return null;
                            }
                            const word = document.getText(wordRange);
                            if (mixinMatch[1] === word) {
                                searchTerm = word;
                                type = 'mixin';
                            }
                        } else {
                            // Check for function
                            const functionRange = document.getWordRangeAtPosition(position, /[\w-]+/);
                            if (functionRange) {
                                const word = document.getText(functionRange);
                                const afterWord = document.getText(new vscode.Range(
                                    functionRange.end,
                                    new vscode.Position(functionRange.end.line, functionRange.end.character + 1)
                                ));
                                if (afterWord.startsWith('(')) {
                                    searchTerm = word;
                                    type = 'function';
                                }
                            }
                        }
                    }

                    if (!searchTerm) {
                        return null;
                    }

                    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
                    if (!workspaceFolder) {
                        return null;
                    }

                    try {
                        const files = await vscode.workspace.findFiles(
                            '**/*.{scss,sass}',
                            '**/node_modules/**,**/.git/**'
                        );

                        const currentFilePath = document.uri.fsPath;
                        const workspacePath = workspaceFolder.uri.fsPath;

                        // Get the immediate top-level directory
                        const relativePath = path.relative(workspacePath, currentFilePath);
                        const topLevelDir = relativePath.split(path.sep)[0];

                        // Organize files by priority
                        const filesInSameTree = files.filter(file => {
                            const fileRelativePath = path.relative(workspacePath, file.fsPath);
                            const fileTopLevelDir = fileRelativePath.split(path.sep)[0];
                            return fileTopLevelDir === topLevelDir;
                        });
                        
                        const otherFiles = files.filter(file => !filesInSameTree.includes(file));

                        // Check if peek is enabled
                        const editorConfig = vscode.workspace.getConfiguration('editor');
                        const isPeekEnabled = editorConfig.get<boolean>('definitionLinkOpensInPeek', false);

                        // Search in same tree first
                        const sameTreeResults = await Promise.all(
                            filesInSameTree.map(file => 
                                searchInFile(file, searchTerm, type, workspacePath)
                            )
                        );

                        // Filter out null results
                        const validSameTreeResults = sameTreeResults.filter((result): result is { location: vscode.LocationLink; description: string } => result !== null);

                        // If peek is not enabled or we found results in the same tree, return those first
                        if (!isPeekEnabled && validSameTreeResults.length > 0) {
                            return [validSameTreeResults[0].location];
                        }

                        // If peek is enabled or no results found in same tree, search other files
                        const otherResults = await Promise.all(
                            otherFiles.map(file => 
                                searchInFile(file, searchTerm, type, workspacePath)
                            )
                        );

                        // Combine results, prioritizing same tree results
                        const allResults = [...validSameTreeResults, ...otherResults.filter((result): result is { location: vscode.LocationLink; description: string } => result !== null)];

                        if (allResults.length === 0) {
                            vscode.window.showInformationMessage(`No definition found for ${type}: ${searchTerm}`);
                            return null;
                        }

                        // Return all results for peek view, or just the first same-tree result (or first result if no same-tree results)
                        return isPeekEnabled ? allResults.map(result => result.location) : [allResults[0].location];

                    } catch (error) {
                        console.error('Error:', error);
                        vscode.window.showErrorMessage(`Error finding definition: ${error}`);
                        return null;
                    }
                }
            }
        )
    );

    // Register command to show all references
    disposables.push(
        vscode.commands.registerTextEditorCommand('sass.showAllReferences', async (editor) => {
            const position = editor.selection.active;
            const document = editor.document;
            
            // Check for variable/mixin/function at position
            const variableRange = document.getWordRangeAtPosition(position, VARIABLE_REGEX);
            let searchTerm = '';
            let type: 'variable' | 'mixin' | 'function' = 'variable';

            if (variableRange) {
                searchTerm = document.getText(variableRange);
                if (!searchTerm.startsWith('$')) {
                    return;
                }
            } else {
                // Check for mixin
                const line = document.lineAt(position.line).text;
                const mixinMatch = line.match(MIXIN_REGEX);
                if (mixinMatch) {
                    const wordRange = document.getWordRangeAtPosition(position, /[\w-]+/);
                    if (!wordRange) {
                        return;
                    }
                    const word = document.getText(wordRange);
                    if (mixinMatch[1] === word) {
                        searchTerm = word;
                        type = 'mixin';
                    }
                } else {
                    // Check for function
                    const functionRange = document.getWordRangeAtPosition(position, /[\w-]+/);
                    if (functionRange) {
                        const word = document.getText(functionRange);
                        const afterWord = document.getText(new vscode.Range(
                            functionRange.end,
                            new vscode.Position(functionRange.end.line, functionRange.end.character + 1)
                        ));
                        if (afterWord.startsWith('(')) {
                            searchTerm = word;
                            type = 'function';
                        }
                    }
                }
            }

            if (!searchTerm) {
                vscode.window.showInformationMessage('No SASS variable, mixin, or function found at cursor position');
                return;
            }

            const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
            if (!workspaceFolder) {
                return;
            }

            try {
                const files = await vscode.workspace.findFiles(
                    '**/*.{scss,sass}',
                    '**/node_modules/**,**/.git/**'
                );

                const declarations: { location: vscode.LocationLink; description: string }[] = [];
                const workspacePath = workspaceFolder.uri.fsPath;

                // Search all files in parallel
                const results = await Promise.all(
                    files.map(file => searchInFile(file, searchTerm, type, workspacePath))
                );

                // Collect all valid results
                for (const result of results) {
                    if (result) {
                        declarations.push(result);
                    }
                }

                if (declarations.length === 0) {
                    vscode.window.showInformationMessage(`No references found for ${type}: ${searchTerm}`);
                    return;
                }

                // Show quick pick for all declarations
                const items = declarations.map(decl => ({
                    label: searchTerm,
                    description: decl.description,
                    location: decl.location
                }));

                const selected = await vscode.window.showQuickPick(items, {
                    title: `Choose ${type} Reference`,
                    placeHolder: 'Select a reference'
                });

                if (selected) {
                    const doc = await vscode.workspace.openTextDocument(selected.location.targetUri);
                    const editor = await vscode.window.showTextDocument(doc);
                    const range = selected.location.targetSelectionRange || selected.location.targetRange;
                    editor.revealRange(selected.location.targetRange, vscode.TextEditorRevealType.InCenter);
                    editor.selection = new vscode.Selection(range.start, range.start);
                }
            } catch (error) {
                console.error('Error:', error);
                vscode.window.showErrorMessage(`Error finding references: ${error}`);
            }
        })
    );

    // Clear cache when files change
    const fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.{scss,sass}');
    fileWatcher.onDidChange((uri) => fileContentCache.delete(uri.fsPath));
    fileWatcher.onDidDelete((uri) => fileContentCache.delete(uri.fsPath));

    disposables.push(fileWatcher);
    context.subscriptions.push(...disposables);
}

export function deactivate() {
    // Clear the cache when deactivating
    fileContentCache.clear();
} 