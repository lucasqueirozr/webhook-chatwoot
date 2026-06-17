const express = require('express');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware para parsear JSON
app.use(express.json());

// Middleware para validar a assinatura do Chatwoot
const validateSignature = (req, res, next) => {
    const signature = req.headers['x-chatwoot-signature'];
    const secret = process.env.CHATWOOT_WEBHOOK_SECRET;

    if (!secret) {
        console.log('⚠️  CHATWOOT_WEBHOOK_SECRET não configurado. Pulando validação.');
        return next();
    }

    if (!signature) {
        return res.status(401).json({ error: 'Assinatura não fornecida' });
    }

    // Chatwoot usa HMAC-SHA256 com o corpo da requisição
    const payload = JSON.stringify(req.body);
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

    if (signature !== expectedSignature) {
        return res.status(401).json({ error: 'Assinatura inválida' });
    }

    next();
};

// Endpoint principal do webhook
app.post('/webhook', validateSignature, async (req, res) => {
    try {
        const payload = req.body;
        const event = payload.event;

        console.log(`📨 Evento recebido: ${event}`);

        // Processa apenas mensagens de clientes
        if (event === 'message_created' && payload.message_type === 'incoming') {
            await handleMessage(payload);
        }

        // Sempre retorna 200 OK para o Chatwoot
        res.status(200).json({ status: 'ok', event });

    } catch (error) {
        console.error('❌ Erro no webhook:', error);
        res.status(200).json({ status: 'error', message: error.message });
    }
});

// Função para processar a mensagem
async function handleMessage(payload) {
    try {
        const conversationId = payload.conversation?.id;
        const accountId = payload.account?.id;
        const content = payload.content;
        const senderName = payload.sender?.name || 'Cliente';

        console.log(`💬 Mensagem de ${senderName}: "${content}"`);
        console.log(`📋 Conversa ID: ${conversationId}, Account ID: ${accountId}`);

        // PASSO 1: Enviar para o Claude via MCP
        // Substitua esta parte pela sua integração com o MCP
        const claudeResponse = await getClaudeResponse(content);

        // PASSO 2: Enviar a resposta de volta para o Chatwoot
        await sendMessageToChatwoot(accountId, conversationId, claudeResponse);

        console.log(`✅ Resposta enviada: "${claudeResponse}"`);

    } catch (error) {
        console.error('❌ Erro ao processar mensagem:', error);
        throw error;
    }
}

// Função para chamar o Claude via MCP
async function getClaudeResponse(userMessage) {
    // 🔧 AQUI VOCÊ VAI INTEGRAR COM O MCP DO CLAUDE
    // Por enquanto, retorna uma resposta genérica

    // Exemplo de como seria com o MCP:
    // const mcpResponse = await axios.post('http://seu-mcp-server/chat', {
    //     message: userMessage,
    //     conversation_id: '...'
    // });
    // return mcpResponse.data.reply;

    // Resposta temporária para teste
    return `Olá! Recebi sua mensagem: "${userMessage}". Estou integrado com Claude via MCP! 🚀`;
}

// Função para enviar mensagem de volta ao Chatwoot
async function sendMessageToChatwoot(accountId, conversationId, message) {
    const apiUrl = `${process.env.CHATWOOT_API_URL || 'https://app.chatwoot.com'}/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`;

    // Use o token de acesso do seu AgentBot
    const token = process.env.CHATWOOT_BOT_TOKEN;

    if (!token) {
        console.log('⚠️  CHATWOOT_BOT_TOKEN não configurado. Não é possível enviar resposta.');
        return;
    }

    await axios.post(apiUrl, {
        content: message,
        message_type: 'outgoing', // 'outgoing' para resposta ao cliente
        private: false // false para o cliente ver, true para nota interna
    }, {
        headers: {
            'Content-Type': 'application/json',
            'api_access_token': token
        }
    });
}

// Rota de health check para o Portainer
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'chatwoot-webhook' });
});

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`🚀 Webhook rodando na porta ${PORT}`);
    console.log(`📍 Endpoint: http://localhost:${PORT}/webhook`);
    console.log(`💚 Health check: http://localhost:${PORT}/health`);
});