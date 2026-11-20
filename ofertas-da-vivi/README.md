# Ofertas da Vivi 🧡

Site de achadinhos e ofertas com visual inspirado no mockup aprovado, compatível com desktop e celular, painel ADM protegido, catálogo, favoritos, pesquisa, categorias, cupons informativos, integração de afiliados Shopee e banco Neon.

## Requisitos

- Node.js 22+
- Conta Vercel para publicar
- Banco PostgreSQL no Neon (para persistir ofertas e configurações)
- Acesso liberado à Shopee Affiliate Open API, se desejar importação automática

## Executar localmente

```sh
npm install
cp .env.example .env.local
npm run dev
```

Acesse `http://localhost:3000`. Sem banco de dados, o site mostra apenas **produtos ilustrativos**, identificados como demonstração e sem links de compra.

## Configuração segura na Vercel

Crie um projeto Next.js e configure em *Settings > Environment Variables*:

| Variável | Finalidade |
|---|---|
| `ADMIN_PASSWORD` | Senha forte para `/adm`. Não a publique no repositório. |
| `SESSION_SECRET` | Segredo de sessão aleatório, com no mínimo 32 caracteres. |
| `DATABASE_URL` | String de conexão PostgreSQL do Neon. |
| `SHOPEE_APP_ID` | ID da sua aplicação Affiliate Open API. |
| `SHOPEE_APP_SECRET` | Secret da API Shopee. |
| `NEXT_PUBLIC_SITE_URL` | URL pública do projeto, para o sitemap. |

**Defina ADMIN_PASSWORD, SESSION_SECRET, DATABASE_URL, SHOPEE_APP_ID e SHOPEE_APP_SECRET como variáveis do tipo Secret da Vercel.** Não publique valores com prefixo `NEXT_PUBLIC_`, nem os armazene no banco. Após alterá-los, faça um novo deploy. Nenhuma credencial vem pré-configurada. O painel administrativo permanece inacessível até a senha e a chave de sessão serem informadas.

## Painel ADM

Entre em `https://SEU-DOMINIO/adm` após configurar as credenciais de administrador.

- **Visão geral:** produtos cadastrados, ofertas ativas, cliques.
- **Ofertas:** ativar/desativar, marcar como destaque, apagar.
- **Integração Shopee:** testar a conexão, buscar produtos e importar apenas itens selecionados, após aprovação da API.
- **Configurações:** adicionar produtos com link de afiliada, URL do canal WhatsApp, Instagram, TikTok e chamada do banner.

**Importação segura:** produtos sincronizados são inseridos **inativos**, para revisão manual. A API usa SHA256 com o corpo exato da requisição, apenas no servidor.

## Dados e comissões

O site registra contagens de cliques próprios, não vendas confirmadas. Comissões, pagamentos e conversões dependem dos relatórios da Shopee e não podem ser deduzidos dos cliques. A plataforma não se apresenta como canal oficial da Shopee.

## Aspectos pendentes antes de tornar o site comercial

1. Conectar banco e credenciais Shopee autorizadas.
2. Testar consultas GraphQL com a conta real e ajustar campos permitidos pela API.
3. Ativar produtos e revisar seus links, valores e imagens.
4. Configurar o canal VIP e redes sociais.
5. Definir domínio, identidade final, política de privacidade e canais de contato válidos.
6. Conferir as políticas atuais do Programa de Afiliados antes de investir em mídia paga.

## Observações

- Nenhum link de demonstração leva a uma compra.
- O projeto não verifica estoque/preço em tempo real após a importação; refaça a sincronização e revise as ofertas regularmente.
- O “preço antigo” aparece somente se fornecido pela API ou inserido manualmente.
- **Ambiente de desenvolvimento:** execute `npm run build` após instalar dependências antes da publicação.

