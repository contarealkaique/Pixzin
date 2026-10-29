PIXZIN — VERSÃO PREMIUM + CONECTIVIDADE
=======================================

O QUE ESTA VERSÃO INCLUI
- Remove clima e geolocalização.
- Atualiza a identidade visual para cassino Vegas: preto, vermelho, dourado, mesa verde, brilho e efeitos sonoros por interação.
- Login por nick temporário verificado no servidor (reserva enquanto a conexão estiver ativa).
- Contador de jogadores online e ranking em tempo real por pontos da sessão (requer republicar também o servidor atualizado).
- Abas separadas para Início, Jogos, Salas e Minha conta.
- Jogos individuais e multiplayer identificados e filtráveis separadamente. Inclui Roleta Vegas, 21 de Cartas, Caça-níquel Royale, Dados de Luxo e Memória Royale, além dos jogos rápidos existentes.
- Link direto, WhatsApp, QR Code e entrada por código.
- Busca automática de adversário usando fila em memória, por mesa de créditos fictícios.
- Servidor próprio para presença, pareamento e sinalização PeerJS. Não usa banco de dados.
- O servidor mantém somente dados temporários em memória; reiniciar o serviço limpa presença, ranking, fila e registro temporário das salas. Os pontos e fichas reiniciam ao encerrar a aba/sessão.

IMPORTANTE: O HTML não consegue usar o backend antes de você publicar o serviço e colocar sua URL WSS em SIGNAL_SERVER_URL. Não existe um servidor hospedado por mim; o projeto inclui o código e os passos para publicá-lo.

PUBLICAÇÃO DO SERVIDOR (Render ou serviço Node equivalente)
1. Envie a pasta do projeto para um repositório GitHub.
2. Crie um Web Service Node apontando para a pasta `server`.
3. Build command: `npm install`
4. Start command: `npm start`
5. Use Node 18 ou superior. O servidor escuta a variável PORT fornecida pela hospedagem.
6. Após publicar, abra a URL HTTPS do serviço e confirme que responde JSON com `status: ok` e `database: false`.
7. A URL pública do serviço deve ser HTTPS. No site, use a versão WSS dela, por exemplo `wss://seu-servico.onrender.com`.
8. Abra `index.html` e substitua:
   const SIGNAL_SERVER_URL='wss://pixzin.onrender.com';
   pela URL WSS real, sem `/presence` nem `/peerjs` no final. Neste pacote, o endereço já está configurado como `wss://pixzin.onrender.com`.
9. Publique o `index.html` no Netlify (raiz do site) e teste em dois aparelhos diferentes.
10. Opcional: configure a variável `SITE_ORIGIN` no servidor com a origem exata do site, por exemplo `https://seu-site.netlify.app`.

ROTAS DO SERVIDOR
- GET / ou GET /health: estado do serviço.
- WSS /presence: login temporário, disponibilidade de nicks, contagem online, ranking temporário por pontos e fila de pareamento.
- PeerJS em /peerjs: sinalização para salas e conexões entre navegadores.

TESTE DE ACEITAÇÃO
1. Abra o site em dois celulares, preferencialmente em redes diferentes.
2. Entre com dois nicks diferentes: ambos devem ficar online.
3. Tente o mesmo nick em um terceiro navegador: o servidor deve recusar enquanto o nick estiver reservado.
4. Em ambos os celulares, aceite as regras e selecione a mesma mesa fictícia.
5. Toque em Encontrar adversário nos dois. Um deve hospedar a conexão PeerJS e o outro deve conectar-se a ele.
6. Teste também criar sala, copiar link, abrir o link no segundo aparelho e entrar com nick.
7. Teste encerrar uma sessão e confirme que o nick fica disponível novamente.

LIMITES E HONESTIDADE TÉCNICA
- Não há banco de dados. Nicks, fila e salas registradas são voláteis e somem se o serviço reiniciar.
- O anfitrião ainda precisa manter o navegador aberto para uma sala privada PeerJS permanecer acessível.
- O serviço de presença/pareamento precisa permanecer ligado. Hospedagens gratuitas podem suspender o serviço quando inativo; para disponibilidade consistente 24/7, escolha uma instância sempre ativa.
- WebRTC direto pode falhar em algumas redes restritivas. Um servidor TURN pode ser necessário para maximizar a conectividade em redes móveis/CGNAT/firewalls.
- Os créditos são fictícios. A Roleta Vegas é local e demonstrativa, não sincroniza as apostas com outros jogadores. As fichas são temporárias na aba e não formam carteira; os pontos são associados à sessão online e não têm valor monetário. O placar da sala é coordenado pelo anfitrião e serve para demonstração, não para competição com prêmios.
- Não há autenticação permanente, senha, recuperação de conta ou persistência após limpeza dos dados do navegador.
- O relatório exportado é informativo; o arquivo pode ser aberto no navegador e salvo como PDF.

SEGURANÇA
- Não use esta versão para depósitos, apostas com dinheiro, saques ou distribuição de prêmios.
- A fila e as reservas são em memória, não resistentes a reinicializações e não são adequadas a alto tráfego sem endurecimento adicional.
- Configure SITE_ORIGIN para restringir conexões WebSocket à origem do site quando possível.
