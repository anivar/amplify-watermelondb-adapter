# Contributing to amplify-watermelondb-adapter

Thank you for your interest in contributing to amplify-watermelondb-adapter! This document provides guidelines for contributing to the project.

## Code of Conduct

Please note that this project is released with a [Contributor Code of Conduct](CODE_OF_CONDUCT.md). By participating in this project you agree to abide by its terms.

## How to Contribute

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When creating a bug report, include:

- A clear and descriptive title
- Steps to reproduce the behavior
- Expected behavior
- Actual behavior
- Code samples if applicable
- Environment details (Node.js version, React Native version, platform)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When suggesting an enhancement:

- Use a clear and descriptive title
- Provide a detailed description of the proposed enhancement
- Explain why this enhancement would be useful
- Include code examples if applicable

### Pull Requests

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`npm test`)
5. Ensure linting passes (`npm run lint`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

## Development Setup

### Prerequisites

- Node.js 20.0.0 or higher
- Yarn or npm
- Git

### Installation

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/amplify-watermelondb-adapter.git
cd amplify-watermelondb-adapter

# Install dependencies
npm install

# Build the project
npm run build
```

### Development Workflow

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run linting
npm run lint

# Build the project
npm run build

# Build in watch mode
npm run build:watch
```

### Testing

All submissions must include tests. The project uses Jest for testing.

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- WatermelonDBAdapter.test.ts
```

### Code Style

- Use TypeScript for all new code
- Follow existing code patterns and conventions
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Keep functions focused and small
- Write tests for new features

### Commit Messages

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests after the first line

Example:
```
Fix query caching for complex predicates

- Add proper cache key generation for nested predicates
- Improve cache invalidation logic
- Add tests for edge cases

Fixes #123
```

## Project Structure

```
amplify-watermelondb-adapter/
├── src/                    # Source code
│   ├── WatermelonDBAdapter.ts  # Main adapter implementation
│   └── index.ts            # Package exports
├── tests/                  # Test files
├── dist/                   # Built files (generated)
├── docs/                   # Documentation
└── examples/              # Example usage
```

## Pull Request Process

1. Ensure all tests pass
2. Update documentation if needed
3. Update README.md with details of changes if applicable
4. Increase version numbers following [SemVer](https://semver.org/)
5. The PR will be merged once approved by maintainers

## Release Process

Releases are managed by maintainers. The process includes:

1. Update version in package.json
2. Update CHANGELOG.md
3. Create git tag
4. Publish to npm
5. Create GitHub release

## Questions?

Feel free to open an issue for any questions about contributing.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.