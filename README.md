# Jump to SASS Definition

A Visual Studio Code extension that allows you to quickly navigate to SASS variable definitions by clicking on variables while holding Ctrl (Windows) or Cmd (Mac).

## Features

- Jump to SASS variable definitions with Ctrl+Click (Windows) or Cmd+Click (Mac)
- Support for both SCSS and SASS files
- Support for variables, mixins, and functions
- Show all references using Alt+Shift+F12 or context menu
- Works with partial files and imported SASS files

## Installation

1. Open VS Code
2. Press `Ctrl+P` (Windows) or `Cmd+P` (Mac) to open the Quick Open dialog
3. Type `ext install jump-to-sass-definition` and press Enter

## Usage

1. Open any SCSS or SASS file
2. Hold Ctrl (Windows) or Cmd (Mac) and click on any SASS variable (starting with $)
3. You'll be taken to the variable definition

## Configuration

This extension contributes the following settings:

* `jumpToSassVariable.showAllReferences`: (Deprecated) This setting is no longer used. Use Alt+Shift+F12 or the context menu to show all references.

You can modify these settings by:
1. Opening VS Code settings (`Ctrl+,` or `Cmd+,`)
2. Searching for "Jump to SASS Variable"
3. Adjusting the settings as needed

## Requirements

- Visual Studio Code version 1.74.0 or higher

## Known Issues

- Variable definitions inside mixins or functions might not be detected in some cases
- Performance might be affected in very large workspaces with many SASS files

## Release Notes

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