const express = require('express');
const compression = require('compression');
const MongoDbClient = require('./mongo-db-client');
const SqliteDbClient = require('./sqlite-db-client');
const fs = require('fs');
const basicAuth = require('express-basic-auth');

const username = process.env.USERNAME || 'admin';
const password = process.env.PASSWORD || 'admin';
const maxItemsOnPage = parseInt(process.env.MAX_ITEMS || '20');
const mongoUrl = process.env.MONGO_URL || "mongodb://localhost:27017/video-portal";
const dbPath = process.env.SQLITE_DB_PATH || 'videos.db';
const selectedDb = process.env.DB_ENGINE || 'sqlite' // 'sqlite' or 'mongo'
const serverPort = parseInt(process.env.PORT || 3000);
const appName = process.env.APP_NAME || 'Video Portal';

const app = express();
app.set('view engine', 'pug');
app.set('views', './views');

app.use(async (req, res, next) => {
    if(selectedDb === 'mongo'){
        app.locals.db = new MongoDbClient(mongoUrl, 'video-portal');
    }
    else {
        app.locals.db = new SqliteDbClient(dbPath);
    }

    
    await app.locals.db.connect();
    next();
});

const videosHandler = async (req, res) => {
    const page = req.query.page ? parseInt(req.query.page) : 1;

    let query;
    if (req.query.search) {
        query = {
            name: new RegExp(req.query.search, 'i')
        }
    }
    else {
        query = {}
    }

    let sort;
    switch (req.query.sort) {
        case 'newest':
            sort = { created_at: -1 }
            break;
        case 'longest':
            sort = { duration: -1 }
            break;
        default:
            sort = { created_at: 1 }
    }

    const videosCount = await app.locals.db.count();
    const total = Math.ceil(videosCount / maxItemsOnPage);

    if (page > total) {
        return res.status(404).render('404', { header: appName });
    }

    const videos = await app.locals.db.select(query, sort, maxItemsOnPage * (page - 1), maxItemsOnPage);

    const params = []
    if (req.query.search) {
        params.push('search=' + req.query.search)
    }
    if (req.query.sort) {
        params.push('sort=' + req.query.sort)
    }

    const prefix = '?' + params.join('&') + (params.length ? '&page=' : 'page=')

    res.render('index', {
        header: appName,
        videos,
        title: appName,
        current: page,
        total,
        prefix,
        sort: req.query.sort || 'oldest'
    });
}

app.get('/videos',
    basicAuth({
        challenge: true,
        users: { [username]: password }
    }),
    compression(),
    videosHandler
);

app.get('/',
    basicAuth({
        challenge: true,
        users: { [username]: password }
    }),
    compression(),
    videosHandler
);

app.get('/videos/:id',
    basicAuth({
        challenge: true,
        users: { [username]: password }
    }),
    compression(),
    async (req, res) => {
        const video = await app.locals.db.selectById(req.params.id);

        if (!video) {
            return res.status(404).render('404', { header: appName });
        }

        let suggestions = await app.locals.db.selectRandom(8);

        res.render('video', {
            header: appName,
            title: video.name,
            url: '/stream/' + video.id,
            suggestions,
            type: video.type
        });
    });

app.get('/stream/:id', async (req, res) => {
    const video = await app.locals.db.selectById(req.params.id);

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
    console.log(`Video portal up and running on port ${serverPort}!`);
});