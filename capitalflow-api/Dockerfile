FROM python:3.12-slim-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates unixodbc \
    && curl -fsSLo /tmp/packages-microsoft-prod.deb https://packages.microsoft.com/config/debian/12/packages-microsoft-prod.deb \
    && dpkg -i /tmp/packages-microsoft-prod.deb \
    && apt-get update && ACCEPT_EULA=Y apt-get install -y --no-install-recommends msodbcsql18 \
    && rm -f /tmp/packages-microsoft-prod.deb && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1. Cài dependency runtime trước để tận dụng layer cache.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 2. Chỉ sao chép mã runtime. Migration thuộc project capitalflow-database và
# được chạy như một bước triển khai riêng trước khi khởi động API/worker.
COPY app/ ./app/

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
