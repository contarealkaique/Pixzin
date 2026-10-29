PIXZIN VEGAS — PATCH DE CORREÇÃO DA FUNÇÃO DE CONTAS

O que foi corrigido nesta versão:
- A função accounts.mjs agora usa o formato Request/Response (Netlify Functions v2), convertendo a solicitação para o formato esperado pelo código existente.
- A interface mostra uma mensagem mais útil se a função retornar HTML/uma resposta vazia em vez de JSON.
- Mantém cadastro com chave única, login por chave e limite de 10 contas.

CONFIGURAÇÃO NO NETLIFY
Defina em Site configuration > Environment variables:
GITHUB_TOKEN = token secreto do GitHub (não coloque no HTML nem publique em repositório público)
GITHUB_OWNER = usuário/organização proprietária do repositório
GITHUB_REPO = nome do repositório
GITHUB_BRANCH = main (ou o nome real da branch publicada)
PIXZIN_DATA_PATH = data/pixzin-accounts.json

O token deve ter permissão de leitura e escrita de Contents no repositório. Depois de atualizar os arquivos no mesmo repositório já conectado ao Netlify, acione um novo deploy. Após alterar variáveis de ambiente, é obrigatório publicar um novo deploy.

TESTE
1. Abra /.netlify/functions/accounts?action=health no domínio publicado. Deve aparecer JSON com ok:true.
2. Na tela, digite um nome com pelo menos 3 caracteres e pressione Criar conta.
3. A chave deve aparecer em uma janela para copiar/guardar.
4. Saia e teste o login com o mesmo nome e chave.

IMPORTANTE
Este patch corrige o formato da função que pode causar “Resposta inválida do Netlify Functions”, mas não permite testar a publicação nem as variáveis da sua conta daqui. Se o endpoint health informar falta de variáveis, configure-as no Netlify. GitHub Contents API não é banco transacional; conflitos simultâneos são mitigados com novas tentativas, mas não eliminados. O servidor multiplayer original ainda pode depender de um serviço externo.
