# Vivi · Captura Shopee desktop (piloto)

Versão **0.3.0**. Agora há dois modos: **um clique**, já validado no Chrome, e **captura contínua opcional** para anúncios visitados. Ambos só encaminham resultados para o ambiente de teste autenticado da Vivi, limitado a dez produtos. A loja pública não é alterada.

## Atualizar a extensão instalada

1. Baixe o projeto atualizado no GitHub (Download ZIP), extraia e entre na pasta `tools/vivi-shopee-extension`.
2. Substitua os arquivos da extensão instalada pelos novos. A pasta agora deve incluir `manifest.json`, `popup.html`, `popup.js`, `capture-page.js` e `background.js`.
3. Abra `chrome://extensions`, ative Modo do desenvolvedor se necessário e clique em **Atualizar** na extensão Vivi; caso o Chrome não encontre os novos arquivos, use **Carregar sem compactação** apontando para a pasta correta.
4. Abra `https://ofertas-da-vivi.vercel.app/adm#teste-importacao` e faça login administrativo.

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
