# Frontend – Kanban (React + Vite + TS + Tailwind)

Interface completa com **login**, **dashboard com cards**, **kanban** e **CRUDs** (Projetos, Responsáveis, Secretarias).
Design clean e profissional com Tailwind + ícones (lucide).

## Requisitos
- Node 18+ (ou 20+ recomendado)
- Backend rodando em: `http://localhost:8080` (ajuste se necessário)

## Configuração
Crie um `.env` na raiz (ou copie `.env.example`) com:
```
VITE_API_BASE=http://localhost:8080
```

## Rodar (IntelliJ 2025 ou terminal)
```bash

# Para DEV
npm run build:dev    # ← compila com as variáveis de .env.hml
npm run preview      # ← roda o build (já tem as variáveis corretas)


# Para HOMOLOGAÇÃO
npm run build:hml    # ← compila com as variáveis de .env.hml
npm run preview      # ← roda o build (já tem as variáveis corretas)

# Para PRODUÇÃO  
npm run build:prod   # ← compila com as variáveis de .env.prod
npm run preview      # ← roda o build (já tem as variáveis corretas)

Para ter certeza que funcionou:

Apague a pasta dist

# Desenvolvimento
npm run dev              # → localhost:8080
npm run dev:hml          # → 177.53.148.179:8080
npm run dev:prod         # → 177.53.148.179:8080

# Para HOMOLOGAÇÃO
npm run build:hml    # ← compila com as variáveis de .env.hml
npm run preview      # ← roda o build (já tem as variáveis corretas)

# Para PRODUÇÃO  
npm run build:prod   # ← compila com as variáveis de .env.prod
npm run preview      # ← roda o build (já tem as variáveis corretas)

# instalar deps
npm install
# ambiente dev
npm run dev
# build para produção
npm run build
# preview do build
npm run preview
```



## Rotas
- `/login` – Tela de entrada (usa `admin@codex.local / admin` do backend)
- `/` – Dashboard com métricas e cards
- `/kanban` – Board por colunas + transição de status
- `/projetos` – CRUD rápido (criar/excluir)
- `/responsaveis` – CRUD rápido
- `/secretarias` – CRUD rápido

## Estilo
- Tailwind CSS (sem libs pesadas)
- Layout organizado (sidebar + header fixo)
- Ícones `lucide-react`

## Dicas
- Se o backend estiver em outro host/porta, ajuste `VITE_API_BASE`.
- O token JWT fica em `localStorage` e é enviado automaticamente em cada requisição.
