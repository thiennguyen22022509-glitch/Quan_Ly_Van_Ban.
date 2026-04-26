const express = require('express');
const mongoose = require('mongoose');
const { google } = require('googleapis');
const path = require('path');
const stream = require('stream');
require('dotenv').config();

const app = express();
app.use(express.json());

// --- CẤU HÌNH ---
const FOLDER_ID = '1wZoVmUFmDzktuGNRbWOVRkyf73bVp83-?hl=vi'; // <-- Dán ID lấy ở Bước 1 vào đây
const KEYFILEPATH = path.join(__dirname, 'google-key.json'); // File JSON đã đổi tên

// 1. Kết nối MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ Đã kết nối MongoDB!"))
    .catch(err => console.error("❌ Lỗi MongoDB:", err));

const Document = mongoose.model('Document', new mongoose.Schema({
    title: String,
    driveId: String,
    createdAt: { type: Date, default: Date.now }
}));

// 2. Cấu hình Google Drive API
const auth = new google.auth.GoogleAuth({
    keyFile: KEYFILEPATH,
    scopes: ['https://www.googleapis.com/auth/drive'],
});
const driveService = google.drive({ version: 'v3', auth });

// 3. Đường dẫn
app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));

// API Lưu văn bản
// Tìm đến đoạn app.post('/api/documents', ...) và thay bằng đoạn này:

app.post('/api/documents', async (req, res) => {
    try {
        const { title, content } = req.body;

        if (!title || !content) {
            return res.status(400).json({ message: "Thiếu tiêu đề hoặc nội dung!" });
        }

        // --- BƯỚC 1: ĐẨY FILE LÊN GOOGLE DRIVE ---
        const bufferStream = new stream.PassThrough();
        bufferStream.end(content); // Biến nội dung văn bản thành luồng dữ liệu

        const driveResponse = await driveService.files.create({
            requestBody: {
                name: `${title}.txt`, // Tên file trên Drive
                parents: ['1B2C3D4E5F6G...'], // <--- DÁN ID THƯ MỤC DRIVE CỦA BẠN VÀO ĐÂY
            },
            media: {
                mimeType: 'text/plain',
                body: bufferStream,
            },
        });

        // --- BƯỚC 2: LƯU THÔNG TIN VÀO MONGODB ---
        const newDoc = new Document({
            title: title,
            driveId: driveResponse.data.id, // Lưu ID của Google Drive để sau này tìm lại
            createdAt: new Date()
        });
        await newDoc.save();

        console.log(`✅ Đã lưu file: ${title} lên Google Drive`);
        res.json({ message: "Thành công! Văn bản đã nằm trên Google Drive và Database." });

    } catch (error) {
        console.error("❌ Lỗi hệ thống:", error);
        res.status(500).json({ message: "Có lỗi xảy ra khi lưu lên Cloud!" });
    }
});

app.listen(3000, () => console.log("🚀 Web chạy tại http://localhost:3000"));

// API: Nhận tiêu đề & nội dung -> Đẩy lên Drive -> Lưu Metadata vào MongoDB
app.post('/api/documents', async (req, res) => {
    try {
        const { title, content } = req.body;

        // 1. Tạo luồng dữ liệu từ nội dung văn bản
        const bufferStream = new stream.PassThrough();
        bufferStream.end(content);

        // 2. Gọi Google Drive API để tạo file .txt
        const driveResponse = await driveService.files.create({
            requestBody: {
                name: `${title}.txt`,
                parents: [FOLDER_ID],
            },
            media: {
                mimeType: 'text/plain',
                body: bufferStream,
            },
        });

        // 3. Lưu ID của file Drive vào MongoDB để quản lý
        const newDoc = new Document({
            title: title,
            driveId: driveResponse.data.id
        });
        await newDoc.save();

        res.json({ message: "🎉 Tuyệt vời! File đã nằm trên Google Drive." });
    } catch (error) {
        console.error("Lỗi rồi:", error);
        res.status(500).json({ message: "Không lưu được file lên Cloud." });
    }
});

app.listen(3000, () => console.log("🚀 Server sẵn sàng tại http://localhost:3000"));