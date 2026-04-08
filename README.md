# mainsite-app

> Website público principal (frontend e worker). Hospeda o blog Reflexos da Alma, conectando o PostReader ao banco D1 com atualização Real-Time via polling/cache nativos.

## Sub-módulos Operacionais

Este app pode abrigar módulos internos como:
- `mainsite-frontend`: Toda a User Interface (UI), PostReader, ContentSync.
- `mainsite-worker`: Backend responsivo que integra D1, Gateway AI do Google e moderação.

## Ecossistema LCV Workspace

Este repositório faz parte do workspace global LCV / Reflexos da Alma e opera de modo integrado aos demais serviços.

## Arquitetura & Governança

- **Cloudflare**: Implementado utilizando Workers/Pages, KV, D1, e integrações nativas como AI Gateway.
- **Padrões de Qualidade**: Obedece estritamente às diretivas de `AGENTS.md` e regras de paridade contidas no `.ai/GEMINI.md` e `.github/copilot-instructions.md`.
- **Yolo Mode & AI Automation**: O desenvolvimento deve priorizar o uso dos MCPs `ultrathink` e `code-reasoning` para planejamento.

---
*Documentação gerada e sincronizada para o Workspace LCV.*