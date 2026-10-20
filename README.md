# Tank Arena Online

## Rodar localmente
Requer Node.js 18 ou superior.

```bash
npm install && npm start
```

Abra http://localhost:3000. Para jogar com outras pessoas, publique o servidor e compartilhe o mesmo nome de sala.

## Publicar no Render
1. Envie estes arquivos para um repositório GitHub.
2. No Render, escolha **New → Blueprint** e conecte o repositório.
3. O Render lê `render.yaml`, instala `ws` e inicia `npm start`.
4. Abra a URL HTTPS criada. O WebSocket usa `wss://` automaticamente.
5. Verifique `/health`, que deve responder `ok`.

O plano gratuito pode suspender serviços inativos, causando uma pausa na primeira conexão. O servidor retransmite mensagens e não é uma autoridade de simulação; o jogo é um protótipo casual, não resistente a trapaças.
