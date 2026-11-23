# Vivi · Capturar Shopee (piloto)

**Objetivo**: testar a coleta de fotos adicionais e da descrição do anúncio da Shopee aberto no Chrome de um computador. Não é sincronização automática, não executa compras, não altera o catálogo nem acessa cookies/senhas.

## Como instalar (Chrome no computador)

1. Baixe a pasta da extensão (ou o ZIP da conversa), extraia os arquivos e mantenha `manifest.json`, `popup.html` e `popup.js` na **mesma pasta**.
2. Acesse `chrome://extensions`.
3. Ative **Modo do desenvolvedor**.
4. Clique **Carregar sem compactação** e selecione a pasta.
5. Abra a página completa de um dos dez anúncios listados em `https://ofertas-da-vivi.vercel.app/adm#teste-importacao`.
6. No Chrome, clique na extensão **Vivi · Capturar Shopee** e depois **Capturar fotos e descrição**.
7. Confira a quantidade de fotos e caracteres. Clique em **Copiar captura para o painel**.
8. Volte à aba **Teste de importação** do painel ADM, cole o JSON e clique em **Salvar captura apenas no teste**.
9. Confira a comparação de fotos e descrição. A vitrine pública não é modificada.

## Restrições e segurança

- A extensão usa apenas `activeTab`, `scripting` e `clipboardWrite`; não tem permissão para acessar cookies, senhas ou páginas em segundo plano.
- Ela faz a leitura do DOM do anúncio aberto pelo próprio usuário. Pode falhar caso a Shopee modifique o layout, exija login/verificação ou não carregue toda a galeria.
- No teste, os dados só são aceitos para um dos **dez produtos pré-selecionados**. A identificação é conferida pelo par `shopId + itemId` e pela URL de origem.
- O backend salva descrições e URLs de fotos em tabela exclusiva `vivi_extension_test_captures`, sem tocar na tabela de produtos publicados.
- **Fotos de avaliações dos compradores não são o alvo**; a extensão tenta capturar a galeria principal e pode precisar de revisão humana para detectar alguma imagem indevida.
- Não substitui os links de afiliado nem modifica o processo de comissão.
