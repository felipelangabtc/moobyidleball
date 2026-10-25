# Idle Ball · Temporada Infinita

Jogo idle de futebol para navegador. Você administra um clube fictício: monta a
escalação, joga partidas automáticas, abre baús, treina atletas, evolui
estrelas, equipa itens e avança em uma campanha de fases com identidade
própria.

## Como rodar

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # produção em dist/
npm run preview  # pré-visualizar a build
npm run test     # testes de domínio e simulação
npm run typecheck
```

A primeira execução funciona sem serviços externos: o save começa com
atletas, itens e recursos iniciais, tudo no `localStorage`.

## Stack e decisões

- **Vite 8 + React 19 + TypeScript** – build rápido, tipagem estrita e
  componentes reutilizáveis.
- **Zustand** – estado global simples, sem boilerplate; ações centralizadas.
- **Zod** – validação do save ao carregar (migração e recuperação).
- **Motion (Framer Motion)** – animações de gols, baús e recompensas, com
  respeito à preferência de movimento reduzido.
- **Lucide React** – ícones vetoriais originais, sem ativos de terceiros.
- **Web Audio API** – efeitos sonoros sintetizados, sem arquivos externos.
- **Vitest** – testes de domínio e do simulador de partidas.

Decisão: nada de backend, conta, pagamentos reais ou multiplayer. O jogo é
100% local, e isso é informado na tela de Ajustes. A camada de domínio
(`src/domain`) é pura e testável para que, com um backend, a mesma lógica de
sorteio, economia e simulação possa rodar no servidor.

## Arquitetura

```
src/
  domain/      Regras puras: atletas, economia, campanha, baús, idle, progresso, futebol
  data/        Conteúdo: atletas, itens, habilidades, biomas, nomes, missões e conquistas
  sim/         Simulador de partidas e física de ricochete
  state/       Store (Zustand), persistência versionada, fluxo de partida
  screens/     Telas (Início, Campanha, Preparação, Partida, Elenco, Baús, Clube, ...)
  ui/          Componentes, arte procedural, navegação, confirmação
  audio/       Efeitos sonoros (Web Audio)
```

Separação clara: interface → store → domínio. Nenhuma regra de economia,
probabilidade ou resultado fica no componente.

## Mecânicas principais

- **Campanha por fases**: 12 fases por bioma (6 biomas), com mini-chefes a
  cada 4 fases, chefes a cada 12 e arenas de placas a cada 6. Derrota volta
  uma fase, sem apagar progresso.
- **Partidas automáticas**: simulação minuto a minuto com posse, passes,
  desarmes, cruzamentos, chutes, defesas, faltas, pênaltis, cartões, lesões e
  moral/energia. Atributos e tática importam mais que sorte.
- **Física de ricochete**: arenas especiais com placas; o chute é simulado com
  passo fixo, restituição e atrito, e a trajetória é desenhada na tela.
- **Baús**: 3 tipos, 5 raridades, proteção (pity), conversão de duplicatas
  em fragmentos, abertura individual ou em lote (nível 3 do clube).
- **Progressão**: treino com foco, evolução de estrelas, equipamentos com
  fusão e reciclagem, 5 melhorias do clube.
- **Idle**: receita offline limitada por horas, nunca avança fases.
- **Missões diárias/semanais, conquistas, enciclopédia e torneio de
  sobrevivência.**

## Balanceamento (resumo das fórmulas)

- **OVR da posição** = média ponderada dos atributos efetivos pelos pesos da
  posição (ver `src/domain/football.ts`). O encaixe é 1.0 (principal),
  0.96 (secundária) ou 0.84–0.96 (fora da posição, conforme versatilidade).
- **Atributos efetivos** = base × (1 + 0.018 × (nível − 1)) × (1 + 0.05 ×
  (estrelas − 1)) + bônus de treino + bônus de equipamento, limitados a
  [1, 99].
- **Teto de nível** = 10 + 5 × (estrelas − 1) + 4 × nível do Centro de
  Treinamento (máx. 40).
- **XP para o próximo nível** = 40 × 1.09^(nível − 1).
- **Dificuldade da campanha** = 44 + 0.9 × fase + 0.01 × fase², com teto em
  95 (bônus de +8 para chefes, +4 para mini-chefes, +2 para arenas).
- **Recompensa por repetição** = 1 / (1 + 0.25 × vitórias anteriores),
  com piso em 20%.
- **Receita idle** = (45 + 14 × (nível do clube − 1)) × (1 + 0.18 × nível
  do estádio) moedas por hora, com teto de horas (4 + 0.6 × nível da
  academia juvenil, máx. 12).
- **Pity**: após 25 sorteios sem épico ou superior, o próximo é garantido
  épico ou superior; após 80 sem lendário, o próximo é lendário ou mítico.
- **Lesões**: ~0.007% por minuto por atleta, reduzidas pelo Departamento
  Médico. O atleta segue em campo com rendimento reduzido (0.7×).

Todas as constantes estão em `src/domain/balance.ts`.

## Limitações reais

- **Sem backend**: o sorteio roda no navegador. A página de Ajustes avisa
  sobre isso.
- **Sem conta, login ou salvamento em nuvem**: o progresso fica no
  `localStorage` do navegador atual. Use a exportação de save para copiar.
- **Sem PvP real**: o "Torneio de sobrevivência" é contra adversários
  simulados. Não há multiplayer.
- **Sem pagamentos reais**: tudo é obtido com recursos do jogo.
- **Sem áudio externo**: os sons são sintetizados.

## Segurança e privacidade

- Validação do save com Zod ao carregar; saves inválidos são copiados para
  uma chave de backup antes de criar um novo.
- Checksum (FNV-1a) para detectar corrupção acidental ou edição manual.
- Migrações versionadas (v1 → v2).
- Sem coleta de dados pessoais, sem requisições externas, sem chaves no
  código do navegador.
- CSP e cabeçalhos de segurança configurados no Vite (desenvolvimento e
  pré-visualização).

## Testes

`npm run test` cobre: determinismo do simulador, coerência de placar e
estatísticas, vantagem de atributos e tática, regras de campanha, baús e
pity, economia (treino, upgrades, fusão, equipamento), camada idle (limites,
relógio alterado) e missões.
