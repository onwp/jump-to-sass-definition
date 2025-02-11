# Jump to SASS Definition

A Visual Studio Code extension that allows you to quickly navigate to SASS variable definitions by clicking on variables while holding Ctrl (Windows) or Cmd (Mac).

## Features

- Jump to SASS variable definitions with Ctrl+Click (Windows) or Cmd+Click (Mac)
- Support for both SCSS and SASS files
- Support for variables, mixins, and functions
- Show all references using Alt+Shift+F12 or context menu
- Smart directory-based prioritization:
  - When using Ctrl/Cmd+Click, jumps to definitions in the same directory tree first
  - When using VS Code's peek view (editor.definitionLinkOpensInPeek), shows all references with same-directory matches first
- Works with partial files and imported SASS files

## Installation

1. Open VS Code
2. Press `Ctrl+P` (Windows) or `Cmd+P` (Mac) to open the Quick Open dialog
3. Type `ext install jump-to-sass-definition` and press Enter

## Usage

1. Open any SCSS or SASS file
2. Hold Ctrl (Windows) or Cmd (Mac) and click on any SASS variable (starting with $), mixin, or function
3. You'll be taken to the definition
   - If VS Code's peek view is disabled, jumps directly to the definition (prioritizing same-directory matches)
   - If VS Code's peek view is enabled, shows all references in a peek view (same-directory matches listed first)
4. Alternatively, use Alt+Shift+F12 to see all references in a QuickPick menu

## Configuration

This extension contributes the following settings:

* `jumpToSassVariable.showAllReferences`: (Deprecated) This setting is no longer used. Use Alt+Shift+F12 or the context menu to show all references.

VS Code settings that affect this extension:
* `editor.definitionLinkOpensInPeek`: Controls whether Ctrl/Cmd+Click opens definitions in a peek view or jumps directly to the file.

You can modify these settings by:
1. Opening VS Code settings (`Ctrl+,` or `Cmd+,`)
2. Searching for "Jump to SASS Variable" or "Definition Link Opens In Peek"
3. Adjusting the settings as needed

## Requirements

- Visual Studio Code version 1.74.0 or higher

## Known Issues

- Variable definitions inside mixins or functions might not be detected in some cases
- Performance might be affected in very large workspaces with many SASS files

## Release Notes

### 0.1.4

- Improved search behavior:
  - Properly excludes node_modules and .git directories from search
  - Better performance by reducing unnecessary file scanning

### 0.1.3

- Improved peek view behavior:
  - When VS Code's peek view is enabled, shows all references with same-directory matches prioritized
  - When peek view is disabled, maintains smart directory-based jumping
  - Better integration with VS Code's native peek functionality
- Updated documentation to clarify peek view behavior

### 0.1.2

- Improved definition jumping behavior:
  - Cmd/Ctrl+Click now always jumps to the first definition found
  - Added new "Show All References" command (Alt+Shift+F12)
  - Added context menu option to show all references
  - Deprecated the showAllReferences setting
- Added support for jumping to mixin and function definitions
- Improved search performance with file caching

### 0.1.1

Update readme

### 0.1.0

Initial release of Jump to SASS Variable
- Basic variable definition jumping
- Same-directory or all-references options
- SCSS and SASS support 