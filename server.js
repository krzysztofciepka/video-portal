const express = require('express');
const pug = require('pug');
const MongoClient = require('mongodb').MongoClient

const app = express();

app.use(async (req, res, next) => {
    const db = await MongoClient.connect(
        process.env.DB_URL || "mongodb://localhost:27017/video-portal",
        { useUnifiedTopology: true });
    const dbo = await db.db('video-portal');
    app.locals.db = dbo;
    next();
})

app.get('/', async (req, res) => {
    const page = req.query.page || 1;

    const videos = await app.locals.db.collection("videos").find({}).toArray();

    const html = pug.renderFile('templates/index.pug', {
        videos: videos
    })
    res.send(html);
})

app.listen(3000, () => {
    console.log('server started');
})