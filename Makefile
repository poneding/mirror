# Mirror — developer entry points
#
# Targets are written for the environment this project is developed on:
#   * GNU Make 3.81 (no .ONESHELL, no `!=` shell assignment)
#   * the make shell is Git Bash `sh`, so POSIX syntax is required
#   * each recipe line runs in its own shell
#
# Run `make help` for the list of targets.

SHELL := /bin/sh

# ---------------------------------------------------------------------------
# Toolchain
# ---------------------------------------------------------------------------

NPM          ?= npm
CARGO        ?= cargo
CARGO_MANIFEST := src-tauri/Cargo.toml

# `tauri` CLI comes from devDependencies, so prefer the local binary.
TAURI        ?= $(NPM) run --silent tauri

# Release artifact location (Tauri uses the crate name, not productName).
RELEASE_BIN  := src-tauri/target/release/mirror

# ---------------------------------------------------------------------------
# Phony targets
# ---------------------------------------------------------------------------

.PHONY: help install check check-js check-rust lint lint-js lint-rust lint-fix \
        fmt fmt-check test test-js test-rust test-watch test-coverage coverage \
        run run-web build build-js build-app bundle audit clean clean-js clean-rust \
        clean-all reinstall

# ---------------------------------------------------------------------------
# Help
# ---------------------------------------------------------------------------

help: ## Show this help
	@echo "Mirror — available targets"
	@echo ""
	@echo "  Setup"
	@echo "    install          Install npm and Rust dependencies"
	@echo "    reinstall        Install from a clean slate"
	@echo ""
	@echo "  Quality gates"
	@echo "    check            Typecheck + lint everything (no writes)  <- CI gate"
	@echo "    check-js         TypeScript typecheck only"
	@echo "    check-rust       cargo check only"
	@echo "    lint             Lint frontend (ESLint) and Rust (clippy, -D warnings)"
	@echo "    lint-js          ESLint only"
	@echo "    lint-rust        clippy only"
	@echo "    lint-fix         ESLint --fix and cargo fmt"
	@echo "    fmt              Format Rust sources (cargo fmt)"
	@echo "    fmt-check        Verify Rust formatting without writing"
	@echo "    audit            Dependency advisories (cargo audit + npm audit)"
	@echo ""
	@echo "  Tests"
	@echo "    test             Run all tests (frontend + Rust)"
	@echo "    test-js          Vitest run"
	@echo "    test-rust        cargo test"
	@echo "    test-watch       Vitest in watch mode"
	@echo "    coverage         Coverage report for src/lib"
	@echo ""
	@echo "  Run"
	@echo "    run              Launch the desktop app (tauri dev)"
	@echo "    run-web          Frontend only in a browser (UI work)"
	@echo ""
	@echo "  Build"
	@echo "    build            Build frontend bundle (default)"
	@echo "    build-js         Frontend bundle only"
	@echo "    build-app        Full desktop binary + installers"
	@echo "    bundle           Alias for build-app"
	@echo ""
	@echo "  Maintenance"
	@echo "    clean            Remove build output (dist, frontend caches)"
	@echo "    clean-rust       Remove Rust target directory"
	@echo "    clean-all        Remove all build output"
	@echo ""

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------

install: ## Install dependencies
	$(NPM) install
	$(CARGO) fetch --manifest-path $(CARGO_MANIFEST)

reinstall: clean-js ## Reinstall from a clean slate
	rm -rf node_modules
	$(NPM) install

# ---------------------------------------------------------------------------
# Quality gates
# ---------------------------------------------------------------------------

check: check-js lint ## Typecheck + lint (no writes); CI gate

check-js: ## TypeScript typecheck
	$(NPM) run --silent typecheck

check-rust: ## cargo check
	$(CARGO) check --manifest-path $(CARGO_MANIFEST) --all-targets

lint: lint-js lint-rust ## Lint frontend and Rust

lint-js: ## ESLint
	$(NPM) run --silent lint

lint-rust: ## clippy, warnings are errors
	$(CARGO) clippy --manifest-path $(CARGO_MANIFEST) --all-targets -- -D warnings

lint-fix: ## Auto-fix lint issues
	$(NPM) run --silent lint:fix
	$(CARGO) fmt --manifest-path $(CARGO_MANIFEST)

fmt: ## Format Rust sources
	$(CARGO) fmt --manifest-path $(CARGO_MANIFEST)

fmt-check: ## Verify Rust formatting
	$(CARGO) fmt --manifest-path $(CARGO_MANIFEST) -- --check

audit: ## Dependency advisories
	$(CARGO) audit --file src-tauri/Cargo.lock
	$(NPM) audit

# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

test: test-js test-rust ## Run all tests

test-js: ## Vitest
	$(NPM) run --silent test

test-rust: ## cargo test
	$(CARGO) test --manifest-path $(CARGO_MANIFEST) --all-targets

test-watch: ## Vitest watch mode
	$(NPM) run --silent test:watch

coverage: ## Coverage for src/lib
	$(NPM) run --silent test:coverage

# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------

run: ## Launch the desktop app
	$(TAURI) dev

run-web: ## Frontend only, in a browser
	$(NPM) run --silent dev

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------

build: build-js ## Build the frontend bundle

build-js: ## Frontend bundle
	$(NPM) run --silent build

build-app: ## Full desktop build
	$(TAURI) build

bundle: build-app ## Alias for build-app

# ---------------------------------------------------------------------------
# Maintenance
# ---------------------------------------------------------------------------

clean: clean-js ## Remove frontend build output

clean-js: ## Remove dist and caches
	rm -rf dist
	rm -rf node_modules/.vite
	rm -rf node_modules/.cache
	rm -rf coverage

clean-rust: ## Remove the Rust target directory
	$(CARGO) clean --manifest-path $(CARGO_MANIFEST)

clean-all: clean clean-rust ## Remove all build output
