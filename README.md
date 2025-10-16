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
