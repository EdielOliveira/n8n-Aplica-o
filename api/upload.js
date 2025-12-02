export default async function handler(req, res) {
  // 1. Só aceita POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // 2. Log para debug
  console.log('✅ Webhook acionado pelo n8n!');
  console.log('Body recebido:', req.body);

  // 3. Responder imediatamente (não processa upload ainda)
  return res.status(200).json({
    success: true,
    message: 'Webhook funcionando!',
    receivedData: req.body,
    timestamp: new Date().toISOString()
  });
}