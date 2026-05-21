.DEFAULT_GOAL := help

.PHONY: help
help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36mmake %-15s\033[0m %s\n", $$1, $$2}'

# ============================================
# Setup
# ============================================

.PHONY: install
install: ## Install dependencies
	npm install

.PHONY: setup
setup: install db-up db-push ## Full setup (install + db + schema)
	@echo "Setup complete. Run 'make dev' to start."

# ============================================
# Development
# ============================================

.PHONY: dev
dev: ## Start server (port 3014)
	npm start

# ============================================
# Database
# ============================================

.PHONY: db-up
db-up: ## Start PostgreSQL (dev on 5432, test on 5433)
	docker compose up -d

.PHONY: db-down
db-down: ## Stop PostgreSQL
	docker compose down

.PHONY: db-logs
db-logs: ## View database logs
	docker compose logs -f

.PHONY: db-push
db-push: ## Push Prisma schema to database
	npx prisma db push

.PHONY: db-reset
db-reset: ## Reset database (WARNING: deletes all data)
	@echo "This will delete ALL data. Press Ctrl+C to cancel..."
	@sleep 3
	npx prisma db push --force-reset

.PHONY: generate
generate: ## Regenerate Prisma client
	npx prisma generate

.PHONY: studio
studio: ## Open Prisma Studio (browser DB viewer)
	npx prisma studio

# ============================================
# Testing
# ============================================

REPORTER ?= default

.PHONY: test
test: ## Run tests (r=verbose|dot cov=1 debug=1)
	NODE_ENV=test npx vitest run --reporter=$(if $(r),$(r),$(REPORTER)) $(if $(cov),--coverage,)
	@if [ -n "$(cov)" ]; then \
		node -e "var c=require('./coverage/coverage-summary.json').total; var fmt=function(k){var s=k.charAt(0).toUpperCase()+k.slice(1); return s.padEnd(13)+': '+String(c[k].pct).padStart(5)+'% ( '+c[k].covered+'/'+c[k].total+' )'}; console.log('=============================== Coverage summary ===============================\n'+fmt('statements')+'\n'+fmt('branches')+'\n'+fmt('functions')+'\n'+fmt('lines')+'\n================================================================================')" > docs/test_coverage.txt; \
		if [ -z "$(debug)" ]; then rm -rf coverage/; fi; \
		echo "Coverage saved to docs/test_coverage.txt"; \
	fi

# ============================================
# Utilities
# ============================================

.PHONY: psql
psql: ## Connect to dev DB via psql
	docker exec -it coupon_service_db psql -U postgres -d coupon_service_development

.PHONY: psql-test
psql-test: ## Connect to test DB via psql
	docker exec -it coupon_service_db_test psql -U postgres -d coupon_service_test

.PHONY: down
down: db-down ## Alias for db-down

.PHONY: restart
restart: down db-up ## Restart database
