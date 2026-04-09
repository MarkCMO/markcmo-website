FROM python:3.12-slim

WORKDIR /srv

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ app/
COPY send_dashboard_batch.py .

# Create dashboard directory (Railway persistent volume at /data)
RUN mkdir -p /data/dashboards

CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
