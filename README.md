# OIO Shorts Lab

PWA mobile-first com feed vertical inspirado em Shorts/Reels, navegação inferior e controles Lucide. Este repositório é independente do OIO Família Connect.

## Estado atual

- Interface responsiva para celular, tema escuro e safe-area do Android.
- Feed vertical com scroll-snap e cartões demonstrativos.
- Navegação inferior: Início, Descobrir, Criar, Atividade e Perfil.
- Ações visuais de curtir, comentar, salvar e compartilhar.
- Manifest PWA e service worker leve.
- Fluxo de publicação via GitHub Actions / GitHub Pages.
- Formulário local para validar o formato de um ID de Pin. **Ainda não chama a API do Pinterest.**

## Publicar no GitHub Pages

1. Abra **Settings → Pages**.
2. Em **Build and deployment → Source**, selecione **GitHub Actions**.
3. Abra a aba **Actions** e confirme a execução do workflow de publicação.
4. Quando a execução terminar, abra a URL indicada no ambiente `github-pages`.

## Diagnóstico da API Pinterest — pré-requisitos

O App ID e o App Secret, sozinhos, não concedem acesso aos Pins de uma pessoa. A API exige um fluxo OAuth e um token válido com os escopos necessários.

Não adicionar segredos ao código, ao README, ao `index.html` ou ao `app.js`.

Quando o fluxo de diagnóstico for implementado, os Secrets esperados serão:
- `PINTEREST_APP_ID`
- `PINTEREST_APP_SECRET`
- `PINTEREST_REFRESH_TOKEN` — token de atualização OAuth válido, obtido por um fluxo de autorização legítimo com os escopos necessários.

O diagnóstico deverá consultar um Pin específico via API v5 e registrar apenas metadados seguros: código HTTP, presença ou ausência de `video_url`, e uma mensagem de erro sanitizada. Nunca registrar tokens, segredos ou respostas completas que possam conter dados privados.

## Observações

- As publicações atuais são demonstrações visuais; não representam Pins reais nem vídeos obtidos da API.
- Curtidas, salvar, seguir e comentários ainda não persistem em banco de dados.
- O GitHub Pages serve arquivos estáticos; chamadas protegidas ao Pinterest deverão ocorrer no GitHub Actions e produzir um resultado JSON sanitizado, não no navegador.
- O GitHub Actions não é um servidor contínuo para responder a cada clique. O diagnóstico será executado manualmente ou em agenda, conforme a próxima etapa.

## Integração api.video (Vercel)

Foram adicionadas funções de servidor:
- `/api/apivideo/feed`: lista os vídeos do workspace sem expor a chave.
- `/api/apivideo/upload-token`: emite um token delegado temporário para upload, protegido por PIN.

### Configuração obrigatória na Vercel
1. Em **Project → Settings → Environment Variables**, confirme `APIVIDEO_API_KEY` em **Production**.
2. Crie `OIO_UPLOAD_PIN` com um PIN/senha forte, exclusivo para autorizar publicações.
3. Faça um novo deployment depois de salvar a variável.
4. Abra o aplicativo pelo domínio da Vercel, não pelo GitHub Pages, para que as rotas `/api/*` estejam disponíveis.

O botão **+** solicita o PIN e permite escolher um vídeo no celular. O navegador recebe apenas um token delegado de upload, não a chave principal. Os vídeos podem levar alguns minutos para serem processados antes de aparecerem no feed.

Nota: o PIN compartilhado é uma proteção inicial, não substitui autenticação individual e limitação de requisições para um serviço público.
