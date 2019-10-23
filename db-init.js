const MongoDbClient = require('./mongo-db-client');
const SqliteDbClient = require('./sqlite-db-client');
const fsPromises = require('fs').promises;
const fs = require('fs')
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const uuid = require('uuid').v4
const moment = require('moment');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

const dbUrl = process.env.MONGO_URL || "mongodb://localhost:27017/video-portal";
const dbPath = process.env.SQLITE_DB_PATH || 'videos.db';
const dir = process.env.CONTENT_DIR || "./content";
const selectedDb = process.env.DB_ENGINE || 'sqlite' // 'mongo' or 'sqlite'

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

    const execThumbnailer = async (percent, output) => {
        const cmd = `ffmpegthumbnailer -i "${filepath.replace(/\n/g, '')}" -s 320 -t ${percent}% -o "${output}"`;

        const { stdout, stderr } = await exec(cmd);
        if (stderr) {
            console.log('stderr:', stderr);
        }
    }

    if (!fs.existsSync(path.join(dir, '.thumbnails', filename + '_5.png'))) {
        try {
            await execThumbnailer(10, path.join(dir, '.thumbnails', filename + '_1.png'))
            await execThumbnailer(30, path.join(dir, '.thumbnails', filename + '_2.png'))
            await execThumbnailer(50, path.join(dir, '.thumbnails', filename + '_3.png'))
            await execThumbnailer(70, path.join(dir, '.thumbnails', filename + '_4.png'))
            await execThumbnailer(90, path.join(dir, '.thumbnails', filename + '_5.png'))

            const thumbnails = [
                'data:image/png;base64,' + await fsPromises.readFile(path.join(dir, '.thumbnails', filename + '_1.png'), 'base64'),
                'data:image/png;base64,' + await fsPromises.readFile(path.join(dir, '.thumbnails', filename + '_2.png'), 'base64'),
                'data:image/png;base64,' + await fsPromises.readFile(path.join(dir, '.thumbnails', filename + '_3.png'), 'base64'),
                'data:image/png;base64,' + await fsPromises.readFile(path.join(dir, '.thumbnails', filename + '_4.png'), 'base64'),
                'data:image/png;base64,' + await fsPromises.readFile(path.join(dir, '.thumbnails', filename + '_5.png'), 'base64'),
            ]

            return {
                id: uuid(),
                size: stats.size,
                path: filepath,
                duration_raw: parseInt(metadata.format.duration),
                duration: moment.utc(moment.duration(parseInt(metadata.format.duration), "seconds").asMilliseconds()).format("HH:mm:ss"),
                created_at: new Date().getTime(),
                name: path.parse(filename).name,
                type: path.parse(filename).ext.slice(1),
                thumbnails
            }
        }
        catch (err) {
            console.error(err)
            console.error('Failed to generate thumbnail: ', filename)

            return {
                id: uuid(),
                size: stats.size,
                path: filepath,
                duration_raw: parseInt(metadata.format.duration),
                duration: moment.utc(moment.duration(parseInt(metadata.format.duration), "seconds").asMilliseconds()).format("HH:mm:ss"),
                created_at: new Date().getTime(),
                name: path.parse(filename).name,
                type: path.parse(filename).ext.slice(1),
                thumbnails: [
                    'data:image/png;base64,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',
                    'data:image/png;base64,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',
                    'data:image/png;base64,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',
                    'data:image/png;base64,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',
                    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAANIAAACeCAIAAADIYcMCAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAABqBJREFUeNrsnVtP8koYRrWcPLGjEIgHghfGxMT//1O8xRtjQjzBpqAIyH7C7DTNTFspIlBc6+KL33Rsh+lyZt4eXnZbrdYOwGrx6AJAO0A7ALQDtANAO0A7ALQDtANAO0A7QDsAtAO0A0A7QDsAtAO0A0A7QDtAOwC0A7QDQDtAOwC0A7QDQDtAO0A7ALQDtANAO0A7ALQDtANAO0A7QDsAtAO0A0A7QDsAtAO0A0A7QDv4i+TpAvHvDKvwnxmRW2u1WqlUot/Q7keMx+P393erMJfLGe3crV9fX3Qak+xP2d3ddQt930/YCmj3WwTmAdqtjo+PDzqBtd2qcRd8cdU6nc5gMAiv+RRzmKDE8/jbRruUo91oNPo2Cm632275cDh8enrS1kajgXlMssucZ7X4i3QuLN/j4yPdiHbLnGefn5+tklwu5+5B8tGTaLecYFYyWVPw4eHhzc1NrVazavb7fXoS7b6nUCiYHyaTSdxY9fn5aZUcHByocH9/f7HQBO3+OuVyOfi51+tF1nGjjel0uhN1D4MLzmg3F+6I5eLKpNEu+BfQLn2/eJ4Waml/y4xzZswDtEuN1AnPs4B2K2Jvby/tr5jgg8slaLc4xWLRvQj37Ri5w2NRaPer86z7pKeJbcfjcWSoAQHck01CunQ6nfm163a7k8lkMBhY5QtEJ4x2f5dkXfL5/PHxsVXo+741yWonmq/pTLRbTmChWbheryev/7T1/PycSypol47k5Z18ur6+dsc8g8q1lVsULrutVoteyM2wggMzRLmbwluD2dbzPOt+v+ZWzbZueAGEFP8zmZF2U4Bxy1rAuQ8KANotHxZwrO0A7QDQDtAO0A4A7QDtANAO0A4A7QDtABxWd0/24eFhzpq1Wm04HFrpgoNMwpuGyewULimVSm4+ilXidnWj0Yhs6rp6dXXazZ+QwTwvZNXf2NcR1FqrqWt/wC6uq92mrqtXN3SSdc9chh6WpKms7eBvr+1gZax3ZblZ2t3e3gY/393dJWwdjUaROTRfXl56vZ55F9XzPK2Fq9VqkJ9VW8OVC4WCWSzHlStksVI2aW+q3Ol0gle/VFOnUIcIH3pnlpgn+RtRwvvREY9nhLdaTdKutNgPFl4mKLHS/2hvb29v/X4/nHVAv6tqlUolyIy2k4UHTlenXfJD3t8+Aq4eDz9crnOg86rI4+zszJS8vr5ai2WjV1y5NLJeaNXerPDZqKkzapXLD0WLzWYzfLID+jPCf0VSSo2X1pFN1U60Nfyao0k9G96/tuqIbpqL0Qw1T/1wdHRkCt0coycnJxulXWbWdpEvNPi+H5dwJG6xHJS7FdzvfzKGRZbLg263O3/7VTkuSYW8cTepJGynLExOrdJutzOUBCPzIcUaE2WmSrGjP5u0X64SvHWmA1kfs1wuWy/wyjk3GwHa/RRNN1ruuO8OLnEdoxN5enrqzps6qMrdDAEJVx/UVLd+QtJ31XdfyA32bzmnZWKj0bi8vEy7UCGSTY362qyNrOvsyw0A5YqGJesQJiDQMn/OzNcSV03VItKqH/cVF6a+hrS4bLX5fD4ssfasgdDdW4auF2ZGO41qEuK3Y7TIQ+h0zvO2bECxWFRld9SM0y6ufoBioCAmMJO1+aKV7C6NuG73K/N15NiT/IU+CUc3dwvN19puR85GtMsAcVdPsgs3xzKAplTLOUU5cfl+GO3AjpQX+0VrGadV4NXVlSbxhJSPaLcezNWENV5BdefEtJmQI6+emMh6/vgG7VaK1u86YWu5gtrv96W7exUtIVZd4C8q018otc2T7PzPMy+d+/t7d6BNeHQgAXeMNBmSMx1hbE9IsdgU9nuxp1sY3KpPhWR1P5rv+99+vzLarYK4bK8boqMWZIu1ZDqdViqVeT5ahkTcHu3q9bp1G1RnpdlsLhw/Lky1WrUOqoapeQtfjq7OsD7axcWFdZQMPQqwntzFbsJ8awHuZgw2t6fiyoM1u1Y8wX91ssfjseqHbxjo3JtRQZWtGwkmI3HcIVTZignMrtxyVfY8L2iJPmw+nw8PRdbHD5oUV246JBymSDjT1MiPFte9kU1dS1C8bSmzrdOwTS3ZnI9GJBuxEtrWlmxTbmRujgHaAdoBoB2gHQDaAdoBoB2gHQDaAdoB2gGgHaAdANoB2gGgHaAdANoB2gHaAaAdoB0A2gHaAaAdoB0A2gHaAdoBoB2gHQDaAdoBoB2gHQDaAdoB2gGgHaAdANoB2gGgHaAdANoB2gHaAaAdbC3/CTAAbFh4ItSs8x8AAAAASUVORK5CYII='
                ]
            }
        }
    }
    else {
        const thumbnails = [
            'data:image/png;base64,' + await fsPromises.readFile(path.join(dir, '.thumbnails', filename + '_1.png'), 'base64'),
            'data:image/png;base64,' + await fsPromises.readFile(path.join(dir, '.thumbnails', filename + '_2.png'), 'base64'),
            'data:image/png;base64,' + await fsPromises.readFile(path.join(dir, '.thumbnails', filename + '_3.png'), 'base64'),
            'data:image/png;base64,' + await fsPromises.readFile(path.join(dir, '.thumbnails', filename + '_4.png'), 'base64'),
            'data:image/png;base64,' + await fsPromises.readFile(path.join(dir, '.thumbnails', filename + '_5.png'), 'base64'),
        ]

        return {
            id: uuid(),
            size: stats.size,
            path: filepath,
            duration_raw: parseInt(metadata.format.duration),
            duration: moment.utc(moment.duration(parseInt(metadata.format.duration), "seconds").asMilliseconds()).format("HH:mm:ss"),
            created_at: new Date().getTime(),
            name: path.parse(filename).name,
            type: path.parse(filename).ext.slice(1),
            thumbnails
        }
    }
}

async function toModels(dbClient, dir, mapper) {
    const files = await fsPromises.readdir(dir);
    await dbClient.createTable();

    for (const f of files) {
        try {
            const stat = await fsPromises.stat(path.join(dir, f));
            if (stat.isFile()) {
                await dbClient.insertOne(await mapper(dir, f));
            }
        }
        catch (err) {
            console.error('Mapping failed for file: ', f);
            console.error(err)
        }
    }
}

(async () => {
    let dbClient;
    if (selectedDb === 'mongo') {
        dbClient = new MongoDbClient(dbUrl, 'video-portal')
    }
    else {
        dbClient = new SqliteDbClient(dbPath);
    }

    await dbClient.connect();

    try {
        await dbClient.dropTable();
    }
    catch (err) {
        console.error('Unable to drop videos table');
    }

    await toModels(dbClient, dir, modelMapper);
    await dbClient.close();
})()

