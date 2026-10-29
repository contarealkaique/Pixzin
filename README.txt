PIXZIN VEGAS — PROTÓTIPO GITHUB + NETLIFY
=========================================

O que este ZIP inclui
- Tela de entrada com nome + chave permanente.
- Criação de conta gera uma chave única, mostra-a uma única vez e tenta copiá-la.
- Limite de 10 contas, nomes únicos e armazenamento dos hashes das chaves.
- Função Netlify que guarda o estado num JSON privado no repositório via GitHub Contents API.
- Espera curta, timeout e tratamento de conflitos para evitar que o carregamento fique preso.

ANTES DE TESTAR: CONFIGURAÇÃO OBRIGATÓRIA NO NETLIFY
No Netlify > Site configuration > Environment variables, crie:
1) GITHUB_TOKEN = token fine-grained do GitHub com Contents: Read and write APENAS no repositório do projeto.
2) GITHUB_OWNER = seu usuário/organização do GitHub.
3) GITHUB_REPO = nome exato do repositório conectado.
4) GITHUB_BRANCH = nome da branch publicada (normalmente main).
5) PIXZIN_DATA_PATH = data/pixzin-accounts.json (opcional; pode usar este valor).
Depois faça um novo deploy para as funções receberem as variáveis. NUNCA coloque GITHUB_TOKEN no index.html, no ZIP público ou em mensagens.

ATENÇÃO À PRIVACIDADE
O arquivo JSON de dados precisa ficar em repositório PRIVADO. Se o repositório for público, nomes, saldos e hashes podem ficar expostos. Use token fine-grained com permissão mínima e revogue-o se vazar.

LIMITAÇÕES IMPORTANTES
- GitHub Contents API é um armazenamento experimental, não um banco transacional. O código tenta detectar conflitos e repetir a gravação, mas não pode prometer integridade perfeita sob concorrência. A contagem regressiva na tela é apenas UX, não um bloqueio global confiável.
- Este ZIP NÃO é uma migração completa do multiplayer: a conexão de presença e salas ainda depende do servidor WSS/Render configurado no HTML. O token emitido por esta função não é reconhecido automaticamente pelo servidor Render antigo. Assim, cadastro/login de conta no Netlify pode funcionar após configurar variáveis, mas salas multiplayer podem falhar até integrar a autenticação com o servidor de presença.
- O saldo e inventário atuais do jogo ainda têm lógica local no navegador; não trate este protótipo como seguro para valores reais. Os créditos são fictícios.
- Nenhuma chave de usuário pode ser pré-entregue antes de a conta ser criada: cada chave é gerada no cadastro e exibida uma única vez. Se perder a chave, o protótipo não tem recuperação automática.

TESTE SEGURO
1. Mantenha o site atual guardado.
2. Configure as variáveis no Netlify e publique este ZIP numa branch/site de teste.
3. Crie uma conta de teste e guarde a chave exibida.
4. Saia e teste login com nome + chave.
5. Não crie contas reais antes de confirmar a configuração e a integração de presença.
