# Jump to SASS Variable

A Visual Studio Code extension that allows you to quickly navigate to SASS variable definitions by clicking on variables while holding Ctrl (Windows) or Cmd (Mac).

## Features

- Jump to SASS variable definitions with Ctrl+Click (Windows) or Cmd+Click (Mac)
- Support for both SCSS and SASS files
- Configurable behavior to show all references or just same-directory definitions
- Works with partial files and imported SASS files

## Installation

1. Open VS Code
2. Press `Ctrl+P` (Windows) or `Cmd+P` (Mac) to open the Quick Open dialog
3. Type `ext install jump-to-sass-variable` and press Enter

## Usage

1. Open any SCSS or SASS file
2. Hold Ctrl (Windows) or Cmd (Mac) and click on any SASS variable (starting with $)
3. You'll be taken to the variable definition

## Configuration

This extension contributes the following settings:

* `jumpToSassVariable.showAllReferences`: When set as true, shows all variable definitions across the workspace. When set as false (default), jumps directly to the definition in the same directory level.

You can modify these settings by:
1. Opening VS Code settings (`Ctrl+,` or `Cmd+,`)
2. Searching for "Jump to SASS Variable"
3. Adjusting the settings as needed

## Requirements

- Visual Studio Code version 1.60.0 or higher

## Known Issues

- Variable definitions inside mixins or functions might not be detected in some cases
- Performance might be affected in very large workspaces with many SASS files

## Release Notes

### 0.1.0

Initial release of Jump to SASS Variable
- Basic variable definition jumping
- Same-directory or all-references options
- SCSS and SASS support 