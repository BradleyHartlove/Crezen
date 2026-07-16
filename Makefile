.PHONY: up down build logs restart clean

up:
	@[ -f .env ] || (cp .env.example .env && echo "Created .env from .env.example — edit it before rerunning")
	docker compose up --build -d

down:
	docker compose down

build:
	docker compose build

logs:
	docker compose logs -f

restart:
	docker compose restart

clean:
	docker compose down -v --remove-orphans
