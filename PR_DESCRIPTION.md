## Correções e melhorias aplicadas

Esta branch (fix/normalize-imports-and-env) contém correções iniciais para melhorar execução em ambientes ESM e configurar variáveis sensíveis via .env:

- Normalizei imports em server.ts e usei `import type` para tipagens.
- Introduzi __dirname/__filename para ESM usando fileURLToPath(import.meta.url).
- Tornei FIREBASE_RTDB_URL configurável via variável de ambiente (com fallback para o valor hard-coded).
- Adicionei verificação de global fetch e mensagem clara quando ausente (Node 18+ recomendado).
- Tornei spawn do Python (spy.py) robusto: tenta python3 -> python, usa caminho resolvido e faz fallback para polling Node.
- Atualizei package.json (mover dependências de dev, atualizar esbuild, engines.node >=18) e .env.example.

### Testes recomendados
- npm install
- npx tsc --noEmit
- npm run dev
- curl http://localhost:3000/api/proxy/bacbo

### Próximos passos propostos
- Corrigir erros de TypeScript reportados por `tsc --noEmit` (frontend e libs).
- Adicionar README com instruções de deploy.
- Opcional: adicionar pipeline CI para checar TypeScript e build.
