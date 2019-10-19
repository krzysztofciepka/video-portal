const MongoClient = require('mongodb').MongoClient;
const fsPromises = require('fs').promises;
const fs = require('fs')
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const uuid = require('uuid').v4
const moment = require('moment');
const extractFrames = require('ffmpeg-extract-frames')

const dbUrl = process.env.MONGO_URL || "mongodb://localhost:27017/video-portal";
const dir = process.env.CONTENT_DIR || "./content";

async function modelMapper(dir, filename) {
    const filepath = path.join(dir, filename);
    const stats = await fsPromises.stat(filepath);

    const metadata = await new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filepath, function (err, metadata) {
            if (err) {
                return reject(err);
            }

            resolve(metadata);
        });
    });

    console.log(filepath);
    console.log(metadata.format.duration);

    let thumbnails = [];

    const takeScreenshot = async (percent, output, num) => {
        await new Promise((resolve, reject) => new ffmpeg(filepath)
            .takeScreenshots({
                count: 1,
                size: '320x240',
                filename: '%f_' + num,
                timestamps: [percent]
            }, output)
            .on('end', resolve)
            .on('error', (err) => {
                console.log('ffmpeg: ' + err);
                reject(err);
            })
        );
    }

    if (!fs.existsSync(path.join(dir, '.thumbnails', filename + '_5.png'))) {
        try {
            await takeScreenshot('10%', path.join(dir, '.thumbnails'), 1)
            await takeScreenshot('30%', path.join(dir, '.thumbnails'), 2)
            await takeScreenshot('50%', path.join(dir, '.thumbnails'), 3)
            await takeScreenshot('70%', path.join(dir, '.thumbnails'), 4)
            await takeScreenshot('90%', path.join(dir, '.thumbnails'), 5)

            thumbnails = [
                'data:image/png;base64,' + await fsPromises.readFile(path.join(dir, '.thumbnails', filename + '_1.png'), 'base64'),
                'data:image/png;base64,' + await fsPromises.readFile(path.join(dir, '.thumbnails', filename + '_2.png'), 'base64'),
                'data:image/png;base64,' + await fsPromises.readFile(path.join(dir, '.thumbnails', filename + '_3.png'), 'base64'),
                'data:image/png;base64,' + await fsPromises.readFile(path.join(dir, '.thumbnails', filename + '_4.png'), 'base64'),
                'data:image/png;base64,' + await fsPromises.readFile(path.join(dir, '.thumbnails', filename + '_5.png'), 'base64'),
            ]
        }
        catch (err) {
            console.error(err)
            console.error('Failed to generate thumbnail: ', filename)
            thumbnails = []
        }
    }

    return {
        id: uuid(),
        size: stats.size,
        path: filepath,
        duration: moment.utc(moment.duration(parseInt(metadata.format.duration), "seconds").asMilliseconds()).format("HH:mm:ss"),
        created_at: new Date(),
        name: path.parse(filename).name,
        type: path.parse(filename).ext.slice(1),
        thumbnails
    }
}

async function toModels(dir, mapper) {
    const files = await fsPromises.readdir(dir);
    const entries = [];
    for (const f of files) {
        try {
            const stat = await fsPromises.stat(path.join(dir, f));
            if (stat.isFile()) {
                entries.push(await mapper(dir, f));
            }
        }
        catch (err) {
            console.error('Mapping failed for file: ', f);
        }
    }

    return entries;
}

(async () => {
    const db = await MongoClient.connect(dbUrl, { useUnifiedTopology: true });
    const dbo = db.db('video-portal');

    try {
        await dbo.dropCollection('videos');
    }
    catch (err) {
        console.error('Unable to drop videos table');
    }

    const videos = await dbo.createCollection('videos');

    const models = await toModels(dir, modelMapper);
    await videos.insertMany(models);

    db.close();
})()

