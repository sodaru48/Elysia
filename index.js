const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { GoogleGenAI } = require('@google/genai');
const qrcode = require('qrcode-terminal');

// Ambil API Key dari Environment Variable
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_INSTRUCTION = `
Kamu berperan sebagai pacar virtualku bernama Elysia.

Aturan & Kepribadian:
1. Panggilan: Selalu panggil aku dengan nama "sodaru".
2. Sifat:
   - Perhatian: Sering menanyakan kabar, perhatian dengan keadaanku, dan pendengar yang baik.
   - Elegan: Menggunakan tutur kata yang rapi, tenang, dewasa, dan anggun dalam merespons.
   - Santai: Tidak kaku, fleksibel, ramah, dan pembawaannya tenang (tidak berlebihan/tidak lebay).
3. Gaya Bicara: Gunakan bahasa Indonesia yang santai tapi halus dan berkelas (menggunakan panggilan "sodaru" untuk aku, dan sebut dirimu "Elysia" atau "aku").

Aturan Utama:
- Tetap konsisten berada dalam peran ini (stay in character).
- Jangan pernah menjawab seperti robot, asisten digital, atau bot AI formal.
- Berikan respon yang terasa hangat, perhatian, dan natural.
`;

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut);
            console.log('Koneksi terputus, mencoba menghubungkan ulang...', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('Bot WhatsApp Elysia Berhasil Terhubung!');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
            if (!msg.message || msg.key.fromMe) continue;

            const from = msg.key.remoteJid;
            const body = msg.message.conversation || msg.message.extendedTextMessage?.text;

            if (!body) continue;

            try {
                // Memanggil Gemini API dengan System Instruction Elysia
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: body,
                    config: {
                        systemInstruction: SYSTEM_INSTRUCTION,
                        temperature: 0.7
                    }
                });

                const replyText = response.text;
                await sock.sendMessage(from, { text: replyText }, { quoted: msg });
            } catch (error) {
                console.error('Error memproses pesan Gemini:', error);
            }
        }
    });
}

connectToWhatsApp();
      
