// Clerk ile Telegram botu arasında köprü
require('dotenv').config({ path: '../.env.development' });
const express = require('express');
const cors = require('cors');
const { Clerk } = require('@clerk/clerk-sdk-node');

// Bilgilendirme
console.log('Clerk API Köprüsü başlatılıyor...');

// Clerk API anahtarı kontrolü
const clerkSecretKey = process.env.CLERK_SECRET_KEY;
if (!clerkSecretKey || clerkSecretKey === 'your-clerk-secret-key') {
  console.error('HATA: CLERK_SECRET_KEY değişkeni ayarlanmamış!');
  console.error('Lütfen .env.development dosyasında CLERK_SECRET_KEY değerini ayarlayın.');
  process.exit(1);
}

// Clerk istemcisini oluştur
const clerk = new Clerk(clerkSecretKey);

// Express uygulaması oluştur
const app = express();
app.use(cors());
app.use(express.json());

// Ana sayfa
app.get('/', (req, res) => {
  res.send('Clerk-Telegram Köprüsü çalışıyor');
});

// Kullanıcı doğrulama endpoint'i
app.post('/verify', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'Kullanıcı ID'si gerekli' });
    }
    
    console.log(`Kullanıcı doğrulama isteği: ${userId}`);
    
    // Telegram ID'sini ayıkla
    const telegramId = userId.split(':')[1];
    
    if (!telegramId) {
      return res.status(400).json({ error: 'Geçersiz kullanıcı ID formatı' });
    }
    
    try {
      // Clerk'te kullanıcıyı bul
      const users = await clerk.users.getUserList({
        emailAddress: [`telegram-${telegramId}@example.com`],
      });
      
      if (users.length > 0) {
        return res.json({ verified: true, user: users[0] });
      }
      
      // Kullanıcı bulunamadı, yeni oluştur
      const newUser = await clerk.users.createUser({
        emailAddress: `telegram-${telegramId}@example.com`,
        password: `telegram-${telegramId}-password`,
        firstName: `Telegram User ${telegramId}`,
        externalId: userId,
        publicMetadata: {
          telegramId: telegramId,
        },
      });
      
      return res.json({ verified: true, user: newUser, newUser: true });
    } catch (clerkError) {
      console.error('Clerk API hatası:', clerkError);
      
      // Hata durumunda basitleştirilmiş doğrulama
      return res.json({ verified: true, simplified: true });
    }
  } catch (error) {
    console.error('Doğrulama hatası:', error);
    return res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Kullanıcı profili endpoint'i
app.get('/profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ error: 'Kullanıcı ID\'si gerekli' });
    }
    
    // Telegram ID'sini ayıkla
    const telegramId = userId.split(':')[1];
    
    if (!telegramId) {
      return res.status(400).json({ error: 'Geçersiz kullanıcı ID formatı' });
    }
    
    try {
      // Clerk'te kullanıcıyı bul
      const users = await clerk.users.getUserList({
        emailAddress: [`telegram-${telegramId}@example.com`],
      });
      
      if (users.length > 0) {
        return res.json({ profile: users[0] });
      }
      
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    } catch (clerkError) {
      console.error('Clerk API hatası:', clerkError);
      return res.status(500).json({ error: 'Clerk API hatası' });
    }
  } catch (error) {
    console.error('Profil hatası:', error);
    return res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Sunucuyu başlat
const PORT = process.env.CLERK_PORT || 5174;
app.listen(PORT, () => {
  console.log(`Clerk API Köprüsü http://localhost:${PORT} adresinde çalışıyor`);
}); 