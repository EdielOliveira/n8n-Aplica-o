// api/upload.js
const axios = require('axios');
const FormData = require('form-data');

module.exports = async (req, res) => {
  // 1. Permitir apenas requisições POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    console.log('📥 Recebendo requisição do n8n...');
    
    // 2. Dados que o n8n vai enviar
    const { 
      imageUrl,          // URL da imagem do DALL-E
      itemId,           // ID do item no Monday (subtaskId)
      columnId,         // ID da coluna "file_mky23xpq"
      version,          // A, B, C, D
      title             // Título do conceito
    } = req.body;

    // 3. VALIDAÇÕES
    if (!imageUrl || !itemId) {
      return res.status(400).json({ 
        error: 'Dados incompletos',
        required: ['imageUrl', 'itemId', 'columnId']
      });
    }

    console.log(`🔄 Processando conceito ${version}: ${title}`);
    console.log(`📎 URL da imagem: ${imageUrl.substring(0, 80)}...`);
    console.log(`📋 Item ID Monday: ${itemId}`);

    // 4. BAIXAR IMAGEM DO DALL-E
    console.log('⬇️ Baixando imagem do DALL-E...');
    const imageResponse = await axios({
      method: 'GET',
      url: imageUrl,
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });

    const imageBuffer = imageResponse.data;
    console.log(`✅ Imagem baixada: ${imageBuffer.length} bytes`);

    // 5. PREPARAR UPLOAD PARA MONDAY.COM
    console.log('⬆️ Preparando upload para Monday.com...');
    const form = new FormData();
    
    // Nome do arquivo
    const fileName = `reels-${version}-${Date.now()}.png`;
    
    // Mutation GraphQL do Monday
    const mutation = `mutation ($file: File!) {
      add_file_to_column(item_id: "${itemId}", column_id: "${columnId}", file: $file) {
        id
        name
        url
      }
    }`;
    
    form.append('query', mutation);
    form.append('variables[file]', imageBuffer, {
      filename: fileName,
      contentType: 'image/png'
    });

    // 6. ENVIAR PARA MONDAY.COM
    console.log('🚀 Enviando para Monday.com API...');
    
    // SEU TOKEN DO MONDAY (coloque como variável de ambiente no Vercel)
    const MONDAY_TOKEN = process.env.MONDAY_API_TOKEN;
    
    if (!MONDAY_TOKEN) {
      throw new Error('Token do Monday.com não configurado');
    }

    const mondayResponse = await axios.post('https://api.monday.com/v2/file', form, {
      headers: {
        'Authorization': MONDAY_TOKEN,
        ...form.getHeaders()
      },
      timeout: 60000
    });

    console.log('✅ Upload concluído com sucesso!');
    console.log('Resposta Monday:', JSON.stringify(mondayResponse.data, null, 2));

    // 7. RETORNAR SUCESSO PARA O N8N
    return res.status(200).json({
      success: true,
      message: `Imagem "${title}" (${version}) anexada ao Monday!`,
      data: {
        fileName: fileName,
        fileSize: imageBuffer.length,
        mondayResponse: mondayResponse.data,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    // 8. TRATAR ERROS
    console.error('❌ ERRO NO WEBHOOK:', error.message);
    
    if (error.response) {
      console.error('Resposta do erro:', error.response.data);
    }

    return res.status(500).json({
      success: false,
      error: error.message,
      details: error.response?.data || 'Erro desconhecido'
    });
  }
};