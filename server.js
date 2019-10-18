const express = require('express');
const MongoClient = require('mongodb').MongoClient;
const fs = require('fs');

const app = express();
app.set('view engine', 'pug');
app.set('views', './views');

app.use(async (req, res, next) => {
    const db = await MongoClient.connect(
        process.env.DB_URL || "mongodb://localhost:27017/video-portal",
        { useUnifiedTopology: true });
    const dbo = await db.db('video-portal');
    app.locals.db = dbo;
    next();
});

app.get('/', async (req, res) => {
    const page = req.query.page ? parseInt(req.query.page) : 1
    const videosCount = await app.locals.db.collection("videos").countDocuments();
    const total = Math.ceil(videosCount / 20)

    if (page > total) {
        return res.sendStatus(404)
    }

    const videos = await app.locals.db.collection("videos")
        .find({})
        .sort({ created_at: 1 })
        .skip(20 * (page - 1))
        .limit(20)
        .toArray();
    res.render('index', { videos, current: page, total, prefix: "?page=" });
});

app.get('/videos/:id', async (req, res) => {
    const video = await app.locals.db.collection("videos")
        .findOne({ id: req.params.id });

    if (!video) {
        return res.sendStatus(404);
    }

    const suggestions = await app.locals.db.collection("videos").aggregate([{ $sample: { size: 8 } }])

    res.render('video', { title: video.name, url: '/stream/' + video.id, suggestions });
});

app.get('/stream/:id', async (req, res) => {
    const video = await app.locals.db.collection("videos")
        .findOne({ id: req.params.id });

    if (!video) {
        return res.sendStatus(404);
    }

    const range = req.headers.range;
    if (!range) {
        // 416 Wrong range
        return res.sendStatus(416);
    }
    const positions = range.replace(/bytes=/, "").split("-");
    const start = parseInt(positions[0], 10);
    const total = video.size;
    const end = positions[1] ? parseInt(positions[1], 10) : total - 1;
    const chunksize = (end - start) + 1;

    res.writeHead(206, {
        "Content-Range": "bytes " + start + "-" + end + "/" + total,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize,
        "Content-Type": "video/" + video.type
    });

    const stream = fs.createReadStream(video.path, { start, end })
        .on("open", () => {
            stream.pipe(res);
        })
        .on("error", res.end);
});

app.listen(3000, () => {
    console.log('Video portal up and running on port 3000!');
});