# GitHub Copilot Instructions

## Version Management

**IMPORTANT**: Every pull request MUST include a version bump.

When making changes to this repository:
1. Always update the `APP_VERSION` constant in `index.html`
2. Follow semantic versioning (MAJOR.MINOR.PATCH):
   - **MAJOR**: Incompatible API changes or major feature overhauls
   - **MINOR**: New features or significant enhancements (backward compatible)
   - **PATCH**: Bug fixes, minor tweaks, or documentation updates
3. The version number must be incremented in the same pull request as the code changes

### Current Version Location
```javascript
const APP_VERSION = 'X.Y.Z';
```

### Examples
- Bug fix: `1.3.0` → `1.3.1`
- New feature: `1.3.0` → `1.4.0`
- Breaking change: `1.3.0` → `2.0.0`

## General Guidelines

- Always open a PR for changes
- Keep changes focused and minimal
- Follow the existing code style and conventions
- Test changes thoroughly before submitting
- Write clear commit messages and PR descriptions
