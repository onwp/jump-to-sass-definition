import * as vscode from 'vscode';
import * as path from 'path';

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

    context.subscriptions.push(disposable, hoverProvider);
}

class SassVariableDefinitionProvider implements vscode.DefinitionProvider {
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

        // Get configuration and log it for debugging
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
            // Get all SCSS/SASS files
            const files = await vscode.workspace.findFiles(
                '**/*.{scss,sass}',
                '**/node_modules/**'
            );

            console.log(`Found ${files.length} SCSS/SASS files to search`);

            // Array to collect all declarations
            const declarations: { location: vscode.Location; description: string }[] = [];

            // Get the current file's directory and workspace path
            const currentFilePath = document.uri.fsPath;
            const workspacePath = workspaceFolder.uri.fsPath;
            let currentDir = path.dirname(currentFilePath);
            let foundLocation = null;

            // Get the immediate top-level directory (first directory after workspace root)
            const relativePath = path.relative(workspacePath, currentFilePath);
            const topLevelDir = relativePath.split(path.sep)[0];
            const currentTopLevelDir = path.join(workspacePath, topLevelDir);

            // Build parent directory levels from current location to workspace root
            const parentLevels: string[] = [];
            while (currentDir.startsWith(workspacePath)) {
                parentLevels.push(currentDir);
                const parentDir = path.dirname(currentDir);
                if (parentDir === currentDir) {
                    break;
                }
                currentDir = parentDir;
            }

            // First, try to find in the same directory tree
            const filesInSameTree = files.filter(file => {
                const fileRelativePath = path.relative(workspacePath, file.fsPath);
                const fileTopLevelDir = fileRelativePath.split(path.sep)[0];
                return fileTopLevelDir === topLevelDir;
            });
            
            // Search files in the same directory tree first
            for (const file of filesInSameTree) {
                console.log(`Checking file in same tree: ${file.fsPath}`);
                const content = await vscode.workspace.openTextDocument(file);
                const fileContent = content.getText();
                const lines = fileContent.split('\n');

                // Look for variable definition
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line || line.startsWith('//')) {
                        continue;
                    }

                    if (line.includes(variableName + ':')) {
                        console.log(`Found variable definition in same tree: ${file.fsPath}:${i + 1}`);
                        const location = new vscode.Location(
                            file,
                            new vscode.Position(i, lines[i].indexOf(variableName))
                        );
                        foundLocation = location;
                        
                        // Add to declarations with relative path
                        const relPath = path.relative(workspacePath, file.fsPath);
                        declarations.push({
                            location,
                            description: `${relPath}:${i + 1}`
                        });
                        break;
                    }
                }
            }

            // If not found in same tree, then search at each parent level
            if (!foundLocation) {
                for (const parentDir of parentLevels) {
                    console.log(`Searching at level: ${parentDir}`);

                    // Get all SCSS/SASS files at this directory level
                    const levelFiles = files.filter(file => {
                        const fileDir = path.dirname(file.fsPath);
                        const fileParentDir = path.dirname(fileDir);
                        return fileParentDir === parentDir || fileDir === parentDir;
                    });

                    // Sort to prioritize partial files
                    levelFiles.sort((a, b) => {
                        const aName = path.basename(a.fsPath);
                        const bName = path.basename(b.fsPath);
                        const aIsPartial = aName.startsWith('_');
                        const bIsPartial = bName.startsWith('_');
                        if (aIsPartial && !bIsPartial) return -1;
                        if (!aIsPartial && bIsPartial) return 1;
                        return 0;
                    });

                    // Search each file at this level
                    for (const file of levelFiles) {
                        console.log(`Checking file: ${file.fsPath}`);
                        const content = await vscode.workspace.openTextDocument(file);
                        const fileContent = content.getText();
                        const lines = fileContent.split('\n');

                        // Look for variable definition
                        for (let i = 0; i < lines.length; i++) {
                            const line = lines[i].trim();
                            if (!line || line.startsWith('//')) {
                                continue;
                            }

                            if (line.includes(variableName + ':')) {
                                console.log(`Found variable definition in ${file.fsPath}:${i + 1}`);
                                const location = new vscode.Location(
                                    file,
                                    new vscode.Position(i, lines[i].indexOf(variableName))
                                );
                                foundLocation = location;
                                
                                // Add to declarations with relative path
                                const relPath = path.relative(workspacePath, file.fsPath);
                                declarations.push({
                                    location,
                                    description: `${relPath}:${i + 1}`
                                });
                                break;
                            }
                        }

                        if (foundLocation && !showAllReferences) {
                            break;
                        }
                    }

                    if (foundLocation && !showAllReferences) {
                        break;
                    }
                }
            }

            // Search all files if showing all references
            if (showAllReferences) {
                for (const file of files) {
                    // Skip files we've already found
                    if (declarations.some(d => d.location.uri.fsPath === file.fsPath)) {
                        continue;
                    }

                    const content = await vscode.workspace.openTextDocument(file);
                    const fileContent = content.getText();
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
                            
                            // Add to declarations with relative path
                            const relPath = path.relative(workspacePath, file.fsPath);
                            declarations.push({
                                location,
                                description: `${relPath}:${i + 1}`
                            });
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

export function deactivate() {} 