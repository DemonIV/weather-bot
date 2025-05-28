import { Clerk } from '@clerk/clerk-js';
import './style.css';

// ÖNEMLİ: Gerçek bir Clerk Publishable Key oluşturun ve aşağıdaki satırı değiştirin
// Publishable Key'i buraya yazın (pk_test veya pk_live ile başlar)
// https://dashboard.clerk.com/last-active?path=api-keys adresinden alabilirsiniz
const CLERK_PUBLISHABLE_KEY = "pk_test_cmFyZS1kb25rZXktNzEuY2xlcmsuYWNjb3VudHMuZGV2JA";

// Clerk Publishable Key'i ortam değişkenlerinden veya sabit değerden al
const clerkPubKey = (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string) || CLERK_PUBLISHABLE_KEY;

async function initializeClerk() {
  try {
    // @ts-ignore - TypeScript hatalarını görmezden gel
    const clerk = new Clerk(clerkPubKey);
    await clerk.load();

    const appDiv = document.querySelector<HTMLDivElement>('#app');
    
    if (!appDiv) {
      console.error('App div not found');
      return;
    }
    
    if (clerk.user) {
      // Kullanıcı giriş yapmışsa
      appDiv.innerHTML = `
        <div>
          <h1>Hoş Geldiniz, ${clerk.user.firstName || 'Kullanıcı'}!</h1>
          <p>Telegram botumuzla etkileşime geçmek için aşağıdaki bağlantıyı kullanabilirsiniz:</p>
          <a href="https://web.telegram.org/k/#@MastraErp_Bot" target="_blank" class="telegram-button">
            Telegram Botuna Git
          </a>
          <div id="user-button" class="user-button"></div>
        </div>
      `;

      const userButtonDiv = document.getElementById('user-button');
      if (userButtonDiv) {
        // @ts-ignore - Clerk tiplemesi için
        clerk.mountUserButton(userButtonDiv);
      }
    } else {
      // Kullanıcı giriş yapmamışsa
      appDiv.innerHTML = `
        <div>
          <h1>Telegram Bot Uygulaması</h1>
          <p>Lütfen devam etmek için giriş yapın</p>
          <div id="sign-in"></div>
        </div>
      `;

      const signInDiv = document.getElementById('sign-in');
      if (signInDiv) {
        // @ts-ignore - Clerk tiplemesi için
        clerk.mountSignIn(signInDiv);
      }
    }
  } catch (error) {
    console.error('Clerk başlatılırken hata oluştu:', error);
    
    // Hata durumunda kullanıcıya bilgi ver
    const appDiv = document.querySelector<HTMLDivElement>('#app');
    if (appDiv) {
      appDiv.innerHTML = `
        <div class="error-container">
          <h1>Yapılandırma Hatası</h1>
          <p>Clerk yapılandırması eksik veya hatalı.</p>
          <div class="error-details">
            <p>Lütfen geçerli bir Clerk Publishable Key ekleyin:</p>
            <ol>
              <li>https://dashboard.clerk.com adresine gidin</li>
              <li>API Keys bölümüne gidin</li>
              <li>Publishable Key'inizi kopyalayın</li>
              <li>main.ts dosyasında CLERK_PUBLISHABLE_KEY değişkenini güncelleyin</li>
            </ol>
          </div>
        </div>
      `;
    }
  }
}

// Uygulamayı başlat
initializeClerk().catch(console.error);
