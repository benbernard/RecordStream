# Changelog

## v5.0.0

Complete rewrite of RecordStream in TypeScript, targeting the Bun runtime.

### Highlights

- All 41 operations ported: 14 input, 18 transform, 9 output
- All 27 aggregators ported with full domain language support
- New snippet execution model with JavaScript, Python, and Perl SDK support
- Fluent programmatic API for pipeline construction
- VitePress documentation website with full command reference
- Man page generation for all commands
- Shell completion scripts for bash and zsh
- Plugin system via `RECS_PLUGIN_DIR` environment variable

### Breaking changes from Perl v4.x

- Snippets are now JavaScript by default (use `--lang perl` or `--lang python` for alternatives)
- Requires Bun runtime instead of Perl
- Configuration via environment variables instead of `~/.recs/` config files
- The `recs` command is a Bun script, not a Perl fatpack

### Migration from Perl

For historical version history (v1.0 through v4.0.25), see the Perl
`Changes` file in the repository root.
