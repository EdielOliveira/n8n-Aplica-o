import axios from 'axios';
import FormData from 'form-data';

export default async function handler(req, res) {
  // 1. Só aceita POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    console.log('📥 WEBHOOK: Iniciando upload para Monday.com...');
    
    // 2. Dados do n8n
    const { imageUrl, itemId, columnId, version, title } = req.body;
    
    console.log(`📋 Dados recebidos:`);
    console.log('- Versão:', version);
    console.log('- Título:', title);
    console.log('- Item ID:', itemId);
    console.log('- URL Imagem:', imageUrl.substring(0, 80) + '...');
    
    // 3. VALIDAÇÃO
    if (!imageUrl || !itemId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Dados incompletos. Precisa de imageUrl e itemId.' 
      });
    }
    
    // 4. BAIXAR IMAGEM DO DALL-E
    console.log('⬇️ Baixando imagem do DALL-E...');
    const imageResponse = await axios({
      method: 'GET',
      url: imageUrl,
      responseType: 'arraybuffer', // ISSO É CRÍTICO: binário real!
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const imageBuffer = imageResponse.data;
    console.log(`✅ Imagem baixada: ${imageBuffer.length} bytes`);
    
    // 5. PREPARAR UPLOAD PARA MONDAY.COM
    console.log('📦 Preparando upload para Monday.com...');
    const form = new FormData();
    
    // Nome do arquivo
    const fileName = `reels-${version}-${Date.now()}.png`;
    
    // Mutation GraphQL do Monday.com
    const mutation = `mutation ($file: File!) {
      add_file_to_column(
        item_id: "${itemId}", 
        column_id: "${columnId}", 
        file: $file
      ) { 
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
    
    // TOKEN DO MONDAY.COM (configure no Vercel!)
    const MONDAY_TOKEN = process.env.MONDAY_API_TOKEN;
    
    if (!MONDAY_TOKEN) {
      throw new Error('❌ MONDAY_API_TOKEN não configurado no Vercel!');
    }
    
    const mondayResponse = await axios.post('https://api.monday.com/v2/file', form, {
      headers: {
        'Authorization': MONDAY_TOKEN,
        ...form.getHeaders()
      },
      timeout: 60000 // 60 segundos para upload
    });
    
    console.log('✅ UPLOAD CONCLUÍDO COM SUCESSO!');
    console.log('Resposta Monday:', JSON.stringify(mondayResponse.data, null, 2));
    
    // 7. RETORNAR SUCESSO PARA O N8N
    return res.status(200).json({
      success: true,
      message: `✅ Imagem "${title}" (${version}) anexada ao Monday.com!`,
      details: {
        fileName: fileName,
        fileSize: imageBuffer.length,
        mondayData: mondayResponse.data,
        uploadedAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    // 8. TRATAR ERROS
    console.error('❌ ERRO NO WEBHOOK:', error.message);
    
    let errorDetails = 'Erro desconhecido';
    if (error.response) {
      console.error('Resposta do erro:', error.response.data);
      errorDetails = error.response.data;
    }
    
    return res.status(500).json({
      success: false,
      error: `Falha no upload: ${error.message}`,
      errorDetails: errorDetails,
      timestamp: new Date().toISOString()
    });
  }
}