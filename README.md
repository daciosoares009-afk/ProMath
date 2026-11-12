# ProbMath — O Desafio da Probabilidade

Jogo para a Feira Interdisciplinar de Matemática. Cada partida tem cinco perguntas. Cada acerto rende uma ficha para a máquina de Galton, e cada lançamento concede entre 0 e 100 pontos.

## Rodar localmente

Use Node.js 24.

```sh
npm install
npm run dev
npm test
npm run build
```

O Vite imprime o endereço local. Sem configuração do Firebase, o jogo e o ranking local usam SQLite em `.local/probmath.sqlite`, com atualização do ranking a cada três segundos. O painel do professor requer Firebase Authentication. A prévia animada da página inicial mostra trajetórias ilustrativas e não registra lançamentos.

## Configurar Firebase e Vercel

1. Crie um projeto Firebase e um banco Cloud Firestore. Registre um aplicativo web e habilite e-mail/senha no Firebase Authentication.
2. Copie `.env.example` para `.env.local`. Preencha os quatro valores públicos `VITE_FIREBASE_*` com a configuração do aplicativo web e os três valores `FIREBASE_*` com os dados da conta de serviço. Use `PROBMATH_BACKEND=firebase` para testar com o Vite. Mantenha `.env.local` e o JSON da conta de serviço fora do repositório.
3. Publique as regras e os índices com `npx firebase-tools deploy --project SEU_PROJETO --only firestore:rules,firestore:indexes`. Aguarde a criação do índice antes de testar o ranking.
4. Crie a conta do professor em **Authentication → Usuários**. Execute `npm run firebase:setup -- professor@escola.edu.br` para cadastrar as 50 questões, iniciar a configuração e conceder acesso à conta existente. Execute sem e-mail para preparar apenas o banco. Para revogar acesso, remova o documento `admins/{uid}`.
5. Importe o projeto na Vercel como Vite e use Node.js 24. Configure as variáveis públicas e administrativas no projeto Vercel e faça o deploy. Se o Firebase solicitar, adicione o domínio da Vercel à lista de domínios autorizados do Authentication. O endpoint `/api/probmath` usa Firebase Admin em produção.

O ranking e os indicadores públicos recebem atualizações via listeners do Firestore. O painel do professor é atualizado quando as estatísticas mudam. O regulamento usa, por padrão, três tentativas por apelido normalizado, com janela de 30 minutos para concluir cada tentativa. Como o visitante joga sem cadastro, o limite vale por apelido e admite que a mesma pessoa escolha outro nome.

### Testar as regras com os emuladores

Com o Firebase CLI e o Java exigido pelo Firestore Emulator instalados, execute no PowerShell:

```powershell
$env:FIREBASE_PROJECT_ID = 'demo-probmath'
npx firebase-tools emulators:exec --only firestore,auth --project demo-probmath "npm test"
```

O teste de regras usa somente um projeto com prefixo `demo-` e os dois emuladores. Para conectar também o app em desenvolvimento, configure `PROBMATH_BACKEND=firebase`, os valores públicos do projeto de demonstração e `VITE_FIREBASE_EMULATORS=true`. Defina `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` e `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099` no servidor e no comando de preparação do banco.

## Modelo e segurança

O sorteio no servidor usa quatro bits independentes de `node:crypto`. A soma dos bits escolhe o compartimento. Os 16 caminhos equiprováveis produzem as frequências teóricas 1/16, 4/16, 6/16, 4/16 e 1/16. Matter.js anima o caminho sorteado com gravidade e pinos. O modo científico usa a mesma função de sorteio, com aleatoriedade Web Crypto e sem persistir partidas.

Cada sessão usa um identificador aleatório e um segredo de 256 bits armazenado como hash no servidor. O navegador recebe somente a questão atual e vê o gabarito após confirmar. Transações protegem o saldo, o registro de lançamentos e o ranking. Repetir um lançamento com o mesmo identificador retorna seu recibo. Um identificador diferente para o mesmo lançamento é recusado.

O ranking mantém a melhor partida por apelido. Desempates usam acertos, horário da conclusão e identificador interno, nessa ordem. A tela pública mostra as 100 primeiras posições. O resultado do jogador consulta sua posição mesmo fora dessa lista.

## Estrutura

- `src/pages`, `src/components`, `src/hooks` e `src/services` organizam a interface e os acessos a dados.
- `src/visual` contém a simulação visual e o desenho da máquina.
- `shared/model.ts` contém tipos, a ordenação e o modelo binomial.
- `server` contém regras, banco inicial e adaptadores transacionais.
- `api/probmath.ts` é a função Vercel.
- `tests` verifica regras do jogo, persistência local, concorrência, probabilidades e autorização no servidor.

