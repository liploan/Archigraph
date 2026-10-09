FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Run as an unprivileged user; the app writes extraction caches under /app/data
RUN useradd --create-home appuser && chown -R appuser /app
USER appuser

# One worker on purpose: the rate limiter and daily budget counters are in-memory,
# so multiple worker processes would each get their own (larger) allowance.
CMD ["sh", "-c", "gunicorn app:app --bind 0.0.0.0:${PORT:-8000} --workers 1 --threads 8 --timeout 120"]
