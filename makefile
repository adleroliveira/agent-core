.PHONY: start stop build setup check-env create-env

# Colors for terminal output
GREEN=\033[0;32m
YELLOW=\033[0;33m
BLUE=\033[0;34m
NC=\033[0m # No Color

# Main start command that ensures everything is set up first
start: check-env
	@echo "$(GREEN)Starting the application...$(NC)"
	docker-compose up -d
	@echo "$(GREEN)Application is running at http://localhost:3000$(NC)"

# Stop the application
stop:
	@echo "$(YELLOW)Stopping the application...$(NC)"
	docker-compose down

# Build the application
build:
	@echo "$(GREEN)Building the application...$(NC)"
	docker-compose build

# Ensure .env file exists before starting
check-env:
	@if [ ! -f .env ]; then \
		$(MAKE) create-env; \
	else \
		echo "$(GREEN)Using existing .env file...$(NC)"; \
	fi

# Interactive prompt to create .env file from .env.example
create-env:
	@if [ ! -f .env.example ]; then \
		echo "$(YELLOW)ERROR: .env.example file not found!$(NC)"; \
		exit 1; \
	fi
	@echo "$(YELLOW)Setting up environment variables from .env.example...$(NC)"
	@cp .env.example .env
	@echo "$(GREEN)Created .env file from template.$(NC)"
	@echo "$(YELLOW)Setting up AWS credentials...$(NC)"
	@if [ -f ~/.aws/credentials ] || [ -f ~/.aws/config ]; then \
		echo "$(GREEN)Found existing AWS profiles!$(NC)"; \
		profiles=$$(grep '^\[' ~/.aws/credentials 2>/dev/null | sed 's/\[\(.*\)\]/\1/' | grep -v '^default$$' || echo ""); \
		default_profile=$$(grep '^\[default' ~/.aws/credentials 2>/dev/null | sed 's/\[\(.*\)\]/\1/' || echo ""); \
		if [ -n "$$default_profile" ]; then \
			profiles="default $$profiles"; \
		fi; \
		if [ -n "$$profiles" ]; then \
			echo "$(BLUE)Available profiles:$(NC)"; \
			for profile in $$profiles; do \
				echo "  - $$profile"; \
			done; \
			echo -n "$(YELLOW)Enter profile name to use (or 'manual' to enter credentials directly): $(NC)"; \
			read -r profile_choice; \
			if [ "$$profile_choice" = "manual" ]; then \
				$(MAKE) manual-credentials; \
			else \
				sed -i 's/AWS_PROFILE=.*/AWS_PROFILE='"$$profile_choice"'/' .env; \
				region=$$(aws configure get region --profile $$profile_choice 2>/dev/null || echo "us-east-1"); \
				sed -i 's/AWS_REGION=.*/AWS_REGION='"$$region"'/' .env; \
				echo "$(GREEN)Profile '$$profile_choice' configured in .env file.$(NC)"; \
			fi; \
		else \
			echo "$(YELLOW)No named profiles found. Using manual credential entry.$(NC)"; \
			$(MAKE) manual-credentials; \
		fi; \
	else \
		echo "$(YELLOW)No AWS config found. Please enter your AWS credentials manually:$(NC)"; \
		$(MAKE) manual-credentials; \
	fi

# Manual credential entry sub-task
manual-credentials:
	@echo -n "AWS Access Key ID: " && read -r aws_access_key && \
	echo -n "AWS Secret Access Key: " && read -r aws_secret_key && \
	echo -n "AWS Region (default: us-east-1): " && read -r aws_region && \
	aws_region=$${aws_region:-us-east-1} && \
	sed -i 's/AWS_ACCESS_KEY_ID=.*/AWS_ACCESS_KEY_ID='"$$aws_access_key"'/' .env && \
	sed -i 's/AWS_SECRET_ACCESS_KEY=.*/AWS_SECRET_ACCESS_KEY='"$$aws_secret_key"'/' .env && \
	sed -i 's/AWS_REGION=.*/AWS_REGION='"$$aws_region"'/' .env && \
	echo "$(GREEN)AWS credentials saved to .env file.$(NC)"

# Full setup (build + start)
setup: build start