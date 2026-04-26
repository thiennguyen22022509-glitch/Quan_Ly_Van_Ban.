const express = require('express');
const mongoose = require('mongoose');
const { google } = require('googleapis');
const path = require('path');
const stream = require('stream');
require('dotenv').config();

const app = express();

// 1. CẤU HÌNH BIẾN MÔI TRƯỜNG
const FOLDER_ID = process.env.FOLDER_ID;

let googleKey;
try {
    // Đọc biến môi trường từ Vercel
    const rawKey = process.env.GOOGLE_KEY_JSON;
    googleKey = JSON.parse(rawKey);
    
    // Sửa lỗi định dạng private_key do Vercel tự thêm dấu gạch chéo (\n thành \\n)
    if (googleKey && googleKey.private_key) {
        googleKey.private_key = googleKey.private_key.replace(/\\n/g, '\n');
    }
} catch (e) {
    console.error("❌ Lỗi: GOOGLE_KEY_JSON không đúng định dạng JSON!", e);
}

// 2. CẤU HÌNH MIDDLEWARE
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); 

// 3. CẤU HÌNH GOOGLE DRIVE
const auth = new google.auth.JWT(
    googleKey?.client_email,
    null,
    googleKey?.private_key,
    ['https://www.googleapis.com/auth/drive']
);
const driveService = google.drive({ version: 'v3', auth });

// 4. KẾT NỐI MONGODB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ Kết nối MongoDB thành công!"))
    .catch(err => console.error("❌ Lỗi kết nối MongoDB:", err));

const Document = mongoose.model('Document', new mongoose.Schema({
    title: String,
    driveId: String,
    createdAt: { type: Date, default: Date.now }
}));

// 5. API LƯU VĂN BẢN
app.post('/api/documents', async (req, res) => {
    try {
        const { title, content } = req.body;
        
        if (!title || !content) {
            return res.status(400).json({ message: "Thiếu tiêu đề hoặc nội dung!" });
        }

        const bufferStream = new stream.PassThrough();
        bufferStream.end(content);

        const driveResponse = await driveService.files.create({
            requestBody: { 
                name: `${title}.txt`, 
                parents: [FOLDER_ID] 
            },
            media: { 
                mimeType: 'text/plain', 
                body: bufferStream 
            }
        });

        const newDoc = new Document({ 
            title, 
            driveId: driveResponse.data.id 
        });
        await newDoc.save();

        res.json({ message: "🎉 Tuyệt vời! Đã lưu lên Cloud thành công." });
    } catch (error) {
        console.error("Chi tiết lỗi:", error);
        res.status(500).json({ message: "Lỗi lưu file!", error: error.message });
    }
});

module.exports = app;