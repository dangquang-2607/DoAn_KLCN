FROM python:3.12-slim-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates unixodbc \
    && curl -fsSLo /tmp/packages-microsoft-prod.deb https://packages.microsoft.com/config/debian/12/packages-microsoft-prod.deb \
    && dpkg -i /tmp/packages-microsoft-prod.deb \
    && apt-get update && ACCEPT_EULA=Y apt-get install -y --no-install-recommends msodbcsql18 \
    && rm -f /tmp/packages-microsoft-prod.deb && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1. Install dependencies first (layer cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 2. Copy only runtime artifacts
# scripts/ docs/ tests/ dummy SQL do NOT belong in production image
COPY app/ ./app/
COPY alembic/ ./alembic/
COPY alembic.ini .
COPY migrations/ ./migrations/

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
