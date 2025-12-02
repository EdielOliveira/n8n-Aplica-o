// api/upload.js - VERSÃO FINAL
import axios from 'axios';
import FormData from 'form-data';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    console.log('📥 WEBHOOK: Iniciando upload...');
    
    const { imageUrl, itemId, columnId, version, title } = req.body;
    
    console.log('📋 Dados:', { version, title, itemId, columnId });
    
    // VALIDAÇÕES
    if (!imageUrl) throw new Error('imageUrl é obrigatório');
    if (!itemId) throw new Error('itemId é obrigatório');
    
    // TOKEN DO MONDAY (AGORA DEVE ESTAR CONFIGURADO!)
    const MONDAY_TOKEN = process.env.MONDAY_API_TOKEN;
    console.log('🔐 Token presente?', MONDAY_TOKEN ? 'SIM ✓' : 'NÃO ❌');
    
    if (!MONDAY_TOKEN) {
      throw new Error('❌ Configure MONDAY_API_TOKEN no Vercel: Settings → Environment Variables');
    }

    // 1. BAIXAR IMAGEM DO DALL-E
    console.log('⬇️ Baixando imagem...');
    const imageResponse = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 30000
    });
    
    const imageBuffer = imageResponse.data;
    console.log(`✅ Imagem baixada: ${imageBuffer.length} bytes`);

    // 2. PREPARAR UPLOAD PARA MONDAY
    console.log('📦 Preparando upload...');
    const form = new FormData();
    const fileName = `reels-${version}-${Date.now()}.png`;
    
    const mutation = `mutation ($file: File!) {
      add_file_to_column(
        item_id: "${itemId}", 
        column_id: "${columnId}", 
        file: $file
      ) { id name url }
    }`;
    
    form.append('query', mutation);
    form.append('variables[file]', Buffer.from(imageBuffer), {
      filename: fileName,
      contentType: 'image/png'
    });

    // 3. ENVIAR PARA MONDAY
    console.log('🚀 Enviando para Monday.com...');
    const mondayResponse = await axios.post('https://api.monday.com/v2/file', form, {
      headers: {
        'Authorization': MONDAY_TOKEN,
        ...form.getHeaders()
      },
      timeout: 60000
    });
    
    console.log('🎉 UPLOAD CONCLUÍDO!');
    
    // 4. RETORNAR SUCESSO
    return res.status(200).json({
      success: true,
      message: `✅ Imagem "${title}" anexada ao Monday!`,
      details: {
        fileName,
        fileSize: imageBuffer.length,
        mondayData: mondayResponse.data,
        uploadedAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ ERRO:', error.message);
    
    return res.status(500).json({
      success: false,
      error: `Falha: ${error.message}`,
      timestamp: new Date().toISOString()
    });
  }
}