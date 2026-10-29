PIXZIN VEGAS — PROTÓTIPO NETLIFY BLOBS (TESTE)
============================================

O que este protótipo adiciona
- Função serverless em netlify/functions/accounts.mjs usando Netlify Blobs.
- Limite de 10 contas e nomes de usuário únicos.
- Senhas derivadas com scrypt e sessões com tokens aleatórios.
- Tela de espera com contagem regressiva curta, mensagens de status e timeout para não deixar o carregamento preso.
- Tentativa de serialização das operações de conta com lease temporário e novas tentativas.
- Preserva o HTML e os jogos originais.

IMPORTANTE — PROTÓTIPO, NÃO SUBSTITUA A VERSÃO PUBLICADA AINDA
O bloqueio em Netlify Blobs é de melhor esforço: Blobs não fornece lock transacional/compare-and-swap, então a contagem regressiva NÃO garante matematicamente que duas requisições simultâneas nunca passem juntas. O limite de 10 contas e a espera reduzem o risco, mas não equivalem a um banco transacional.

A integração atual de presença, salas ao vivo e PeerJS do HTML original ainda aponta para wss://pixzin.onrender.com. O servidor Render original valida tokens no seu próprio arquivo JSON. Como este protótipo passa login/cadastro para Netlify Blobs, a autenticação com o serviço de presença do Render ainda precisa de uma ponte de validação para funcionar de ponta a ponta. Não interprete o protótipo como migração concluída do multiplayer nem como garantia de saldo seguro.

COMO TESTAR NO NETLIFY
1. Faça uma cópia/branch do projeto antes de publicar.
2. Envie estes arquivos ao repositório GitHub que será conectado ao Netlify.
3. No Netlify, configure a implantação contínua desse repositório. O netlify.toml aponta a pasta de funções.
4. Faça deploy e teste primeiro cadastro com uma conta de teste, login, nome duplicado e o limite de contas.
5. Não use senhas importantes nem dados reais neste protótipo.

O Netlify Functions instala as dependências do package.json durante o build. Não coloque tokens secretos no index.html. O Netlify Blobs usa o contexto do site dentro das funções, sem precisar expor uma chave no navegador.

RECURSOS AINDA NÃO VALIDOS COMO PRONTOS
- Integração de tokens do Blobs com o WebSocket/PeerJS Render.
- Escritas transacionais de saldo/inventário contra duas requisições simultâneas.
- Teste real de deploy neste ambiente.
