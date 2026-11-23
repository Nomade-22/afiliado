# Vivi · Captura Shopee desktop (piloto)

Versão **0.5.0**. Agora há dois modos: **um clique**, já validado no Chrome, e **captura contínua opcional** para anúncios visitados. Ambos só encaminham resultados para o ambiente de teste autenticado da Vivi, limitado a dez produtos. A loja pública não é alterada.

## Atualizar a extensão instalada

1. Baixe o projeto atualizado no GitHub (Download ZIP), extraia e entre na pasta `tools/vivi-shopee-extension`.
2. Substitua os arquivos da extensão instalada pelos novos. A pasta agora deve incluir `manifest.json`, `popup.html`, `popup.js`, `capture-page.js` e `background.js`.
3. Abra `chrome://extensions`, ative Modo do desenvolvedor se necessário e clique em **Atualizar** na extensão Vivi; caso o Chrome não encontre os novos arquivos, use **Carregar sem compactação** apontando para a pasta correta.
4. Abra `https://ofertas-da-vivi.vercel.app/adm#teste-importacao` e faça login administrativo.

## Botão Capturar com a Vivi em cada produto (novo)

Depois de atualizar a extensão e recarregar `https://ofertas-da-vivi.vercel.app/adm#teste-importacao`, cada card da lista de dez produtos mostra **Abrir anúncio** e **Capturar com a Vivi** lado a lado no Chrome desktop.

1. Faça login no painel ADM da Vivi.
2. Clique em **Capturar com a Vivi** no produto desejado. O site envia a solicitação à extensão instalada pela ponte local `adm-bridge.js`; não há ID de extensão fixo nem tentativa de executar scripts de extensão diretamente pelo site.
3. A extensão consulta a lista de dez produtos do servidor, confere IDs e verifica a permissão do Chrome para ler `shopee.com.br`.
4. Ela abre temporariamente o anúncio em uma aba do Chrome, aguarda o carregamento e coleta título, galeria e descrição.
5. Só grava dados completos usando a própria sessão administrativa no endpoint de teste `/api/admin/scrapling-test/extension`. Em seguida, fecha a aba temporária, volta ao ADM, atualiza o card e indica **Salvo** ou **Revisar**.
6. O botão não altera `vivi_offers` nem publica a captura na loja. **Abrir anúncio** segue funcionando separadamente.

**Permissão inicial**: se o Chrome disser que a extensão ainda não tem acesso à Shopee, clique no ícone Vivi, escolha **Ativar captura contínua** para autorizar os domínios Shopee e depois **Pausar captura contínua**. Assim o botão do painel pode usar a permissão já concedida sem capturas passivas. Você pode revogá-la em `chrome://extensions`.

**Se a extensão não for detectada**: confira se a pasta instalada inclui `adm-bridge.js`, se a extensão está ativada e se a aba ADM foi recarregada depois da atualização. O site não consegue acionar a extensão antiga que não tem a ponte.

## Capturar todos os anúncios pendentes com um clique (novo)

1. Abra **https://ofertas-da-vivi.vercel.app/adm#teste-importacao** e faça login.
2. Clique no ícone da extensão Vivi **enquanto estiver na aba ADM**. Escolha **Capturar pendentes do piloto**.
3. Autorize o acesso apenas às páginas Shopee (o Chrome perguntará se ainda não estiver autorizado).
4. A extensão consulta a lista **atual** de até dez produtos do teste e seleciona apenas aqueles que não têm captura ou cuja descrição tem menos de 50 caracteres, ou sem nenhuma foto.
5. Cada anúncio é aberto temporariamente em uma aba ativa do Chrome, lido com o coletor da extensão e enviado **diretamente à API autenticada da Vivi** quando há dados completos. A aba do anúncio é fechada antes do próximo.
6. Confira a contagem de salvos e falhas no popup da extensão; clique em **Pausar lote** para interromper. Confira os resultados no painel ADM após a execução.

**Importante:** a extensão não consegue operar remotamente no computador a partir do ChatGPT; esta ação roda dentro do seu próprio Chrome depois que você clicar no botão. Se a Shopee mostrar apenas uma página genérica, exigir login ou não renderizar imagens, esse produto será marcado para revisão e não será salvo. O sistema informa **salvo** somente quando o endpoint confirma a gravação. O modo contínuo é desligado ao iniciar o lote para impedir duplicatas. A vitrine pública não é modificada.

## Captura contínua: sem clicar na extensão a cada produto

1. Clique no ícone da extensão Vivi e pressione **Ativar captura contínua**.
2. O Chrome solicitará permissão para acessar **somente** páginas `shopee.com.br` e `www.shopee.com.br`. Conceda apenas se quiser esse modo.
3. Navegue normalmente pelos anúncios dos **dez produtos do piloto** na Shopee. Quando a página de um produto ativo carregar, a extensão tenta ler título, descrição e fotos (até três tentativas curtas).
4. Se os dados estiverem completos, ela abre **uma aba em segundo plano** para encaminhar o resultado ao teste da Vivi. Não tira você da Shopee. O servidor confirma a sessão ADM e a correspondência do produto.
5. Confira os resultados em ADM → Teste de importação. O popup mostra status da última captura e contador da sessão.
6. Clique **Pausar captura contínua** quando desejar. O modo também pausa automaticamente ao atingir dez produtos distintos na sessão.
7. Para iniciar nova rodada, use **Reiniciar contador da sessão**. Essa ação não apaga os registros que já foram salvos no banco.

**Notas**: o modo contínuo é desligado por padrão; ativá-lo não produz uma coleta massiva da Shopee. Ele apenas reage a anúncios que você abre no Chrome. Produtos fora do piloto continuam rejeitados pelo backend e podem consumir um dos dez espaços de tentativa. Capturas parciais não são transmitidas automaticamente.

## Captura manual (um clique)

- Com o modo contínuo desligado, abra um anúncio Shopee, clique no ícone da extensão Vivi e a captura começa automaticamente.
- Quando há título confiável, descrição com pelo menos 50 caracteres e uma foto, abre a aba ADM para o salvamento automático, sujeito à autenticação e às regras do piloto.
- Dados incompletos podem ser capturados novamente, encaminhados para revisão ou copiados em JSON.
- O botão **Capturar novamente** pode ser utilizado também enquanto o modo contínuo estiver ligado.

## Segurança e limites

- Usa `activeTab`, `scripting`, `clipboardWrite` e `storage`, com permissão de host **opcional** somente para o domínio Shopee.
- Não acessa cookies, senhas, avaliações privadas ou páginas em outros domínios.
- Os dados seguem pelo fragmento de URL até `/captura-vivi`; a ponte remove o fragmento do histórico e usa `sessionStorage` na aba criada até a autenticação ADM.
- Apenas `vivi_extension_test_captures` é alterada; o endpoint verifica shopId/itemId, URL, imagens e produtos autorizados. Não modifica `vivi_offers`, preços, links, cookies nem comissões.
- O Chrome pode limitar a automação em páginas com login, bloqueios ou renderização tardia. Nem a extensão nem o site conseguem garantir extração de todo anúncio.
- Abas de fundo criadas pela extensão podem permanecer abertas para você conferir o resultado. O contador impede envio repetido do mesmo ID na sessão.
