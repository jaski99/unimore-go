# UnimoreGo developer commands. Python deps go into .venv, web deps into web/node_modules.
PYTHON ?= $(if $(wildcard .venv/bin/python),.venv/bin/python,python3)

.PHONY: help install install-api install-web dev api web test test-api test-web lint lint-api lint-web build fixtures smoke docker-up docker-down

help: ## Show available targets
	@grep -E '^[a-z-]+:.*##' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-12s %s\n", $$1, $$2}'

install: install-api install-web ## Install API and web dependencies

install-api: ## Create .venv and install the API with dev extras
	test -d .venv || python3 -m venv .venv
	.venv/bin/pip install -e ".[dev]"

install-web: ## Install web dependencies (npm ci)
	cd web && npm ci

dev: ## Run API (:8000) and web (:3000) together
	PYTHON=$(PYTHON) ./scripts/dev.sh

api: ## Run only the API with autoreload on :8000
	$(PYTHON) -m uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload

web: ## Run only the web dev server on :3000
	cd web && npx next dev --hostname 0.0.0.0 --port 3000

test: test-api test-web ## Run all tests

test-api: ## pytest with coverage gate
	$(PYTHON) -m pytest --cov=engine --cov=api --cov-fail-under=90

test-web: ## vitest
	cd web && npx vitest run

lint: lint-api lint-web ## Run all linters

lint-api: ## ruff lint + format check, dataset validation
	$(PYTHON) -m ruff check .
	$(PYTHON) -m ruff format --check .
	$(PYTHON) tools/validate_data.py

lint-web: ## eslint + TypeScript
	cd web && npm run lint && npx tsc --noEmit

build: ## Production build of the web app
	cd web && npm run build

fixtures: ## Regenerate web mock fixtures from the real API
	$(PYTHON) tools/export_mock_fixtures.py

smoke: ## End-to-end check against a running API
	PYTHON=$(PYTHON) ./scripts/smoke.sh

docker-up: ## Build and start api + web with docker compose
	docker compose up --build

docker-down: ## Stop docker compose services
	docker compose down
