\# Mainsite: Reflexos da Alma



Arquitetura modular de Edge Computing focada em altíssima performance, renderização nativa de inteligência artificial e design minimalista (Dark/Light responsivo).



\## 🏗 Topologia da Arquitetura



O ecossistema é construído sob um paradigma \*Serverless\* distribuído, operando 100% na borda da rede (Edge) através da infraestrutura da Cloudflare.



A aplicação é dividida em três microsserviços independentes:



1\. \*\*`mainsite-worker` (Backend API)\*\*

&#x20;  - \*\*Motor:\*\* Cloudflare Workers (Node.js via Hono framework).

&#x20;  - \*\*Responsabilidade:\*\* Orquestração de rotas, injeção segura de chaves (Secrets), comunicação com a API do Google Gemini 2.5 Pro, e interface com os bancos de dados.

&#x20;  - \*\*Armazenamento:\*\* Integrado nativamente com Cloudflare D1 (SQL Serverless) e Cloudflare R2 (Object Storage para mídias).



2\. \*\*`mainsite-admin` (Frontend CMS Privado)\*\*

&#x20;  - \*\*Motor:\*\* React + Vite + Tiptap Editor.

&#x20;  - \*\*Responsabilidade:\*\* Painel de controle privado protegido por Bearer Token. Permite a criação/edição de textos via editor rico (Markdown-friendly), gestão de ordem/fixação de posts, upload de imagens direto para o R2, e controle em tempo real da aparência global (Multi-tema).

&#x20;  - \*\*Hospedagem:\*\* Cloudflare Pages.



3\. \*\*`mainsite-frontend` (Frontend UI Pública)\*\*

&#x20;  - \*\*Motor:\*\* React + Vite (Arquitetura CSS-in-JS).

&#x20;  - \*\*Responsabilidade:\*\* Interface de leitura ultra-otimizada. Renderiza a "Malha de Consciência" em CSS puro responsivo (Zero imagens externas). Provê ferramentas de IA na ponta do cliente: Resumo de parágrafo, Tradução Universal e Chatbot RAG com busca semântica em todo o acervo.

&#x20;  - \*\*Hospedagem:\*\* Cloudflare Pages com políticas agressivas de Cache-Control (`\_headers`).



\---



\## 🔐 Gestão de Segurança e Segredos (Secrets)



Para garantir que credenciais não vazem no controle de versão (Git), a aplicação utiliza o padrão `.dev.vars` para desenvolvimento local e o cofre criptografado da Cloudflare para produção.



\*\*Ambiente Local:\*\*

Crie um arquivo `.dev.vars` na raiz do `mainsite-worker` com o seguinte conteúdo:

```env

API_SECRET="__REPLACE_ME__"

GEMINI_API_KEY="__REPLACE_ME__"