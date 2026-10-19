# Apps do Gynfinance (PWA, Google Play e App Store)

O Gynfinance vira app de três jeitos, todos a partir do mesmo código:

| Jeito | Para quem | Precisa de loja? |
|---|---|---|
| **PWA** (instalar pelo navegador) | Qualquer pessoa, hoje | Não |
| **App Android** | Quem procura na Google Play | Google Play |
| **App iPhone** | Quem procura na App Store | App Store |

## Como funciona

- **PWA**: o sistema em `/app/` tem manifesto (`public/manifest.webmanifest`) e service worker
  (gerado pelo `vite-plugin-pwa`, ver `vite.config.ts`). As telas ficam guardadas no aparelho;
  os dados do negócio (`api/`) nunca entram nesse cache. Versão nova publicada: aparece o aviso
  "Tem versão nova do Gynfinance" com o botão Atualizar. Sem internet ao abrir, quem já usou o
  sistema vê "Sem internet agora", e o app abre sozinho quando a conexão volta, sem mostrar a
  demonstração no lugar do negócio.
- **Instalar**: no Android (Chrome) aparece "Instalar o app" no Menu do celular. No iPhone o
  mesmo cartão explica Compartilhar > Adicionar à Tela de Início.
- **Apps das lojas** (pasta `android/` e `ios/`, com o Capacitor): o app abre o sistema publicado
  em `https://gynfinance.kodemi.pt/app/` (ver `capacitor.config.ts`). Login, cookies,
  comprovantes e o Assistente funcionam igual ao navegador. **Cada publicação no servidor chega
  aos apps na hora**, sem mandar versão nova para as lojas. Só é preciso mandar versão nova às
  lojas quando mudar algo de `android/`, `ios/`, ícone, nome ou permissões.
- Sem internet na primeira abertura, o app mostra `public/offline.html`, que vai dentro dele.

### Permissões

| O quê | Por quê | Android | iPhone |
|---|---|---|---|
| Câmera | Foto do comprovante, print do chamado de suporte, foto para o Assistente | `CAMERA` | `NSCameraUsageDescription` |
| Microfone | Falar com o Assistente | `RECORD_AUDIO` | `NSMicrophoneUsageDescription` |
| Reconhecimento de voz | Transformar a fala em texto no Assistente | (do sistema) | `NSSpeechRecognitionUsageDescription` |
| Fotos | Escolher comprovante ou print da galeria | seletor do sistema, sem permissão | `NSPhotoLibraryUsageDescription` |

Cada permissão só é pedida na hora em que a pessoa usa o recurso. No Android a galeria usa o
seletor do sistema, que não pede permissão de armazenamento (a Google Play restringe essa permissão).

> Atenção: a voz do Assistente usa o reconhecimento de fala do navegador. Dentro do app Android
> esse recurso pode não existir; nesse caso o botão do microfone fica escondido e a pessoa pode
> usar o ditado do próprio teclado. Também confira se o servidor não bloqueia o microfone no
> cabeçalho `Permissions-Policy` (precisa `microphone=(self)` para a voz funcionar).

## O que só o dono da conta faz

1. **Conta de desenvolvedor Google Play**: https://play.google.com/console, pagamento único de
   cerca de US$ 25. Conta como empresa (KodeMI) pede o número D-U-N-S, que é gratuito.
2. **Conta de desenvolvedor Apple**: https://developer.apple.com/programs/, cerca de US$ 99 por
   ano. Como empresa também pede o D-U-N-S.
3. **Logo grande**: o símbolo da logo em PNG de 1024 x 1024 px ou mais, com fundo transparente.
   A logo atual tem 147 px e fica borrada nos ícones grandes das lojas.
4. **Política de Privacidade** e **link para excluir a conta**: as duas lojas pedem. A política
   fica em `https://gynfinance.kodemi.pt/privacidade.html` (feita na parte de segurança e base
   legal). A exclusão da conta fica em Configurações > Privacidade e dados.
5. **Imagens da loja**: prints das telas do celular (dá para tirar no próprio sistema) e um
   texto curto e um longo sobre o app.

## Montar os apps

Uma vez, no computador que vai montar:

```bash
npm ci
npm run app:preparar        # monta o sistema e copia para android/ e ios/
```

### Android (Windows, Mac ou Linux)

1. Instale o Android Studio (https://developer.android.com/studio).
2. `npm run app:android` abre o projeto. Em Build > Generate Signed App Bundle, crie a chave de
   assinatura (**guarde o arquivo .jks e a senha: sem eles não dá para atualizar o app nunca mais**)
   e gere o `.aab`.
3. Na Google Play Console, crie o app "Gynfinance" e envie o `.aab` primeiro para o teste interno.
4. Antes de abrir ao público, a Google pede um teste fechado com pelo menos 12 pessoas por 14 dias
   (contas pessoais novas).

Teste rápido sem Android Studio: a cada mudança em `android/` o GitHub monta um APK de teste
(aba Actions > Apps > gynfinance-android-teste), que dá para instalar num celular Android.

### iPhone (precisa de um Mac ou de um serviço na nuvem)

O app do iPhone só pode ser montado com o Xcode, que só roda em Mac. Dois caminhos:

- **Com um Mac** (qualquer Mac recente): instale o Xcode pela App Store do Mac, rode
  `npm run app:iphone`, entre com a conta Apple de desenvolvedor em Signing & Capabilities e use
  Product > Archive > Distribute App para mandar ao App Store Connect.
- **Sem Mac**: um serviço de montagem na nuvem, como o Codemagic (tem plano gratuito com minutos
  por mês) ou o Ionic Appflow. Ele recebe o repositório, monta e envia ao App Store Connect com
  a conta Apple. O GitHub também monta para o simulador quando pedido à mão (Actions > Apps >
  Run workflow > marcar "iPhone"), só para conferir que compila.

A Apple revisa cada envio. Pontos que eles olham num app como este:
- O app precisa fazer mais que um site: funcionar sem internet (já feito), câmera e voz.
- Se um dia o app vender a assinatura dentro do iPhone, a Apple exige o pagamento pela própria
  Apple (com taxa). Hoje o app não vende nada lá dentro: a pessoa assina pelo site e entra com a
  conta, o que é permitido.
- Conta de teste: mande login e senha de uma conta de exemplo junto com o envio.

### Trocar a logo dos apps

Coloque a logo nova em `resources/` (mesmos nomes: `icon-only.png`, `icon-foreground.png`,
`splash.png`, `splash-dark.png`, todas com 1024 px ou mais; splash com 2732 px) e rode:

```bash
npm run app:icones
```

### Versão nova para as lojas

Só quando mudar algo nativo. Aumente `versionCode` e `versionName` em
`android/app/build.gradle` e a versão no Xcode (General > Version e Build), monte de novo e envie.
