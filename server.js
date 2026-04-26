const express = require('express');
const mongoose = require('mongoose');
const { google } = require('googleapis');
const path = require('path');
const stream = require('stream');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static('public')); // Đảm bảo các file html, css nằm trong thư mục public

// 1. CẤU HÌNH DRIVE (Đọc từ Biến môi trường)
const FOLDER_ID = process.env.FOLDER_ID;
const googleKey = JSON.parse(process.env.GOOGLE_KEY_JSON); // Đọc nội dung JSON từ biến

const auth = new google.auth.JWT(
    googleKey.client_email,
    null,
    googleKey.private_key,
    ['https://www.googleapis.com/auth/drive']
);
const driveService = google.drive({ version: 'v3', auth });

// 2. KẾT NỐI MONGODB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ Đã kết nối MongoDB!"))
    .catch(err => console.error("❌ Lỗi MongoDB:", err));

const Document = mongoose.model('Document', new mongoose.Schema({
    title: String,
    driveId: String,
    createdAt: { type: Date, default: Date.now }
}));

// 3. API LƯU VĂN BẢN
app.post('/api/documents', async (req, res) => {
    try {
        const { title, content } = req.body;
        const bufferStream = new stream.PassThrough();
        bufferStream.end(content);

        const driveResponse = await driveService.files.create({
            requestBody: { name: `${title}.txt`, parents: [FOLDER_ID] },
            media: { mimeType: 'text/plain', body: bufferStream }
        });

        const newDoc = new Document({ title, driveId: driveResponse.data.id });
        await newDoc.save();

        res.json({ message: "🎉 Thành công! Đã lưu lên Cloud." });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Lỗi lưu file!" });
    }
});

// QUAN TRỌNG CHO VERCEL
module.exports = app;