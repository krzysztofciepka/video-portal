const express = require('express');
const compression = require('compression');
const MongoClient = require('mongodb').MongoClient;
const fs = require('fs');
const basicAuth = require('express-basic-auth');

const username = process.env.USERNAME || 'admin';
const password = process.env.PASSWORD || 'admin';
const maxItemsOnPage = parseInt(process.env.MAX_ITEMS || '20');
const mongoUrl = process.env.MONGO_URL || "mongodb://localhost:27017/video-portal";
const serverPort = parseInt(process.env.PORT || 3000);
const appName = process.env.APP_NAME || 'Video Portal';

const app = express();
app.set('view engine', 'pug');
app.set('views', './views');

app.use(async (req, res, next) => {
    const db = await MongoClient.connect(mongoUrl, { useUnifiedTopology: true });
    const dbo = await db.db('video-portal');
    app.locals.db = dbo;
    next();
});

app.get('/', basicAuth({
    challenge: true,
    users: { [username]: password }
}), compression(), async (req, res) => {
    const page = req.query.page ? parseInt(req.query.page) : 1
    const videosCount = await app.locals.db.collection("videos").countDocuments();
    const total = Math.ceil(videosCount / maxItemsOnPage)

    if (page > total) {
        return res.sendStatus(404)
    }

    const videos = await app.locals.db.collection("videos")
        .find({})
        .sort({ created_at: 1 })
        .skip(maxItemsOnPage * (page - 1))
        .limit(maxItemsOnPage)
        .toArray();
    res.render('index', { header: appName, videos, current: page, total, prefix: "?page=" });
});

app.get('/videos/:id', basicAuth({
    challenge: true,
    users: { [username]: password }
}), compression(), async (req, res) => {
    const video = await app.locals.db.collection("videos")
        .findOne({ id: req.params.id });

    if (!video) {
        return res.sendStatus(404);
    }

    const suggestions = await app.locals.db.collection("videos").aggregate([{ $sample: { size: 8 } }]).toArray();

    res.render('video', { header: appName, title: video.name, url: '/stream/' + video.id, suggestions, type: video.type });
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

app.listen(serverPort, () => {
    console.log('Video portal up and running on port 3000!');
});