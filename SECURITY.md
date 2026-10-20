# Security

Security fixes target the latest release; users of older releases may need to upgrade. WorkLog is early-stage software maintained as time permits, with no guaranteed response deadline.

## Reporting a vulnerability

Do not post exploit details, private workspace contents, bearer tokens, keys, or credentials in public issues. Use [GitHub private vulnerability reporting](https://github.com/jpxor/worklog/security/advisories/new) if the repository offers it. Availability depends on repository settings; this file does not enable that feature. If it is unavailable, open an issue containing only a request for a private security reporting channel, with no sensitive technical details, and wait for a maintainer to arrange one.

Once a private channel is available, include the affected version and OS, minimal reproduction with synthetic data, the expected security boundary, and likely impact. Relevant areas include workspace path escape, unintended reads/deletion, document rendering, Git command execution, and unauthorized MCP access. Maintainers will coordinate fixes and disclosure with reporters when practical; please allow time for a fix before publishing reproduction details.

For ordinary bugs and support, use [Issues](https://github.com/jpxor/worklog/issues). See the [MCP guide](docs/mcp.md) for the sharing model and [publication checklist](docs/open-source-readiness.md) for maintainer setup still requiring verification.
