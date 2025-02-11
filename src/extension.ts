import * as vscode from 'vscode';
import * as path from 'path';

// Cache for file contents to avoid re-reading files
const fileContentCache = new Map<string, { content: string; timestamp: number }>();
const CACHE_TTL = 5000; // 5 seconds TTL for cache

export function activate(context: vscode.ExtensionContext) {
    // Register the definition provider for SCSS files
    const provider = new SassVariableDefinitionProvider();
    
    // Register for both SCSS and SASS files
    let disposable = vscode.languages.registerDefinitionProvider(
        [
            { scheme: 'file', language: 'scss' },
            { scheme: 'file', language: 'sass' }
        ],
        provider
    );

    // Add hover provider
    let hoverProvider = vscode.languages.registerHoverProvider(
        [
            { scheme: 'file', language: 'scss' },
            { scheme: 'file', language: 'sass' }
        ],
        {
            provideHover(document, position, token) {
                const wordRange = document.getWordRangeAtPosition(position, /\$[\w-]+/);
                if (wordRange) {
                    const word = document.getText(wordRange);
                    if (word.startsWith('$')) {
                        return new vscode.Hover('⌘ Click to jump to definition');
                    }
                }
                return null;
            }
        }
    );

    // Clear cache when files change
    let fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.{scss,sass}');
    fileWatcher.onDidChange((uri) => fileContentCache.delete(uri.fsPath));
    fileWatcher.onDidDelete((uri) => fileContentCache.delete(uri.fsPath));

    context.subscriptions.push(disposable, hoverProvider, fileWatcher);
}

class SassVariableDefinitionProvider implements vscode.DefinitionProvider {
    // Helper function to get file content with caching
    private async getFileContent(file: vscode.Uri): Promise<string> {
        const now = Date.now();
        const cached = fileContentCache.get(file.fsPath);
        
        if (cached && (now - cached.timestamp) < CACHE_TTL) {
            return cached.content;
        }

        const content = await vscode.workspace.openTextDocument(file);
        const fileContent = content.getText();
        fileContentCache.set(file.fsPath, { content: fileContent, timestamp: now });
        return fileContent;
    }

    // Helper function to search for variable in a single file
    private async searchInFile(
        file: vscode.Uri,
        variableName: string,
        workspacePath: string
    ): Promise<{ location: vscode.Location; description: string } | null> {
        const fileContent = await this.getFileContent(file);
        const lines = fileContent.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line || line.startsWith('//')) {
                continue;
            }

            if (line.includes(variableName + ':')) {
                const location = new vscode.Location(
                    file,
                    new vscode.Position(i, lines[i].indexOf(variableName))
                );
                const relPath = path.relative(workspacePath, file.fsPath);
                return {
                    location,
                    description: `${relPath}:${i + 1}`
                };
            }
        }

        return null;
    }

    async provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Definition | vscode.LocationLink[]> {
        const wordRange = document.getWordRangeAtPosition(position, /\$[\w-]+/);
        if (!wordRange) {
            return [];
        }

        const variableName = document.getText(wordRange);
        if (!variableName.startsWith('$')) {
            return [];
        }

        console.log(`Searching for variable: ${variableName}`);

        const config = vscode.workspace.getConfiguration('jumpToSassVariable');
        const showAllReferences = config.get<boolean>('showAllReferences');
        console.log('Configuration:', {
            showAllReferences,
            rawConfig: config.inspect('showAllReferences')
        });

        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder) {
            console.log('No workspace folder found');
            return [];
        }

        try {
            const files = await vscode.workspace.findFiles(
                '**/*.{scss,sass}',
                '**/node_modules/**'
            );

            console.log(`Found ${files.length} SCSS/SASS files to search`);

            const declarations: { location: vscode.Location; description: string }[] = [];
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

            // Search in same tree first (parallel processing)
            const sameTreeResults = await Promise.all(
                filesInSameTree.map(file => 
                    this.searchInFile(file, variableName, workspacePath)
                )
            );

            // Add valid results
            for (const result of sameTreeResults) {
                if (result) {
                    declarations.push(result);
                    if (!showAllReferences) {
                        return [result.location];
                    }
                }
            }

            // If showing all references or nothing found, search other files
            if (showAllReferences || declarations.length === 0) {
                // Process other files in chunks to avoid memory issues
                const CHUNK_SIZE = 20;
                for (let i = 0; i < otherFiles.length; i += CHUNK_SIZE) {
                    const chunk = otherFiles.slice(i, i + CHUNK_SIZE);
                    const chunkResults = await Promise.all(
                        chunk.map(file => 
                            this.searchInFile(file, variableName, workspacePath)
                        )
                    );

                    for (const result of chunkResults) {
                        if (result) {
                            declarations.push(result);
                            if (!showAllReferences) {
                                return [result.location];
                            }
                        }
                    }
                }
            }

            if (declarations.length === 0) {
                console.log('No definitions found');
                vscode.window.showInformationMessage(`No definition found for ${variableName}`);
                return [];
            }

            // If showAllReferences is false, return the first found location
            if (!showAllReferences) {
                console.log('Returning first found location');
                return [declarations[0].location];
            }

            // Show quick pick for declarations only if showAllReferences is true
            const items = declarations.map(decl => ({
                label: variableName,
                description: decl.description,
                location: decl.location
            }));

            const selected = await vscode.window.showQuickPick(items, {
                title: 'Choose Declaration',
                placeHolder: 'Select a variable declaration'
            });

            if (selected) {
                return [selected.location];
            }

            return [];

        } catch (error) {
            console.error('Error:', error);
            vscode.window.showErrorMessage(`Error finding definition: ${error}`);
            return [];
        }
    }
}

export function deactivate() {
    // Clear the cache when deactivating
    fileContentCache.clear();
} 