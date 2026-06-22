# Imagem base estável validada para nossas bibliotecas de IA
FROM python:3.12-slim

# Instalação de dependências para compilação (necessário para o tiktoken/PyO3)
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instalação das dependências Python primeiro para aproveitar o cache do Docker
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia o restante do código do projeto
COPY . .

# Variáveis de ambiente críticas
# 1. Impede travamentos de fork no macOS/Docker
ENV OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES
# 2. Garante que o Python enxergue a pasta 'core'
ENV PYTHONPATH=/app

# Comando que dispara o Nexus-Bot (Projeto Final)
CMD ["python", "labs/modulo12_projeto_final.py"]