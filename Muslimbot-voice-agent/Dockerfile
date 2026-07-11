FROM python:3.11-slim
RUN useradd -m -s /bin/bash muslimbot
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends build-essential && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY agent.py .
COPY kb_bff/ ./kb_bff/
COPY routes/ ./routes/
COPY services/ ./services/
RUN mkdir -p /app/data && chown -R muslimbot:muslimbot /app
USER muslimbot
CMD ["python", "agent.py", "start"]
