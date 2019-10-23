const MongoClient = require('mongodb').MongoClient;

class MongoDbClient {
    constructor(dbUrl, dbName) {
        this.dbUrl = dbUrl;
        this.dbName = dbName;
    }

    async connect() {
        this.db = await MongoClient.connect(this.dbUrl);
        this.dbo = this.db.db(this.dbName);
    }

    async count(query) {
        return await this.dbo.collection('videos')
            .countDocuments(query);
    }

    async createTable() {
        const videos = await this.dbo.createCollection('videos');
        await videos.createIndex({ 'created_at': 1 });
        await videos.createIndex({ 'created_at': -1 });
        await videos.createIndex({ 'duration': -1 });
    }

    async dropTable() {
        await dbo.dropCollection('videos');
    }

    async insertOne(item) {
        await this.dbo.collection('videos').insertOne(item);
    }

    async selectById(id) {
        return await this.dbo.collection('videos')
            .findOne({ id });
    }

    async select(query, sort, offset, limit) {
        return await this.dbo.collection('videos')
            .find(query)
            .sort(sort)
            .skip(offset)
            .limit(limit)
            .toArray();
    }

    async selectRandom(count) {
        if (parseFloat(process.env.MONGO_VERSION || '0') < 3.6) {
            const itemsCount = await this.dbo.collection('videos')
                .countDocuments();

            let randomItem = parseInt(Math.random() * itemsCount) - count;

            return await this.dbo.collection('videos')
                .find()
                .limit(count)
                .skip(randomItem < 0 ? 0 : randomItem)
                .toArray()
        }

        return await app.locals.db.collection('videos')
            .aggregate([{ $sample: { size: count } }])
            .toArray();
    }

    async close() {
        await this.db.close();
    }
}

module.exports = MongoDbClient;