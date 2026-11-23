# Vivi · Captura rápida Shopee — Chrome desktop (piloto)

Versão **0.2.0**. A extensão captura informações do anúncio da Shopee que está aberto na aba ativa. O clique no ícone da Vivi inicia a leitura imediatamente: não é necessário clicar em **Capturar**, **Copiar JSON**, **Enviar** nem **Salvar** se os dados estiverem completos.

## Instalação/atualização no computador

1. Baixe o código do projeto no GitHub e extraia o arquivo ZIP.
2. Localize a pasta `tools/vivi-shopee-extension`. Os arquivos `manifest.json`, `popup.html` e `popup.js` precisam continuar juntos.
3. No Chrome, visite `chrome://extensions`, ative **Modo do desenvolvedor** e escolha **Carregar sem compactação**. Se a extensão já está instalada, substitua os arquivos da pasta local e clique em **Atualizar** na página das extensões.
4. Fixe **Vivi · Captura Rápida Shopee** na barra do Chrome pelo ícone de quebra-cabeça.
5. Abra um dos anúncios do piloto de **10 produtos** da Shopee no Chrome e espere fotos/descrição carregarem.
6. Clique **uma vez** no ícone da Vivi. A leitura começa automaticamente. Se houver título, pelo menos uma foto e descrição com 50 ou mais caracteres, uma nova aba abre a ponte `/captura-vivi`, que leva ao ADM → Teste de importação. A sessão administrativa é obrigatória; se necessário, entre com a senha normalmente.
7. Confira no painel se o salvamento foi confirmado e se a quantidade de imagens e caracteres está correta.

## Se o anúncio estiver incompleto

- O popup mostrará o que foi encontrado e o botão **Capturar novamente**. Abra os detalhes/galeria na Shopee e tente outra vez.
- Use **Enviar captura parcial para revisão** para levar a informação ao ADM sem publicação automática (com proteção para títulos genéricos).
- **Copiar JSON** mantém o fluxo manual quando a navegação ou o tamanho da captura impedir a transferência.
- Produtos fora do piloto de 10 são rejeitados pelo servidor. Não tente substituir ofertas publicadas diretamente por essa extensão.

## Segurança e limites

- Permissões restritas a `activeTab`, `scripting` e `clipboardWrite`: sem autorização permanente para todos os sites, sem leitura de cookies ou senhas e sem coleta em segundo plano.
- O Chrome autoriza a leitura da aba somente quando a pessoa aciona a extensão. Uma aba nova é aberta na Vivi; a página original da Shopee permanece aberta.
- A transferência usa fragmento de URL (não enviado no pedido ao servidor); o frontend remove o fragmento e mantém o payload na `sessionStorage` até o fluxo do ADM. O endpoint valida sessão, origem, IDs de produto, imagens e lista de 10 candidatos.
- A captura é gravada apenas em `vivi_extension_test_captures`; nenhuma oferta da vitrine pública, preço, link de afiliado, cookie ou comissão é modificada.
- A galeria pode exigir inspeção humana para garantir que não incluiu imagens irrelevantes. Mudanças no layout ou verificações de acesso da Shopee podem limitar a coleta.
- O envio automático **não é captura desassistida em lote**: cada anúncio exige que a pessoa o abra no Chrome e clique no ícone da extensão.
