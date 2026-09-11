# Ficha de Treino

Registro de treino com mapa muscular por porção, escala semanal e progressão de carga.
React + Vite, instalável como PWA. Os dados ficam no próprio aparelho (localStorage) —
sem servidor, sem login, funciona sem internet.

## Rodar local

```bash
npm install
npm run dev
```

## Publicar na Vercel

1. `git init && git add . && git commit -m "primeira versão"`
2. Crie um repositório no GitHub (pode ser privado) e dê push.
3. Em vercel.com: **Add New → Project → Import** o repositório.
   O preset Vite é detectado sozinho; não precisa mudar nada.
4. Deploy. A partir daí, todo `git push` republica.

## Instalar no celular

Abra a URL da Vercel no Chrome (Android) ou Safari (iPhone) e use
**Adicionar à tela de início**. O app abre em tela cheia, sem barra de
endereço, e funciona offline.

## Onde os dados ficam

Tudo num único registro do localStorage, chave `ficha-treino:v3`:

```
{ days: [...], sessions: [...], schedule: {...}, equipment: [...] }
```

- `days` — os treinos e seus exercícios
- `sessions` — cada treino registrado, com séries (kg × reps)
- `schedule` — qual treino cai em cada dia da semana (0 = domingo)
- `equipment` — equipamento disponível, usado para filtrar a biblioteca

Importante: localStorage é **por navegador e por aparelho**. Celular e
computador têm dados separados. Use **Exercícios → Backup e restauração**
para levar de um para o outro, e para guardar cópia de segurança.

O componente detecta se está rodando dentro de um artefato do Claude
(`window.storage`) ou como site (`localStorage`), então o mesmo arquivo
funciona nos dois lugares.

## Estrutura

```
src/App.jsx   componente inteiro: dados, mapa muscular SVG, telas
src/main.jsx  ponto de entrada
public/       ícones do PWA
```

## Mapeamento muscular

`LIBRARY` traz cada exercício com `p` (porções principais) e `s` (auxiliares),
usando as chaves de `MUSCLE`. Exercícios criados na mão caem em `RULES`, que
casa por palavra-chave — termos específicos antes dos genéricos
("supino inclinado" antes de "supino").

Para acrescentar exercício novo à biblioteca, basta uma linha em `LIBRARY`.

## Próximos passos possíveis

- Cronômetro de descanso entre séries
- Marcar série como aquecimento (fora do cálculo de recorde e volume)
- Campo de RIR/RPE por série
- Contagem de séries semanais por porção muscular
- Sugestão de progressão quando bate o topo da faixa de repetições
- Wake lock para a tela não apagar durante o treino
- Supabase, se quiser o mesmo histórico em vários aparelhos
