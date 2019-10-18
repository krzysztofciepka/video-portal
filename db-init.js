const MongoClient = require('mongodb').MongoClient;
const fs = require('fs').promises;
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const uuid = require('uuid').v4

const dbUrl = process.env.MONGO_URL || "mongodb://localhost:27017/video-portal";
const dir = process.env.CONTENT_DIR || "./content";

async function modelMapper(dir, filename) {
    const filepath = path.join(dir, filename);
    const stats = await fs.stat(filepath);

    await new Promise(resolve => new ffmpeg(filepath)
        .takeScreenshots({
            count: 5,
            size: '320x240',
            filename: '%f_%i',
            timestamps: ['10%', '30%', '50%', '70%', '90%']
        }, path.join(dir, '.thumbnails'))
        .on('end', resolve)
        .on('error', reject));

    return {
        id: uuid(),
        size: stats.size,
        path: filepath,
        created_at: new Date(),
        name: path.parse(filename).name,
        type: path.parse(filename).ext.slice(1),
        thumbnails: [
            'data:image/png;base64,' + await fs.readFile(path.join(dir, '.thumbnails', filename + '_1.png'), 'base64'),
            'data:image/png;base64,' + await fs.readFile(path.join(dir, '.thumbnails', filename + '_2.png'), 'base64'),
            'data:image/png;base64,' + await fs.readFile(path.join(dir, '.thumbnails', filename + '_3.png'), 'base64'),
            'data:image/png;base64,' + await fs.readFile(path.join(dir, '.thumbnails', filename + '_4.png'), 'base64'),
            'data:image/png;base64,' + await fs.readFile(path.join(dir, '.thumbnails', filename + '_5.png'), 'base64'),
        ]
    }
}

async function toModels(dir, mapper) {
    const files = await fs.readdir(dir);
    const entries = [];
    for (const f of files) {
        const stat = await fs.stat(path.join(dir, f))
        if (stat.isFile()) {
            entries.push(await mapper(dir, f));
        }
    }

    return entries;
}

(async () => {
    const db = await MongoClient.connect(dbUrl, { useUnifiedTopology: true })
    const dbo = db.db('video-portal');

    await dbo.dropCollection('videos');
    const videos = await dbo.createCollection('videos');

    const models = await toModels(dir, modelMapper);
    await videos.insertMany(models);

    db.close();
})()

